/**
 * Inpainting tRPC Router
 * ============================================================================
 * Receives a base64 image + obstacle bounding boxes, creates a mask,
 * calls OpenAI DALL-E 2 edit endpoint, returns the cleaned image.
 *
 * Called via: trpc.inpaint.cleanTerrain.mutate({ imageBase64, obstacles })
 *
 * Uses pngjs (pure JavaScript, no native dependencies) for mask generation.
 */
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Readable } from "stream";
import { PNG } from "pngjs";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

// Initialize OpenAI client using the environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const ObstacleSchema = z.object({
  x: z.number(),       // center x (0-800 internal coords)
  y: z.number(),       // center y (0-600 internal coords)
  width: z.number(),   // width in internal coords
  height: z.number(),  // height in internal coords
  label: z.string(),
});

/**
 * Convert base64 data URL to Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/**
 * Create a mask PNG using pngjs (pure JS, no native deps).
 * DALL-E 2 requires: transparent alpha = inpaint, opaque = keep
 */
function createMask(
  imageWidth: number,
  imageHeight: number,
  obstacles: z.infer<typeof ObstacleSchema>[]
): Buffer {
  const png = new PNG({ width: imageWidth, height: imageHeight, filterType: -1 });

  // Fill with fully opaque black = keep everything
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const idx = (imageWidth * y + x) << 2;
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 255; // fully opaque = keep
    }
  }

  // Scale from internal 800x600 to real image dimensions
  const scaleX = imageWidth / 800;
  const scaleY = imageHeight / 600;

  // Mark obstacle areas as fully transparent = inpaint here
  for (const obs of obstacles) {
    const cx = obs.x * scaleX;
    const cy = obs.y * scaleY;
    const hw = (obs.width * scaleX) / 2;
    const hh = (obs.height * scaleY) / 2;
    const padX = hw * 0.15;
    const padY = hh * 0.15;

    const x1 = Math.max(0, Math.floor(cx - hw - padX));
    const y1 = Math.max(0, Math.floor(cy - hh - padY));
    const x2 = Math.min(imageWidth, Math.ceil(cx + hw + padX));
    const y2 = Math.min(imageHeight, Math.ceil(cy + hh + padY));

    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        const idx = (imageWidth * py + px) << 2;
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0; // fully transparent = inpaint here
      }
    }
  }

  return PNG.sync.write(png);
}

/**
 * Resize a PNG buffer to targetSize x targetSize using nearest-neighbor sampling.
 * DALL-E 2 requires square images: 256x256, 512x512, or 1024x1024.
 */
function resizePng(inputBuffer: Buffer, targetSize: number): Buffer {
  const src = PNG.sync.read(inputBuffer);
  const dst = new PNG({ width: targetSize, height: targetSize, filterType: -1 });

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.floor((x / targetSize) * src.width);
      const srcY = Math.floor((y / targetSize) * src.height);
      const srcIdx = (src.width * srcY + srcX) << 2;
      const dstIdx = (targetSize * y + x) << 2;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3] ?? 255;
    }
  }

  return PNG.sync.write(dst);
}

export const inpaintRouter = router({
  cleanTerrain: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        obstacles: z.array(ObstacleSchema),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64, obstacles } = input;

      if (!obstacles.length) {
        // Nothing to inpaint, return original
        return { imageBase64 };
      }

      console.log(`[Inpaint] Processing ${obstacles.length} obstacles...`);

      // Parse original image to get dimensions
      const origBuffer = base64ToBuffer(imageBase64);
      const origPng = PNG.sync.read(origBuffer);
      const { width: origW, height: origH } = origPng;

      // Create mask at original dimensions
      const maskBuffer = createMask(origW, origH, obstacles);

      // Resize both image and mask to 1024x1024 (DALL-E 2 requirement)
      const imageBuffer1024 = resizePng(origBuffer, 1024);
      const maskBuffer1024 = resizePng(maskBuffer, 1024);

      // Convert to OpenAI File objects
      const imageFile = await toFile(
        Readable.from(imageBuffer1024),
        "image.png",
        { type: "image/png" }
      );
      const maskFile = await toFile(
        Readable.from(maskBuffer1024),
        "mask.png",
        { type: "image/png" }
      );

      const obstacleLabels = obstacles.map((o) => o.label).join(", ");

      const response = await openai.images.edit({
        model: "dall-e-2",
        image: imageFile,
        mask: maskFile,
        prompt: `Clean empty outdoor garden/yard terrain. Remove ${obstacleLabels}. Replace with natural ground: gravel, dirt, or grass matching the surrounding area. Keep walls, fences, and background unchanged. Photorealistic.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const resultBase64 = response.data?.[0]?.b64_json;
      if (!resultBase64) {
        throw new Error("No image returned from OpenAI");
      }

      console.log(`[Inpaint] Success!`);
      return { imageBase64: `data:image/png;base64,${resultBase64}` };
    }),
});
