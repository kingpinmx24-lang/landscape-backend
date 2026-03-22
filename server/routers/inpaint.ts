/**
 * Inpainting tRPC Router
 * ============================================================================
 * Receives a base64 image + obstacle bounding boxes, creates a mask,
 * calls Cloudflare Workers AI (stable-diffusion-v1-5-inpainting),
 * returns the cleaned image as base64.
 *
 * Called via: trpc.inpaint.cleanTerrain.mutate({ imageBase64, obstacles })
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

const ObstacleSchema = z.object({
  x: z.number(), // center x (0-800 internal coords)
  y: z.number(), // center y (0-600 internal coords)
  width: z.number(), // width in internal coords
  height: z.number(), // height in internal coords
  label: z.string(),
});

/** Convert base64 data URL to Buffer */
function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/** Get image dimensions from PNG or JPEG buffer */
function getImageDimensions(buf: Buffer): { width: number; height: number } {
  // PNG: signature 8 bytes, then IHDR chunk: 4 len + 4 type + width(4) + height(4)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  // JPEG: scan for SOF0/SOF1/SOF2 markers
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          width: buf.readUInt16BE(i + 7),
          height: buf.readUInt16BE(i + 5),
        };
      }
      if (i + 3 < buf.length) {
        i += 2 + buf.readUInt16BE(i + 2);
      } else break;
    } else {
      i++;
    }
  }
  return { width: 512, height: 512 };
}

/** CRC32 for PNG chunks */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
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
  // Build raw scanlines with filter byte 0
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(1 + width * 3);
    row[0] = 0; // filter: none
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Create a grayscale mask PNG:
 * - White (255,255,255) = inpaint this area (obstacle)
 * - Black (0,0,0) = keep this area
 *
 * Obstacles use center-based coords in 800x600 internal space.
 * We scale to actual image dimensions.
 */
function createMaskPng(
  imageWidth: number,
  imageHeight: number,
  obstacles: z.infer<typeof ObstacleSchema>[]
): Buffer {
  const pixels = new Uint8Array(imageWidth * imageHeight * 3).fill(0); // all black

  const scaleX = imageWidth / 800;
  const scaleY = imageHeight / 600;

  for (const obs of obstacles) {
    const cx = obs.x * scaleX;
    const cy = obs.y * scaleY;
    const hw = (obs.width * scaleX) / 2;
    const hh = (obs.height * scaleY) / 2;
    // Add 20% padding around obstacle
    const padX = hw * 0.2;
    const padY = hh * 0.2;

    const x0 = Math.max(0, Math.floor(cx - hw - padX));
    const y0 = Math.max(0, Math.floor(cy - hh - padY));
    const x1 = Math.min(imageWidth, Math.ceil(cx + hw + padX));
    const y1 = Math.min(imageHeight, Math.ceil(cy + hh + padY));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * imageWidth + x) * 3;
        pixels[idx] = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
      }
    }
  }

  return encodePng(imageWidth, imageHeight, pixels);
}

export const inpaintRouter = router({
  cleanTerrain: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        obstacles: z.array(ObstacleSchema),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64, obstacles, prompt } = input;

      if (!obstacles.length) {
        return { imageBase64 };
      }

      if (!CF_API_TOKEN) {
        throw new Error("CF_API_TOKEN not configured on server");
      }

      console.log(`[Inpaint] Processing ${obstacles.length} obstacle(s) via Cloudflare AI...`);

      // Get original image dimensions
      const origBuffer = base64ToBuffer(imageBase64);
      const { width: origW, height: origH } = getImageDimensions(origBuffer);
      console.log(`[Inpaint] Image dimensions: ${origW}x${origH}`);

      // Create mask PNG
      const maskBuffer = createMaskPng(origW, origH, obstacles);

      // Convert to arrays of integers (Cloudflare Workers AI format)
      const imageArray = Array.from(origBuffer);
      const maskArray = Array.from(maskBuffer);

      const obstacleLabels = obstacles.map((o) => o.label).join(", ");
      const inpaintPrompt =
        prompt ||
        `Clean natural terrain, remove ${obstacleLabels}. Replace with natural ground: gravel, dirt, or grass matching the surrounding area. Photorealistic, seamless.`;

      // Call Cloudflare Workers AI
      const cfResponse = await fetch(CF_INPAINT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: inpaintPrompt,
          negative_prompt: "rocks, stones, debris, obstacles, objects, artifacts, text, watermark",
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
        throw new Error(`Cloudflare AI error ${cfResponse.status}: ${errText.slice(0, 200)}`);
      }

      // Response is raw PNG bytes
      const pngBuffer = Buffer.from(await cfResponse.arrayBuffer());
      const resultBase64 = "data:image/png;base64," + pngBuffer.toString("base64");

      console.log(`[Inpaint] Success! Result size: ${pngBuffer.length} bytes`);
      return { imageBase64: resultBase64 };
    }),
});
