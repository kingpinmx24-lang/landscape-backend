/**
 * Inpainting tRPC Router
 * ============================================================================
 * Procedures:
 *
 * 1. detectObstacles — uses Claude Vision (claude-opus-4-5) to analyze the
 *    terrain photo and return ALL obstacles with precise bounding boxes.
 *
 * 2. cleanTerrain — two modes:
 *    a. FREEHAND MASK: imageBase64 + maskBase64 (user-painted mask)
 *    b. OBSTACLE LIST: imageBase64 + obstacles[] (bounding boxes)
 *    Both call Cloudflare AI stable-diffusion-v1-5-inpainting.
 *
 * Cloudflare AI model: @cf/runwayml/stable-diffusion-v1-5-inpainting
 * Mask convention: WHITE = erase/inpaint, BLACK = keep
 *
 * Uses pure Node.js (zlib + Buffer) — no native dependencies.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import zlib from "zlib";

const CF_ACCOUNT_ID =
  process.env.CF_ACCOUNT_ID || "a5a228d8474a0f927acb0356a946d4fe";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const CF_INPAINT_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`;

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-opus-4-5";

const ObstacleSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number().optional(),
});

/** Convert base64 data URL or raw base64 to Buffer */
function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/** Get image dimensions from PNG or JPEG buffer */
function getImageDimensions(buf: Buffer): { width: number; height: number } {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      if (i + 3 < buf.length) i += 2 + buf.readUInt16BE(i + 2);
      else break;
    } else i++;
  }
  return { width: 512, height: 512 };
}

/** CRC32 for PNG chunks */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a PNG chunk */
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Encode raw RGB pixels as PNG */
function encodePng(width: number, height: number, rgbPixels: Uint8Array): Buffer {
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      row[1 + x * 3] = rgbPixels[src];
      row[1 + x * 3 + 1] = rgbPixels[src + 1];
      row[1 + x * 3 + 2] = rgbPixels[src + 2];
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", Buffer.alloc(0))]);
}

/**
 * Create a grayscale mask PNG from obstacle bounding boxes.
 * White = inpaint, Black = keep.
 * Coordinates are in actual image pixels (from Claude detection).
 */
function createMaskFromObstacles(
  imageWidth: number,
  imageHeight: number,
  obstacles: z.infer<typeof ObstacleSchema>[],
  coordSpace: "image" | "canvas800x600" = "image"
): Buffer {
  const pixels = new Uint8Array(imageWidth * imageHeight * 3).fill(0);
  const scaleX = coordSpace === "canvas800x600" ? imageWidth / 800 : 1;
  const scaleY = coordSpace === "canvas800x600" ? imageHeight / 600 : 1;

  for (const obs of obstacles) {
    const cx = obs.x * scaleX;
    const cy = obs.y * scaleY;
    const hw = (obs.width * scaleX) / 2;
    const hh = (obs.height * scaleY) / 2;
    // Add 15% padding around each obstacle for clean edges
    const padX = hw * 0.15;
    const padY = hh * 0.15;
    const x0 = Math.max(0, Math.floor(cx - hw - padX));
    const y0 = Math.max(0, Math.floor(cy - hh - padY));
    const x1 = Math.min(imageWidth, Math.ceil(cx + hw + padX));
    const y1 = Math.min(imageHeight, Math.ceil(cy + hh + padY));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * imageWidth + x) * 3;
        pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
      }
    }
  }
  return encodePng(imageWidth, imageHeight, pixels);
}

export const inpaintRouter = router({
  /**
   * detectObstacles — analyze terrain photo with Claude Vision and return
   * ALL detected obstacles with precise bounding boxes in image pixel coords.
   */
  detectObstacles: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        imageWidth: z.number().optional(),
        imageHeight: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64 } = input;

      if (!CLAUDE_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY not configured on server");
      }

      const imgBuf = base64ToBuffer(imageBase64);
      const { width: imgW, height: imgH } = getImageDimensions(imgBuf);
      const imgRawB64 = imgBuf.toString("base64");

      // Determine MIME type
      const isPng = imgBuf[0] === 0x89 && imgBuf[1] === 0x50;
      const mimeType = isPng ? "image/png" : "image/jpeg";

      console.log(`[DetectObstacles] Analyzing ${imgW}x${imgH} image with Claude Vision...`);

      const prompt = `You are analyzing a terrain/landscape photo (${imgW}x${imgH} pixels) to detect ALL obstacles that should be removed to prepare the land for landscaping.

Detect EVERY obstacle including: rocks, stones, concrete blocks, debris, tree stumps, pipes, fences, posts, construction materials, or any man-made or natural object that does not belong to clean terrain.

Return ONLY a valid JSON array with no markdown, no explanation, no code blocks. Each obstacle:
{
  "label": "rock",
  "x": 85,
  "y": 70,
  "width": 70,
  "height": 60,
  "confidence": 0.95
}

Where x,y is the CENTER of the obstacle in pixels (relative to the ${imgW}x${imgH} image), width/height are the bounding box dimensions in pixels.

If no obstacles are found, return an empty array: []`;

      const claudePayload = {
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imgRawB64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      };

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(claudePayload),
      });

      if (!claudeResp.ok) {
        const errText = await claudeResp.text();
        console.error(`[DetectObstacles] Claude error ${claudeResp.status}: ${errText}`);
        throw new Error(`Claude Vision error ${claudeResp.status}: ${errText.slice(0, 300)}`);
      }

      const claudeData = await claudeResp.json() as any;
      const responseText: string = claudeData?.content?.[0]?.text || "[]";

      console.log(`[DetectObstacles] Claude raw response: ${responseText.slice(0, 200)}`);

      // Extract JSON array from response (handle any extra text)
      let obstacles: z.infer<typeof ObstacleSchema>[] = [];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          obstacles = parsed.map((o: any) => ({
            label: String(o.label || "obstacle"),
            x: Number(o.x),
            y: Number(o.y),
            width: Number(o.width),
            height: Number(o.height),
            confidence: Number(o.confidence || 0.9),
          })).filter((o: any) =>
            !isNaN(o.x) && !isNaN(o.y) && !isNaN(o.width) && !isNaN(o.height) &&
            o.width > 0 && o.height > 0
          );
        }
      } catch (e) {
        console.error(`[DetectObstacles] JSON parse error:`, e);
        obstacles = [];
      }

      console.log(`[DetectObstacles] Found ${obstacles.length} obstacles`);
      return {
        obstacles,
        imageWidth: imgW,
        imageHeight: imgH,
      };
    }),

  /**
   * cleanTerrain — remove obstacles from terrain photo using Cloudflare AI inpainting.
   * Accepts either a freehand mask (maskBase64) or obstacle bounding boxes (obstacles[]).
   */
  cleanTerrain: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        maskBase64: z.string().optional(),
        obstacles: z.array(ObstacleSchema).optional().default([]),
        coordSpace: z.enum(["image", "canvas800x600"]).optional().default("image"),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64, maskBase64, obstacles, coordSpace, prompt } = input;

      if (!maskBase64 && (!obstacles || obstacles.length === 0)) {
        return { imageBase64 };
      }

      if (!CF_API_TOKEN) {
        throw new Error("CF_API_TOKEN not configured on server");
      }

      const origBuffer = base64ToBuffer(imageBase64);
      const { width: origW, height: origH } = getImageDimensions(origBuffer);
      console.log(`[Inpaint] Image: ${origW}x${origH}, mode: ${maskBase64 ? "freehand-mask" : `obstacle-list(${obstacles!.length})`}`);

      let maskBuffer: Buffer;

      if (maskBase64) {
        maskBuffer = base64ToBuffer(maskBase64);
        console.log(`[Inpaint] Using freehand mask (${maskBuffer.length} bytes)`);
      } else {
        maskBuffer = createMaskFromObstacles(origW, origH, obstacles!, coordSpace);
        console.log(`[Inpaint] Generated mask from ${obstacles!.length} obstacle(s) in ${coordSpace} coords`);
      }

      const imageArray = Array.from(origBuffer);
      const maskArray = Array.from(maskBuffer);

      const obstacleLabels = obstacles?.map((o) => o.label).join(", ") || "obstacle";
      const inpaintPrompt =
        prompt ||
        (maskBase64
          ? "Clean natural terrain, seamless background fill. Match surrounding area texture: gravel, dirt, grass, or soil. Photorealistic, no artifacts."
          : `Clean natural terrain, remove ${obstacleLabels}. Replace with natural ground matching the surrounding area. Photorealistic, seamless.`);

      console.log(`[Inpaint] Calling Cloudflare AI...`);
      const cfResponse = await fetch(CF_INPAINT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: inpaintPrompt,
          negative_prompt:
            "rocks, stones, debris, obstacles, objects, artifacts, text, watermark, blurry, distorted",
          image: imageArray,
          mask: maskArray,
          num_steps: 20,
          strength: 1.0,
          guidance: 7.5,
        }),
      });

      if (!cfResponse.ok) {
        const errText = await cfResponse.text();
        console.error(`[Inpaint] Cloudflare error ${cfResponse.status}: ${errText}`);
        throw new Error(`Cloudflare AI error ${cfResponse.status}: ${errText.slice(0, 300)}`);
      }

      const pngBuffer = Buffer.from(await cfResponse.arrayBuffer());
      const resultBase64 = "data:image/png;base64," + pngBuffer.toString("base64");
      console.log(`[Inpaint] Success! Result: ${pngBuffer.length} bytes`);
      return { imageBase64: resultBase64 };
    }),
});
