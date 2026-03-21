/**
 * Inpainting API
 * ============================================================================
 * Receives a base64 image + obstacle bounding box, creates a mask,
 * calls OpenAI DALL-E 2 edit endpoint, returns the cleaned image.
 *
 * POST /api/inpaint
 * Body: { imageBase64: string, obstacles: Array<{x,y,width,height,label}> }
 * Returns: { imageBase64: string }
 *
 * Uses pngjs (pure JavaScript, no native dependencies) for mask generation.
 * This avoids the node-canvas native compilation issues on Render.
 */
import express from "express";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Readable } from "stream";
import { PNG } from "pngjs";

const router = express.Router();

// Initialize OpenAI client using the environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

interface ObstacleBox {
  x: number;       // center x (0-800 internal coords)
  y: number;       // center y (0-600 internal coords)
  width: number;   // width in internal coords
  height: number;  // height in internal coords
  label: string;
}

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
  obstacles: ObstacleBox[]
): Buffer {
  const png = new PNG({ width: imageWidth, height: imageHeight, filterType: -1 });

  // Fill with fully opaque black = keep everything
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const idx = (imageWidth * y + x) << 2;
      png.data[idx] = 0;       // R
      png.data[idx + 1] = 0;   // G
      png.data[idx + 2] = 0;   // B
      png.data[idx + 3] = 255; // A = fully opaque (keep)
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

    // Add 15% padding for full coverage
    const padX = hw * 0.15;
    const padY = hh * 0.15;

    const x1 = Math.max(0, Math.floor(cx - hw - padX));
    const y1 = Math.max(0, Math.floor(cy - hh - padY));
    const x2 = Math.min(imageWidth, Math.ceil(cx + hw + padX));
    const y2 = Math.min(imageHeight, Math.ceil(cy + hh + padY));

    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        const idx = (imageWidth * py + px) << 2;
        png.data[idx] = 0;     // R
        png.data[idx + 1] = 0; // G
        png.data[idx + 2] = 0; // B
        png.data[idx + 3] = 0; // A = fully transparent (inpaint here)
      }
    }
  }

  return PNG.sync.write(png);
}

/**
 * Resize a PNG buffer to targetSize x targetSize using nearest-neighbor sampling.
 * DALL-E 2 requires square images: 256x256, 512x512, or 1024x1024.
 */
function resizePng(
  inputBuffer: Buffer,
  targetSize: number
): Buffer {
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

/**
 * Buffer to OpenAI File
 */
async function bufferToFile(buffer: Buffer, filename: string): Promise<ReturnType<typeof toFile>> {
  const stream = Readable.from(buffer);
  return toFile(stream, filename, { type: "image/png" });
}

router.post("/", async (req, res) => {
  try {
    const { imageBase64, obstacles } = req.body as {
      imageBase64: string;
      obstacles: ObstacleBox[];
    };

    if (!imageBase64 || !obstacles || obstacles.length === 0) {
      res.status(400).json({ error: "imageBase64 and obstacles are required" });
      return;
    }

    console.log(`[Inpaint] Processing ${obstacles.length} obstacles...`);

    // 1. Parse original image to get dimensions
    const origBuffer = base64ToBuffer(imageBase64);
    const origPng = PNG.sync.read(origBuffer);
    const { width: origW, height: origH } = origPng;

    // 2. Create mask at original dimensions
    const maskBuffer = createMask(origW, origH, obstacles);

    // 3. Resize both image and mask to 1024x1024 (DALL-E 2 requirement)
    const imageBuffer1024 = resizePng(origBuffer, 1024);
    const maskBuffer1024 = resizePng(maskBuffer, 1024);

    // 4. Call OpenAI DALL-E 2 edit
    const imageFile = await bufferToFile(imageBuffer1024, "image.png");
    const maskFile = await bufferToFile(maskBuffer1024, "mask.png");

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

    console.log(`[Inpaint] Success! Returning cleaned image.`);

    res.json({
      imageBase64: `data:image/png;base64,${resultBase64}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Inpaint] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
