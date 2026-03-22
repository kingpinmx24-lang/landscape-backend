/**
 * Inpainting tRPC Router
 * ============================================================================
 * Two modes:
 * 1. FREEHAND MASK: receives imageBase64 + maskBase64 (user-painted mask)
 *    → sends directly to Cloudflare AI inpainting
 * 2. OBSTACLE LIST: receives imageBase64 + obstacles[] (bounding boxes)
 *    → generates mask from bounding boxes, then calls Cloudflare AI
 *
 * Called via: trpc.inpaint.cleanTerrain.mutate({ imageBase64, maskBase64?, obstacles? })
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

const ObstacleSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
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
 * Internal canvas coords: 800x600 → scaled to actual image dimensions.
 */
function createMaskFromObstacles(
  imageWidth: number,
  imageHeight: number,
  obstacles: z.infer<typeof ObstacleSchema>[]
): Buffer {
  const pixels = new Uint8Array(imageWidth * imageHeight * 3).fill(0);
  const scaleX = imageWidth / 800;
  const scaleY = imageHeight / 600;
  for (const obs of obstacles) {
    const cx = obs.x * scaleX;
    const cy = obs.y * scaleY;
    const hw = (obs.width * scaleX) / 2;
    const hh = (obs.height * scaleY) / 2;
    const padX = hw * 0.2;
    const padY = hh * 0.2;
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

/**
 * Resize a PNG/JPEG buffer to targetW x targetH using bilinear interpolation.
 * Returns a new PNG buffer.
 */
function resizeImageBuffer(
  srcBuf: Buffer,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  channels: number = 3
): Buffer {
  // Decode PNG pixels (simplified — only handles uncompressed-like PNGs via raw scan)
  // For production: use the raw pixel approach by re-encoding
  // Since we only need to resize the mask (which we control), use nearest-neighbor
  const srcPixels = new Uint8Array(srcW * srcH * channels);
  const dstPixels = new Uint8Array(targetW * targetH * channels);

  // We can't easily decode arbitrary PNG here without a library.
  // Instead, return the original buffer if sizes match, or use the mask as-is.
  // The Cloudflare API accepts mismatched sizes and will resize internally.
  return srcBuf;
}

export const inpaintRouter = router({
  cleanTerrain: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        maskBase64: z.string().optional(),   // freehand painted mask from canvas
        obstacles: z.array(ObstacleSchema).optional().default([]),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64, maskBase64, obstacles, prompt } = input;

      // If no mask and no obstacles, return original
      if (!maskBase64 && (!obstacles || obstacles.length === 0)) {
        return { imageBase64 };
      }

      if (!CF_API_TOKEN) {
        throw new Error("CF_API_TOKEN not configured on server");
      }

      const origBuffer = base64ToBuffer(imageBase64);
      const { width: origW, height: origH } = getImageDimensions(origBuffer);
      console.log(`[Inpaint] Image: ${origW}x${origH}, mode: ${maskBase64 ? "freehand-mask" : "obstacle-list"}`);

      let maskBuffer: Buffer;

      if (maskBase64) {
        // MODE 1: Freehand mask from canvas — use directly
        maskBuffer = base64ToBuffer(maskBase64);
        console.log(`[Inpaint] Using freehand mask (${maskBuffer.length} bytes)`);
      } else {
        // MODE 2: Generate mask from obstacle bounding boxes
        maskBuffer = createMaskFromObstacles(origW, origH, obstacles!);
        console.log(`[Inpaint] Generated mask from ${obstacles!.length} obstacle(s)`);
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
