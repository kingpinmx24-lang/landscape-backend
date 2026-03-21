/**
 * Inpainting API
 * ============================================================================
 * Receives a base64 image + obstacle bounding box, creates a mask,
 * calls OpenAI DALL-E 2 edit endpoint, returns the cleaned image.
 *
 * POST /api/inpaint
 * Body: { imageBase64: string, obstacles: Array<{x,y,width,height,label}> }
 * Returns: { imageBase64: string }
 */

import express from "express";
import { createCanvas, loadImage } from "canvas";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Readable } from "stream";

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
 * Create a mask image: white = area to inpaint, black = keep
 * DALL-E 2 requires: transparent = inpaint, opaque = keep
 * We use PNG with alpha channel: alpha=0 (transparent) = inpaint area
 */
async function createMask(
  imageBase64: string,
  obstacles: ObstacleBox[]
): Promise<Buffer> {
  // Load original image to get real dimensions
  const imgBuffer = base64ToBuffer(imageBase64);
  const img = await loadImage(imgBuffer);
  const W = img.width;
  const H = img.height;

  // Create canvas with same dimensions
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fill with black (opaque = keep everything)
  ctx.fillStyle = "rgba(0, 0, 0, 255)";
  ctx.fillRect(0, 0, W, H);

  // For each obstacle, make that area transparent (= inpaint)
  // Scale from internal 800x600 to real image dimensions
  const scaleX = W / 800;
  const scaleY = H / 600;

  obstacles.forEach((obs) => {
    const x = (obs.x - obs.width / 2) * scaleX;
    const y = (obs.y - obs.height / 2) * scaleY;
    const w = obs.width * scaleX;
    const h = obs.height * scaleY;

    // Add 15% padding to ensure full coverage
    const padX = w * 0.15;
    const padY = h * 0.15;

    ctx.clearRect(
      Math.max(0, x - padX),
      Math.max(0, y - padY),
      Math.min(W - Math.max(0, x - padX), w + padX * 2),
      Math.min(H - Math.max(0, y - padY), h + padY * 2)
    );
  });

  return canvas.toBuffer("image/png");
}

/**
 * Resize image to 1024x1024 as required by DALL-E 2 edit
 */
async function resizeTo1024(imageBase64: string): Promise<Buffer> {
  const imgBuffer = base64ToBuffer(imageBase64);
  const img = await loadImage(imgBuffer);

  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, 1024, 1024);

  return canvas.toBuffer("image/png");
}

/**
 * Resize mask to 1024x1024
 */
async function resizeMaskTo1024(maskBuffer: Buffer): Promise<Buffer> {
  const img = await loadImage(maskBuffer);
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, 1024, 1024);
  return canvas.toBuffer("image/png");
}

/**
 * Buffer to OpenAI File
 */
async function bufferToFile(buffer: Buffer, filename: string): Promise<any> {
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
      return res.status(400).json({ error: "imageBase64 and obstacles are required" });
    }

    console.log(`[Inpaint] Processing ${obstacles.length} obstacles...`);

    // 1. Create mask
    const maskBuffer = await createMask(imageBase64, obstacles);

    // 2. Resize both image and mask to 1024x1024 (DALL-E 2 requirement)
    const imageBuffer1024 = await resizeTo1024(imageBase64);
    const maskBuffer1024 = await resizeMaskTo1024(maskBuffer);

    // 3. Call OpenAI DALL-E 2 edit
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

    return res.json({
      imageBase64: `data:image/png;base64,${resultBase64}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Inpaint] Error:", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;
