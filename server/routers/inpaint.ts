/**
 * Inpainting tRPC Router — Production Grade v2
 * ============================================================================
 * Supports two modes:
 *
 * 1. FREEHAND MASK MODE (maskBase64 provided):
 *    User painted a mask with the brush tool. We crop each masked region,
 *    inpaint it, and paste back. Single pass optimized for Vercel 60s timeout.
 *
 * 2. OBSTACLE LIST MODE (obstacles[] provided):
 *    Claude detected bounding boxes. We process each one with crop-inpaint-paste.
 *
 * 3. COMBINED MODE (both provided):
 *    We merge the freehand mask with obstacle bounding boxes into one mask.
 *
 * Techniques:
 *  - CROP-INPAINT-PASTE: Process at full resolution, inpaint at 512x512
 *  - MASK DILATION: Expand mask 15px to eliminate halos
 *  - CONTEXT-AWARE PROMPTS: Specific prompts per obstacle type
 *  - SINGLE PASS: Optimized for Vercel 60s function timeout
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import sharp from "sharp";

// Read env vars lazily (at call time, not module load time)
function getCFToken(): string {
  return process.env.CF_API_TOKEN || "";
}
function getCFAccountId(): string {
  return process.env.CF_ACCOUNT_ID || "a5a228d8474a0f927acb0356a946d4fe";
}
function getCFUrl(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`;
}
function getCFTxt2ImgUrl(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
}

// High-quality Unsplash fallback images per plant type (instant, no AI needed)
const PLANT_FALLBACK_IMAGES: Record<string, string> = {
  palm:        "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=85",
  tree:        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=85",
  shrub:       "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  flower:      "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85",
  grass:       "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=85",
  succulent:   "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&q=85",
  groundcover: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  vine:        "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  cactus:      "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&q=85",
  fern:        "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  bamboo:      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=85",
  rose:        "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85",
  bougainvillea: "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85",
};

// Generate plant image via Cloudflare AI text-to-image
async function cfGeneratePlantImage(plantName: string, plantType: string): Promise<string | null> {
  const token = getCFToken();
  if (!token) return null;
  const prompt = `professional landscape photography, isolated ${plantName} ${plantType} plant on transparent background, photorealistic, high quality, nursery catalog photo, white background, detailed leaves`;
  try {
    const response = await fetch(getCFTxt2ImgUrl(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, num_steps: 20, width: 512, height: 512 }),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return 'data:image/png;base64,' + buffer.toString('base64');
  } catch {
    return null;
  }
}
function getClaudeKey(): string {
  return process.env.ANTHROPIC_API_KEY || "";
}

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
 * STRICT inpainting prompts — ONLY erase and fill with bare terrain texture.
 * NEVER add plants, trees, vegetation, or any new objects.
 * The user decides what to place after cleaning.
 */
function buildInpaintPrompt(label: string): { prompt: string; negative: string } {
  const l = label.toLowerCase();

  // Universal strict negative — forbid any new content being generated
  const STRICT_NEGATIVE =
    "plants, trees, bushes, shrubs, flowers, vegetation, grass blades, leaves, branches, " +
    "rocks, boulders, stones, gravel, sand, water, puddles, shadows, people, animals, " +
    "furniture, pots, tools, construction materials, debris, pipes, fences, posts, " +
    "structures, buildings, objects, artifacts, blurry, distorted, overexposed, " +
    "watermark, text, logo, painting, illustration, cartoon, CGI, generated content";

  // For every obstacle type: fill with bare flat terrain matching surrounding pixels
  const BASE_PROMPT =
    "bare flat empty soil ground, seamless texture perfectly matching surrounding area, " +
    "photorealistic, neutral bare earth, empty terrain ready for landscaping, " +
    "no objects, no plants, no vegetation, inpaint only the masked area";

  if (l.includes("tree") || l.includes("stump") || l.includes("root") || l.includes("arbol") || l.includes("árbol") || l.includes("tronco"))
    return {
      prompt: BASE_PROMPT + ", remove tree completely, fill with bare dirt ground",
      negative: STRICT_NEGATIVE + ", tree, stump, root, wood, trunk",
    };

  if (l.includes("fence") || l.includes("post") || l.includes("pipe") || l.includes("barda") || l.includes("reja") || l.includes("malla"))
    return {
      prompt: BASE_PROMPT + ", remove fence completely, fill with bare open ground",
      negative: STRICT_NEGATIVE + ", fence, post, pipe, wire, metal, structure",
    };

  if (l.includes("concrete") || l.includes("pavement") || l.includes("asphalt") || l.includes("concreto") || l.includes("cemento"))
    return {
      prompt: BASE_PROMPT + ", remove concrete completely, fill with bare dirt ground",
      negative: STRICT_NEGATIVE + ", concrete, pavement, asphalt, cement, slab",
    };

  if (l.includes("rock") || l.includes("boulder") || l.includes("piedra") || l.includes("stone"))
    return {
      prompt: BASE_PROMPT + ", remove rocks completely, fill with bare flat dirt",
      negative: STRICT_NEGATIVE + ", rock, boulder, stone, pebble",
    };

  // Default — any obstacle type: erase and fill with bare terrain
  return {
    prompt: BASE_PROMPT + ", erase obstacle completely, fill with bare empty ground",
    negative: STRICT_NEGATIVE,
  };
}

/**
 * Dilate a binary mask buffer by `pixels` pixels using a box kernel.
 */
async function dilateMask(maskBuffer: Buffer, pixels: number, w: number, h: number): Promise<Buffer> {
  if (pixels <= 0) return maskBuffer;

  const { data } = await sharp(maskBuffer)
    .resize(w, h, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = new Uint8Array(data);
  const dst = new Uint8Array(w * h);

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
 * Single Cloudflare AI inpainting call with 3x auto-retry and exponential backoff.
 * image and mask must be 512x512 PNG buffers.
 * Returns PNG result buffer.
 */
async function cfInpaintCall(
  image512: Buffer,
  mask512: Buffer,
  prompt: string,
  negative: string,
  steps: number = 25,
  strength: number = 0.55,  // LOW strength = preserve surrounding texture, erase obstacle only
  guidance: number = 4.0    // LOW guidance = stay close to original image, no hallucination
): Promise<Buffer> {
  const token = getCFToken();
  if (!token) throw new Error("CF_API_TOKEN not configured — contact admin");

  const imageArray = Array.from(image512);
  const maskArray = Array.from(mask512);

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CF Inpaint] Attempt ${attempt}/${MAX_RETRIES}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 50_000); // 50s timeout per attempt

      let resp: Response;
      try {
        resp = await fetch(getCFUrl(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: negative,
            image: imageArray,
            mask: maskArray,
            num_steps: steps,
            strength,
            guidance,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!resp.ok) {
        const errText = await resp.text();
        // 429 = rate limit, 503 = overloaded — retry
        if ((resp.status === 429 || resp.status === 503 || resp.status >= 500) && attempt < MAX_RETRIES) {
          lastError = new Error(`CF ${resp.status}: ${errText.slice(0, 200)}`);
          console.warn(`[CF Inpaint] Attempt ${attempt} failed (${resp.status}), retrying in ${attempt * 2}s...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        throw new Error(`Cloudflare AI error ${resp.status}: ${errText.slice(0, 300)}`);
      }

      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 1000) {
        if (attempt < MAX_RETRIES) {
          lastError = new Error(`CF returned too-small response: ${buf.length} bytes`);
          console.warn(`[CF Inpaint] Attempt ${attempt} returned tiny response, retrying...`);
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        throw new Error(`Cloudflare AI returned invalid response after ${MAX_RETRIES} attempts`);
      }

      console.log(`[CF Inpaint] ✓ Attempt ${attempt} succeeded (${buf.length} bytes)`);
      return buf;

    } catch (err: any) {
      if (err.name === "AbortError") {
        lastError = new Error(`Cloudflare AI timeout (attempt ${attempt})`);
        console.warn(`[CF Inpaint] Attempt ${attempt} timed out`);
      } else {
        lastError = err;
      }
      if (attempt < MAX_RETRIES) {
        console.warn(`[CF Inpaint] Attempt ${attempt} error: ${lastError?.message}, retrying in ${attempt * 2}s...`);
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }

  throw lastError || new Error("Cloudflare AI failed after 3 attempts");
}

/**
 * Process a single obstacle using crop-dilate-inpaint-paste.
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
  const cx = obs.x * scaleX;
  const cy = obs.y * scaleY;
  const hw = (obs.width * scaleX) / 2;
  const hh = (obs.height * scaleY) / 2;

  // 60% padding for surrounding context
  const padX = Math.max(hw * 0.6, 30);
  const padY = Math.max(hh * 0.6, 30);

  const cropX = Math.max(0, Math.floor(cx - hw - padX));
  const cropY = Math.max(0, Math.floor(cy - hh - padY));
  const cropW = Math.min(origW - cropX, Math.ceil((hw + padX) * 2));
  const cropH = Math.min(origH - cropY, Math.ceil((hh + padY) * 2));

  if (cropW < 16 || cropH < 16) return workingBuffer;

  // 1. Crop region
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

  // 3. Dilate mask 15px
  const dilatedMask = await dilateMask(rawMask, 15, cropW, cropH);

  // 4. Resize to 512x512
  const crop512 = await sharp(cropBuf).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();

  const { prompt, negative } = buildInpaintPrompt(obs.label);
  const finalPrompt = promptOverride || prompt;

  // 5. Single pass inpainting (optimized for Vercel 60s timeout)
  // strength=0.55: low enough to preserve surrounding texture, high enough to erase the obstacle
  // guidance=4.0: low guidance = model stays closer to original image, less hallucination
  const result512 = await cfInpaintCall(crop512, mask512, finalPrompt, negative, 25, 0.55, 4.0);

  // 6. Resize back and composite
  const resultCrop = await sharp(result512)
    .resize(cropW, cropH, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp(workingBuffer)
    .composite([{ input: resultCrop, left: cropX, top: cropY }])
    .png()
    .toBuffer();
}

/**
 * Process a freehand mask by finding bounding boxes of painted regions
 * and processing each one separately (crop-inpaint-paste).
 */
async function processFreehandMask(
  origBuffer: Buffer,
  maskBuf: Buffer,
  origW: number,
  origH: number,
  prompt?: string
): Promise<Buffer> {
  // Resize mask to image dimensions
  const maskResized = await sharp(maskBuf)
    .resize(origW, origH, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const maskData = new Uint8Array(maskResized.data);

  // Find bounding box of all painted pixels
  let minX = origW, minY = origH, maxX = 0, maxY = 0;
  let hasMask = false;

  for (let y = 0; y < origH; y++) {
    for (let x = 0; x < origW; x++) {
      if (maskData[y * origW + x] > 30) {
        hasMask = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasMask) return origBuffer;

  // Add padding around the bounding box
  const padX = Math.max((maxX - minX) * 0.3, 30);
  const padY = Math.max((maxY - minY) * 0.3, 30);

  const cropX = Math.max(0, Math.floor(minX - padX));
  const cropY = Math.max(0, Math.floor(minY - padY));
  const cropW = Math.min(origW - cropX, Math.ceil(maxX - minX + padX * 2));
  const cropH = Math.min(origH - cropY, Math.ceil(maxY - minY + padY * 2));

  if (cropW < 16 || cropH < 16) return origBuffer;

  // Crop image and mask
  const cropBuf = await sharp(origBuffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  // Build mask for the crop region (white where painted, black elsewhere)
  const cropMaskData = new Uint8Array(cropW * cropH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcX = x + cropX;
      const srcY = y + cropY;
      if (srcX < origW && srcY < origH) {
        cropMaskData[y * cropW + x] = maskData[srcY * origW + srcX];
      }
    }
  }

  const cropMaskBuf = await sharp(Buffer.from(cropMaskData), {
    raw: { width: cropW, height: cropH, channels: 1 },
  }).png().toBuffer();

  // Dilate mask 12px
  const dilatedMask = await dilateMask(cropMaskBuf, 12, cropW, cropH);

  // Resize to 512x512
  const crop512 = await sharp(cropBuf).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();

  // Ultra-strict freehand prompt: ONLY fill with terrain texture matching surroundings
  const p = prompt ||
    "bare empty ground, seamless terrain texture perfectly matching surrounding pixels, " +
    "photorealistic soil or grass fill, no objects, no plants, no trees, no people, " +
    "no structures, clean empty land, inpaint only the masked area";
  const n =
    "trees, plants, bushes, shrubs, flowers, vegetation, grass blades, leaves, branches, " +
    "rocks, boulders, stones, people, animals, furniture, buildings, structures, objects, " +
    "debris, pipes, fences, posts, shadows, water, puddles, blurry, distorted, " +
    "overexposed, watermark, text, logo, painting, illustration, cartoon, CGI";

  // strength=0.55: preserves surrounding texture, erases obstacle without hallucinating
  // guidance=4.0: low guidance = stays close to original, less creative generation
  const result512 = await cfInpaintCall(crop512, mask512, p, n, 25, 0.55, 4.0);

  const resultCrop = await sharp(result512)
    .resize(cropW, cropH, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp(origBuffer)
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

      const claudeKey = getClaudeKey();
      if (!claudeKey) throw new Error("ANTHROPIC_API_KEY not configured");

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
          "x-api-key": claudeKey,
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
   * cleanTerrain — Erase obstacles from terrain photo using Cloudflare AI.
   *
   * Modes:
   *  - maskBase64 only: freehand brush mask → crop bounding box → inpaint
   *  - obstacles[] only: process each bounding box individually
   *  - both: process obstacles first, then apply freehand mask
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
        return { imageBase64, success: true, processed: 0, failed: 0, errors: [] };
      }

      const token = getCFToken();
      if (!token) {
        return {
          imageBase64,
          success: false,
          processed: 0,
          failed: 1,
          errors: ["CF_API_TOKEN no configurado — contacta al administrador"],
        };
      }

      let origBuffer: Buffer;
      try {
        origBuffer = base64ToBuffer(imageBase64);
      } catch (e) {
        return { imageBase64, success: false, processed: 0, failed: 1, errors: ["Imagen inválida"] };
      }

      const meta = await sharp(origBuffer).metadata();
      const origW = meta.width || 800;
      const origH = meta.height || 600;

      console.log(`[Inpaint] ${origW}x${origH} — obstacles:${obstacles?.length || 0} mask:${maskBase64 ? "yes" : "no"}`);

      let workingBuffer = origBuffer;
      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // ── OBSTACLE LIST MODE ─────────────────────────────────────────────────
      if (obstacles && obstacles.length > 0) {
        const scaleX = coordSpace === "canvas800x600" ? origW / 800 : 1;
        const scaleY = coordSpace === "canvas800x600" ? origH / 600 : 1;

        // Sort largest obstacles first
        const sorted = [...obstacles].sort((a, b) => (b.width * b.height) - (a.width * a.height));

        for (let i = 0; i < sorted.length; i++) {
          const obs = sorted[i];
          console.log(`[Inpaint] Obstacle ${i + 1}/${sorted.length}: ${obs.label}`);
          try {
            workingBuffer = await processObstacle(workingBuffer, obs, origW, origH, scaleX, scaleY, prompt);
            console.log(`[Inpaint] ✓ ${obs.label} erased`);
            processed++;
          } catch (err) {
            const msg = (err as Error).message;
            console.error(`[Inpaint] ✗ ${obs.label} failed:`, msg);
            errors.push(`${obs.label}: ${msg}`);
            failed++;
            // Continue with remaining obstacles — don't abort
          }
        }
      }

      // ── FREEHAND MASK MODE ─────────────────────────────────────────────────
      if (maskBase64) {
        console.log(`[Inpaint] Processing freehand mask...`);
        try {
          const maskBuf = base64ToBuffer(maskBase64);
          workingBuffer = await processFreehandMask(workingBuffer, maskBuf, origW, origH, prompt);
          console.log(`[Inpaint] ✓ Freehand mask applied`);
          processed++;
        } catch (err) {
          const msg = (err as Error).message;
          console.error(`[Inpaint] ✗ Freehand mask failed:`, msg);
          errors.push(`Pincel: ${msg}`);
          failed++;
          // Return partial result (whatever was processed so far) instead of throwing
        }
      }

      const finalBuf = await sharp(workingBuffer).jpeg({ quality: 92 }).toBuffer();
      console.log(`[Inpaint] Done: processed=${processed} failed=${failed} size=${finalBuf.length}b`);

      return {
        imageBase64: "data:image/jpeg;base64," + finalBuf.toString("base64"),
        success: failed === 0,
        processed,
        failed,
        errors,
      };
    }),

  /**
   * aiDesignChat — AI landscape design assistant
   * Receives user message + terrain image + inventory, returns reply + design actions
   */
  aiDesignChat: publicProcedure
    .input(z.object({
      message: z.string(),
      captureImage: z.string().nullable().optional(),
      canvasObjects: z.array(z.object({
        id: z.string(),
        type: z.string(),
        x: z.number(),
        y: z.number(),
        name: z.string().optional(),
        cost: z.number().optional(),
      })).optional(),
      inventory: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        name: z.string(),
        type: z.string(),
        price: z.number(),
        imageUrl: z.string().optional(),
        stock: z.number().optional(),
      })).optional(),
      appliedMaterials: z.record(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const claudeKey = getClaudeKey();
      if (!claudeKey) {
        return {
          reply: "El asistente de IA no está configurado. Contacta al administrador.",
          actions: [] as any[],
        };
      }

      const { message, captureImage, canvasObjects = [], inventory = [], appliedMaterials = {} } = input;

      const inventoryList = inventory.slice(0, 40).map(i =>
        `- ID:${i.id} | ${i.name} (tipo: ${i.type}, precio: $${i.price}, stock: ${i.stock ?? '?'})`
      ).join('\n');

      const currentObjects = canvasObjects.map(o =>
        `- ${o.name || o.type} en posición (${Math.round(o.x)}, ${Math.round(o.y)})`
      ).join('\n');

      const materialsApplied = Object.values(appliedMaterials).join(', ') || 'ninguno';

      const systemPrompt = `Eres un asistente experto en diseño de paisajismo profesional. Ayudas al usuario a diseñar el terreno de su cliente usando su inventario de plantas y materiales.

El canvas es de 800x600 píxeles. La imagen de fondo es la foto real del terreno. Cuando el usuario te envíe una imagen del terreno, ANÁLIZA visualmente dónde está la tierra/césped/área disponible y coloca los elementos en esas zonas.

Inventario disponible (usa EXACTAMENTE estos IDs):
${inventoryList || 'Sin inventario cargado aún'}

Elementos actuales en el canvas:
${currentObjects || 'Canvas vacío'}

Materiales aplicados actualmente: ${materialsApplied}

== INSTRUCCIONES DE RESPUESTA ==
Cuando el usuario pida colocar plantas, materiales, diseñar el terreno O ELIMINAR elementos:
1. Responde con un mensaje amigable y profesional explicando lo que harás
2. Si ves la foto del terreno, menciona brevemente lo que observas (tierra disponible, área aproximada)
3. Al FINAL de tu respuesta, incluye el bloque de acciones en este formato EXACTO:

<actions>
[
  {"type": "add_plant", "inventoryId": "ID_EXACTO", "x": 400, "y": 300, "name": "Nombre", "plantType": "palm"},
  {"type": "apply_material", "material": "grass", "zone": "full"},
  {"type": "remove_objects", "filter": "all"},
  {"type": "generate_terrain", "description": "lush green zoysia grass lawn covering the entire terrain, photorealistic", "style": "photorealistic", "materialName": "Pasto Zoysia"}
]
</actions>

TIPOS DE ACCIONES DISPONIBLES:
1. add_plant: Coloca planta. Campos: inventoryId (ID exacto o "GENERATE"), x, y, name, plantType (palm/tree/shrub/flower/grass/succulent)
2. apply_material: Aplica material visual. Campos: material, zone
3. remove_objects: Elimina elementos del canvas. Campos: filter ("all"=todos, "border"=borde, "left"/"right"/"center"/"top"/"bottom"=zona, "type:palm"=por tipo, "name:Palmera"=por nombre)
4. generate_terrain: Genera imagen fotorrealista del terreno con IA. Campos:
   - description: descripción detallada en INGLÉS del diseño (ej: "lush green zoysia grass lawn with river stone border path")
   - style: "photorealistic"
   - materialName: nombre EXACTO del material del inventario en español (ej: "Pasto Zoysia", "Piedras de Río") — OBLIGATORIO cuando el usuario mencione un material específico

Materiales válidos: grass (pasto), river_stones (piedras de río), gravel (grava), soil (tierra), mulch, concrete (concreto).
Zonas válidas: left, right, center, top, bottom, border, full.

Posiciones en el canvas (800x600):
- Izquierda: x entre 80-280, y entre 100-500
- Centro: x entre 320-480, y entre 150-450
- Derecha: x entre 520-720, y entre 100-500
- Arriba: y entre 50-200
- Abajo: y entre 400-550
- Distribuye múltiples plantas uniformemente, nunca las pongas en la misma posición exacta

REGLAS IMPORTANTES:
- Usa SOLO plantas del inventario disponible con sus IDs exactos
- Si piden "3 palmeras" y hay palmeras en inventario, genera 3 acciones add_plant con posiciones distintas
- Si piden "elimina el borde", "borra las palmeras", "quita todo": genera acción remove_objects con el filter correcto
- Si piden "pon pasto", "pasto zoysia", "diseña con piedras de río" o cualquier material: genera SIEMPRE acción generate_terrain con description en inglés Y materialName en español
- La description del generate_terrain debe ser muy específica: incluye el tipo de pasto/material, cobertura, estilo, iluminación
- Si no hay el tipo de planta pedido en inventario, usa add_plant con inventoryId="GENERATE" y el plantType correcto
- Si el usuario hace preguntas generales de paisajismo, responde profesionalmente SIN generar acciones
- Siempre responde en español`;

      const userContent: any[] = [{ type: "text", text: message }];

      if (captureImage && captureImage.startsWith('data:image/')) {
        const base64Data = captureImage.replace(/^data:image\/\w+;base64,/, '');
        const mediaType = captureImage.includes('data:image/png') ? 'image/png' : 'image/jpeg';
        userContent.unshift({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Data }
        });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[aiDesignChat] Claude error:', err);
        return { reply: 'Error al conectar con el asistente de IA. Intenta de nuevo.', actions: [] as any[] };
      }

      const data = await response.json() as any;
      const fullText: string = data.content?.[0]?.text || '';

      const actionsMatch = fullText.match(/<actions>([\s\S]*?)<\/actions>/);
      let actions: any[] = [];
      let reply = fullText.replace(/<actions>[\s\S]*?<\/actions>/g, '').trim();

      if (actionsMatch) {
        try {
          actions = JSON.parse(actionsMatch[1].trim());
        } catch (e) {
          console.error('[aiDesignChat] Failed to parse actions:', e);
        }
      }

      console.log(`[aiDesignChat] reply=${reply.length}chars actions=${actions.length}`);
      return { reply, actions };
    }),

  /**
   * generatePlantImage — Generates a photorealistic plant image via CF AI.
   * Used when the plant is not found in the user's inventory.
   * Returns a base64 image or a high-quality Unsplash fallback URL.
   */
  generatePlantImage: publicProcedure
    .input(z.object({
      plantName: z.string(),
      plantType: z.string().default('tree'),
    }))
    .mutation(async ({ input }) => {
      const { plantName, plantType } = input;
      // 1. Try Cloudflare AI text-to-image (best quality)
      const aiImage = await cfGeneratePlantImage(plantName, plantType);
      if (aiImage) {
        console.log(`[generatePlantImage] CF AI generated image for: ${plantName}`);
        return { imageUrl: aiImage, source: 'ai' as const };
      }
      // 2. Fallback: high-quality Unsplash photo by plant type
      const typeKey = plantType.toLowerCase();
      const fallbackUrl = PLANT_FALLBACK_IMAGES[typeKey]
        || PLANT_FALLBACK_IMAGES[plantName.toLowerCase()]
        || PLANT_FALLBACK_IMAGES['tree'];
      console.log(`[generatePlantImage] Using fallback for: ${plantName} (${plantType})`);
      return { imageUrl: fallbackUrl, source: 'fallback' as const };
    }),

  /**
   * generateDesign — Production-grade AI landscape design image generator.
   *
   * 3-Strategy fallback system (NEVER returns empty):
   *   1. img2img with CF SD v1.5 inpainting (uses terrain photo as base — best result)
   *   2. txt2img with CF SDXL-base-1.0 (high quality, no photo needed)
   *   3. txt2img with CF SD v1.5 via cfGeneratePlantImage (most reliable)
   *
   * BUG FIXES applied:
   *   - mask channels: 4 (RGBA) instead of 1 (grayscale) — was crashing Sharp
   *   - image resized to PNG (not JPEG) for inpainting compatibility
   *   - enriched prompt with material name and landscape context
   *   - full try/catch per strategy with automatic fallthrough
   */
  generateDesign: publicProcedure
    .input(z.object({
      captureImage: z.string().optional(),
      description: z.string(),
      materialName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const cfToken = getCFToken();
      if (!cfToken) {
        return { success: false, imageBase64: null as string | null, error: 'CF_API_TOKEN no configurado — contacta al administrador' };
      }

      const { captureImage, description, materialName } = input;

      // Build a rich, specific prompt that names the exact material
      const materialHint = materialName ? `${materialName}, ` : '';
      const prompt = `Professional residential landscape design, ${materialHint}${description}. Photorealistic garden photography, high quality DSLR photo, natural sunlight, lush and well-maintained, professional landscaping, beautiful outdoor space, aerial perspective`;
      const negativePrompt = 'ugly, blurry, low quality, cartoon, anime, drawing, sketch, painting, people, cars, text, watermark, logo, border, frame, distorted, deformed, bad anatomy, indoors';

      console.log(`[generateDesign] START hasPhoto=${!!captureImage} material="${materialName || ''}" desc="${description.slice(0, 60)}"`);

      // ── STRATEGY 1: img2img with CF SD v1.5 inpainting (uses terrain photo) ───
      if (captureImage) {
        try {
          const imageBuffer = base64ToBuffer(captureImage);

          // Resize to 512x512 PNG — CF inpainting requires PNG input
          const resized = await sharp(imageBuffer)
            .resize(512, 512, { fit: 'cover' })
            .png()
            .toBuffer();

          // Full white mask (RGBA, 4 channels) — tells CF to transform the entire image
          // CRITICAL FIX: channels MUST be 3 or 4, NOT 1 (grayscale crashes Sharp)
          const maskBuffer = await sharp({
            create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
          }).png().toBuffer();

          const resultBuf = await cfInpaintCall(
            resized,
            maskBuffer,
            prompt,
            negativePrompt,
            25,   // steps — more steps = better quality
            0.85, // strength — high = redesign the terrain completely
            8.0   // guidance — higher = follows prompt more strictly
          );

          const resultBase64 = 'data:image/png;base64,' + resultBuf.toString('base64');
          console.log(`[generateDesign] ✓ Strategy 1 (img2img inpainting) success, size=${resultBuf.length}b`);
          return { success: true, imageBase64: resultBase64, error: null as string | null };
        } catch (err: any) {
          console.warn(`[generateDesign] Strategy 1 (img2img) failed: ${err.message} — falling back to txt2img`);
        }
      }

      // ── STRATEGY 2: txt2img with SDXL (high quality, no photo needed) ────────
      try {
        const sdxlUrl = `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 50_000);
        let resp2: Response;
        try {
          resp2 = await fetch(sdxlUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, negative_prompt: negativePrompt, num_steps: 25, width: 768, height: 512 }),
            signal: controller2.signal,
          });
        } finally {
          clearTimeout(timeout2);
        }
        if (resp2.ok) {
          const buf2 = Buffer.from(await resp2.arrayBuffer());
          if (buf2.length > 1000) {
            const resultBase64 = 'data:image/png;base64,' + buf2.toString('base64');
            console.log(`[generateDesign] ✓ Strategy 2 (SDXL txt2img) success, size=${buf2.length}b`);
            return { success: true, imageBase64: resultBase64, error: null as string | null };
          }
        } else {
          const errText2 = await resp2.text();
          console.warn(`[generateDesign] Strategy 2 SDXL failed: ${resp2.status} ${errText2.slice(0, 100)}`);
        }
      } catch (err: any) {
        console.warn(`[generateDesign] Strategy 2 (SDXL) failed: ${err.message} — falling back to SD v1.5`);
      }

      // ── STRATEGY 3: txt2img with SD v1.5 (most reliable fallback) ──────────
      try {
        const generatedBase64 = await cfGeneratePlantImage(
          `${materialHint}${description}`,
          'landscape'
        );
        if (generatedBase64) {
          console.log(`[generateDesign] ✓ Strategy 3 (SD v1.5 txt2img) success`);
          return { success: true, imageBase64: generatedBase64, error: null as string | null };
        }
      } catch (err: any) {
        console.warn(`[generateDesign] Strategy 3 (SD v1.5) failed: ${err.message}`);
      }

      // All strategies exhausted
      console.error('[generateDesign] ✗ All 3 strategies failed');
      return { success: false, imageBase64: null as string | null, error: 'No se pudo generar el diseño. Verifica la configuración de Cloudflare AI.' };
    }),
});

