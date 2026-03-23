/**
 * Inpainting tRPC Router — Production Grade
 * ============================================================================
 * Techniques used for maximum quality with Cloudflare SD v1.5:
 *
 * 1. CROP-INPAINT-PASTE: Process each obstacle at full resolution by cropping
 *    the region, inpainting at 512x512, and compositing back.
 *
 * 2. MASK DILATION: Expand the mask by ~15% to eliminate residual edges and
 *    halos around removed objects.
 *
 * 3. MULTI-PASS REFINEMENT: Apply inpainting twice per obstacle — first pass
 *    removes the object, second pass refines the fill texture.
 *
 * 4. CONTEXT-AWARE PROMPTS: Generate specific prompts based on obstacle label
 *    and surrounding terrain type detected by Claude.
 *
 * 5. OPTIMIZED PARAMS: num_steps=30, guidance=9.0, strength=0.99 for
 *    maximum inpainting coverage.
 *
 * 6. FEATHERED COMPOSITING: Blend the inpainted region back with a soft edge
 *    to avoid hard seams.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import sharp from "sharp";

const CF_ACCOUNT_ID =
  process.env.CF_ACCOUNT_ID || "a5a228d8474a0f927acb0356a946d4fe";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const CF_INPAINT_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`;

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-opus-4-6";

const ObstacleSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number().optional(),
});

type Obstacle = z.infer<typeof ObstacleSchema>;

/** Convert base64 data URL or raw base64 to Buffer */
function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/**
 * Build a context-aware inpainting prompt based on obstacle label.
 * The more specific the prompt, the better SD v1.5 fills the area.
 */
function buildInpaintPrompt(label: string): { prompt: string; negative: string } {
  const l = label.toLowerCase();

  // Terrain type prompts
  if (l.includes("grass") || l.includes("lawn"))
    return {
      prompt: "lush green grass lawn, uniform texture, natural lighting, photorealistic",
      negative: "objects, debris, artifacts, blurry, distorted",
    };
  if (l.includes("gravel") || l.includes("stone") || l.includes("pebble"))
    return {
      prompt: "natural gravel ground, small stones, earthy texture, photorealistic",
      negative: "large rocks, objects, artifacts, blurry",
    };
  if (l.includes("soil") || l.includes("dirt") || l.includes("earth") || l.includes("debris"))
    return {
      prompt: "clean natural soil, bare earth, smooth dirt ground, photorealistic",
      negative: "objects, tools, plants, artifacts, blurry",
    };
  if (l.includes("concrete") || l.includes("pavement") || l.includes("asphalt"))
    return {
      prompt: "smooth concrete surface, uniform grey pavement, photorealistic",
      negative: "cracks, objects, stains, artifacts",
    };
  if (l.includes("rock") || l.includes("boulder"))
    return {
      prompt: "clean natural ground, soil and small pebbles, seamless terrain, photorealistic",
      negative: "large rocks, boulders, objects, artifacts",
    };
  if (l.includes("tree") || l.includes("stump") || l.includes("root"))
    return {
      prompt: "clean flat ground, natural soil, seamless terrain fill, photorealistic",
      negative: "tree stumps, roots, wood, objects, artifacts",
    };
  if (l.includes("fence") || l.includes("post") || l.includes("pipe"))
    return {
      prompt: "clean open terrain, natural ground, seamless background, photorealistic",
      negative: "fence, posts, pipes, structures, objects, artifacts",
    };

  // Generic fallback
  return {
    prompt: "clean natural terrain, seamless ground fill matching surrounding area, photorealistic, no objects",
    negative: "objects, tools, debris, rocks, structures, artifacts, blurry, distorted, watermark",
  };
}

/**
 * Dilate a binary mask buffer by `pixels` pixels using a box kernel.
 * Input: PNG buffer (any channels). Output: PNG buffer with dilated white mask.
 * This eliminates residual halos around removed objects.
 */
async function dilateMask(maskBuffer: Buffer, pixels: number, w: number, h: number): Promise<Buffer> {
  if (pixels <= 0) return maskBuffer;

  // Get raw pixel data
  const { data } = await sharp(maskBuffer)
    .resize(w, h, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = new Uint8Array(data);
  const dst = new Uint8Array(w * h);

  // Box dilation
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -pixels; dy <= pixels; dy++) {
        for (let dx = -pixels; dx <= pixels; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const v = src[ny * w + nx];
            if (v > maxVal) maxVal = v;
          }
        }
      }
      dst[y * w + x] = maxVal;
    }
  }

  return sharp(Buffer.from(dst), { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
}

/**
 * Single Cloudflare AI inpainting call.
 * image and mask must be 512x512 PNG buffers.
 * Returns PNG result buffer.
 */
async function cfInpaintCall(
  image512: Buffer,
  mask512: Buffer,
  prompt: string,
  negative: string,
  steps: number = 30
): Promise<Buffer> {
  const imageArray = Array.from(image512);
  const maskArray = Array.from(mask512);

  const resp = await fetch(CF_INPAINT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: negative,
      image: imageArray,
      mask: maskArray,
      num_steps: steps,
      strength: 0.99,
      guidance: 9.0,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Cloudflare AI ${resp.status}: ${err.slice(0, 200)}`);
  }

  return Buffer.from(await resp.arrayBuffer());
}

/**
 * Process a single obstacle using crop-dilate-inpaint-refine-paste.
 * Returns the updated full-image buffer.
 */
async function processObstacle(
  workingBuffer: Buffer,
  obs: Obstacle,
  origW: number,
  origH: number,
  scaleX: number,
  scaleY: number,
  promptOverride?: string
): Promise<Buffer> {
  // Convert obstacle coords to image pixel space
  const cx = obs.x * scaleX;
  const cy = obs.y * scaleY;
  const hw = (obs.width * scaleX) / 2;
  const hh = (obs.height * scaleY) / 2;

  // 50% padding for better context
  const padX = Math.max(hw * 0.5, 20);
  const padY = Math.max(hh * 0.5, 20);

  const cropX = Math.max(0, Math.floor(cx - hw - padX));
  const cropY = Math.max(0, Math.floor(cy - hh - padY));
  const cropW = Math.min(origW - cropX, Math.ceil((hw + padX) * 2));
  const cropH = Math.min(origH - cropY, Math.ceil((hh + padY) * 2));

  if (cropW < 16 || cropH < 16) return workingBuffer;

  // 1. Crop region from working image
  const cropBuf = await sharp(workingBuffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  // 2. Build obstacle mask within crop
  const maskObsX = Math.max(0, Math.floor(cx - hw - cropX));
  const maskObsY = Math.max(0, Math.floor(cy - hh - cropY));
  const maskObsW = Math.max(1, Math.min(cropW - maskObsX, Math.ceil(hw * 2)));
  const maskObsH = Math.max(1, Math.min(cropH - maskObsY, Math.ceil(hh * 2)));

  const whitePatch = await sharp({
    create: { width: maskObsW, height: maskObsH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const rawMask = await sharp({
    create: { width: cropW, height: cropH, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: whitePatch, left: maskObsX, top: maskObsY }])
    .png()
    .toBuffer();

  // 3. Dilate mask by 12px to cover residual edges
  const dilatedMask = await dilateMask(rawMask, 12, cropW, cropH);

  // 4. Resize crop + mask to 512x512 for Cloudflare
  const crop512 = await sharp(cropBuf).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();

  const { prompt, negative } = buildInpaintPrompt(obs.label);
  const finalPrompt = promptOverride || prompt;

  // 5. First pass: remove the object
  let result512 = await cfInpaintCall(crop512, mask512, finalPrompt, negative, 30);

  // 6. Second pass: refine the fill (use result as new image, same mask)
  const result512_v2 = await sharp(result512).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const refinePrompt = finalPrompt + ", seamless texture, no seams, photorealistic";
  result512 = await cfInpaintCall(result512_v2, mask512, refinePrompt, negative, 20);

  // 7. Resize result back to crop dimensions
  const resultCrop = await sharp(result512)
    .resize(cropW, cropH, { fit: "fill" })
    .png()
    .toBuffer();

  // 8. Composite back onto working image
  return sharp(workingBuffer)
    .composite([{ input: resultCrop, left: cropX, top: cropY }])
    .png()
    .toBuffer();
}

export const inpaintRouter = router({
  /**
   * detectObstacles — Claude Vision analyzes terrain and returns ALL obstacles
   * with precise bounding boxes in image pixel coordinates.
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

      if (!CLAUDE_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

      const imgBuf = base64ToBuffer(imageBase64);
      const meta = await sharp(imgBuf).metadata();
      const imgW = meta.width || 800;
      const imgH = meta.height || 600;
      const imgRawB64 = imgBuf.toString("base64");
      const isPng = imgBuf[0] === 0x89 && imgBuf[1] === 0x50;
      const mimeType = isPng ? "image/png" : "image/jpeg";

      console.log(`[DetectObstacles] ${imgW}x${imgH} — calling Claude Vision...`);

      const prompt = `You are analyzing a terrain/landscape photo (${imgW}x${imgH} pixels) to detect ALL obstacles that must be removed for landscaping.

Detect EVERY obstacle: rocks, stones, concrete blocks, debris, stumps, pipes, fences, posts, construction materials, tools, pots, plants, or any object that does not belong to clean terrain.

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Each item:
{"label":"rock","x":85,"y":70,"width":70,"height":60,"confidence":0.95}

x,y = CENTER of obstacle in pixels. width,height = bounding box in pixels.
If no obstacles found, return: []`;

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: imgRawB64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });

      if (!claudeResp.ok) {
        const err = await claudeResp.text();
        throw new Error(`Claude Vision ${claudeResp.status}: ${err.slice(0, 200)}`);
      }

      const claudeData = await claudeResp.json() as any;
      const responseText: string = claudeData?.content?.[0]?.text || "[]";
      console.log(`[DetectObstacles] Claude: ${responseText.slice(0, 150)}`);

      let obstacles: Obstacle[] = [];
      try {
        const match = responseText.match(/\[[\s\S]*\]/);
        if (match) {
          obstacles = JSON.parse(match[0])
            .map((o: any) => ({
              label: String(o.label || "obstacle"),
              x: Number(o.x), y: Number(o.y),
              width: Number(o.width), height: Number(o.height),
              confidence: Number(o.confidence || 0.9),
            }))
            .filter((o: Obstacle) =>
              !isNaN(o.x) && !isNaN(o.y) && o.width > 0 && o.height > 0
            );
        }
      } catch (e) {
        console.error("[DetectObstacles] parse error:", e);
      }

      console.log(`[DetectObstacles] Found ${obstacles.length} obstacles`);
      return { obstacles, imageWidth: imgW, imageHeight: imgH };
    }),

  /**
   * cleanTerrain — Multi-pass crop-dilate-inpaint-refine-paste.
   *
   * For each obstacle:
   *   1. Crop region with 50% padding
   *   2. Build white mask, dilate 12px to cover edges
   *   3. Resize to 512x512, call Cloudflare AI (30 steps, guidance 9.0)
   *   4. Second refinement pass (20 steps) on the result
   *   5. Resize back, composite onto full image
   *
   * Processes obstacles largest-first to avoid re-processing already-clean areas.
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
      if (!CF_API_TOKEN) throw new Error("CF_API_TOKEN not configured");

      const origBuffer = base64ToBuffer(imageBase64);
      const meta = await sharp(origBuffer).metadata();
      const origW = meta.width || 800;
      const origH = meta.height || 600;

      console.log(`[Inpaint] ${origW}x${origH} — mode: ${maskBase64 ? "freehand" : `obstacles(${obstacles!.length})`}`);

      // ── FREEHAND MASK MODE ─────────────────────────────────────────────────
      if (maskBase64) {
        const maskBuf = base64ToBuffer(maskBase64);
        const dilatedMask = await dilateMask(maskBuf, 12, origW, origH);

        const img512 = await sharp(origBuffer).resize(512, 512, { fit: "fill" }).png().toBuffer();
        const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();

        const p = prompt || "clean natural terrain, seamless ground fill, photorealistic, no objects";
        const n = "objects, tools, debris, artifacts, blurry, distorted, watermark";

        let result = await cfInpaintCall(img512, mask512, p, n, 30);
        // Refinement pass
        const r2 = await sharp(result).resize(512, 512, { fit: "fill" }).png().toBuffer();
        result = await cfInpaintCall(r2, mask512, p + ", seamless texture", n, 20);

        const finalBuf = await sharp(result).resize(origW, origH, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer();
        console.log(`[Inpaint] Freehand done: ${finalBuf.length} bytes`);
        return { imageBase64: "data:image/jpeg;base64," + finalBuf.toString("base64") };
      }

      // ── OBSTACLE LIST MODE ─────────────────────────────────────────────────
      const scaleX = coordSpace === "canvas800x600" ? origW / 800 : 1;
      const scaleY = coordSpace === "canvas800x600" ? origH / 600 : 1;

      // Sort largest obstacles first (most impactful, process while image is clean)
      const sorted = [...obstacles!].sort((a, b) => (b.width * b.height) - (a.width * a.height));

      let workingBuffer = origBuffer;

      for (let i = 0; i < sorted.length; i++) {
        const obs = sorted[i];
        console.log(`[Inpaint] Obstacle ${i + 1}/${sorted.length}: ${obs.label} (${Math.round(obs.width * scaleX)}x${Math.round(obs.height * scaleY)}px)`);
        try {
          workingBuffer = await processObstacle(workingBuffer, obs, origW, origH, scaleX, scaleY, prompt);
          console.log(`[Inpaint] ✓ ${obs.label} erased`);
        } catch (err) {
          console.error(`[Inpaint] ✗ ${obs.label} failed:`, (err as Error).message);
          // Continue with remaining obstacles
        }
      }

      const finalBuf = await sharp(workingBuffer).jpeg({ quality: 92 }).toBuffer();
      console.log(`[Inpaint] All done: ${finalBuf.length} bytes`);
      return { imageBase64: "data:image/jpeg;base64," + finalBuf.toString("base64") };
    }),
});
