/**
 * Inpainting tRPC Router
 * ============================================================================
 * Procedures:
 *
 * 1. detectObstacles — uses Claude Vision (claude-opus-4-6) to analyze the
 *    terrain photo and return ALL obstacles with precise bounding boxes.
 *
 * 2. cleanTerrain — CROP-INPAINT-PASTE approach (production quality):
 *    For each obstacle: crop the region, send 512x512 to Cloudflare AI,
 *    paste the result back into the original image at full resolution.
 *    This avoids the quality loss from resizing the full image to 512x512.
 *
 * Cloudflare AI model: @cf/runwayml/stable-diffusion-v1-5-inpainting
 * Mask convention: WHITE = erase/inpaint, BLACK = keep
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

/** Convert base64 data URL or raw base64 to Buffer */
function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/**
 * Call Cloudflare AI inpainting with a 512x512 image + mask.
 * Returns the result as a Buffer (PNG).
 */
async function callCloudflareInpaint(
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string
): Promise<Buffer> {
  // Ensure both are exactly 512x512 PNG
  const imgPng = await sharp(imageBuffer).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const maskPng = await sharp(maskBuffer).resize(512, 512, { fit: "fill" }).png().toBuffer();

  const imageArray = Array.from(imgPng);
  const maskArray = Array.from(maskPng);

  const cfResponse = await fetch(CF_INPAINT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt:
        "objects, debris, rocks, stones, artifacts, text, watermark, blurry, distorted, ugly",
      image: imageArray,
      mask: maskArray,
      num_steps: 20,
      strength: 1.0,
      guidance: 7.5,
    }),
  });

  if (!cfResponse.ok) {
    const errText = await cfResponse.text();
    throw new Error(`Cloudflare AI error ${cfResponse.status}: ${errText.slice(0, 300)}`);
  }

  return Buffer.from(await cfResponse.arrayBuffer());
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
      const meta = await sharp(imgBuf).metadata();
      const imgW = meta.width || 800;
      const imgH = meta.height || 600;
      const imgRawB64 = imgBuf.toString("base64");

      // Determine MIME type
      const isPng = imgBuf[0] === 0x89 && imgBuf[1] === 0x50;
      const mimeType = isPng ? "image/png" : "image/jpeg";

      console.log(`[DetectObstacles] Analyzing ${imgW}x${imgH} image with Claude Vision...`);

      const prompt = `You are analyzing a terrain/landscape photo (${imgW}x${imgH} pixels) to detect ALL obstacles that should be removed to prepare the land for landscaping.

Detect EVERY obstacle including: rocks, stones, concrete blocks, debris, tree stumps, pipes, fences, posts, construction materials, tools, plants, pots, or any man-made or natural object that does not belong to clean terrain.

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
   * cleanTerrain — CROP-INPAINT-PASTE approach.
   *
   * For each obstacle:
   *   1. Crop a region around the obstacle (with 30% padding) from the original image
   *   2. Create a white mask for the obstacle area within the crop
   *   3. Send crop + mask (resized to 512x512) to Cloudflare AI
   *   4. Resize the result back to the crop dimensions
   *   5. Composite the result back onto the original image
   *
   * This preserves full image resolution and gives much better results than
   * sending the entire image at 512x512.
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
      const meta = await sharp(origBuffer).metadata();
      const origW = meta.width || 800;
      const origH = meta.height || 600;

      console.log(`[Inpaint] Image: ${origW}x${origH}, mode: ${maskBase64 ? "freehand-mask" : `obstacle-list(${obstacles!.length})`}`);

      // ── FREEHAND MASK MODE ──────────────────────────────────────────────────
      if (maskBase64) {
        // Legacy mode: send full image to Cloudflare (kept for compatibility)
        const maskBuffer = base64ToBuffer(maskBase64);
        const inpaintPrompt = prompt ||
          "Clean natural terrain, seamless background fill. Match surrounding area texture: gravel, dirt, grass, or soil. Photorealistic, no artifacts.";

        console.log(`[Inpaint] Freehand mask mode — calling Cloudflare AI...`);
        const resultPng = await callCloudflareInpaint(origBuffer, maskBuffer, inpaintPrompt);

        // Scale result back to original dimensions
        const finalBuffer = await sharp(resultPng)
          .resize(origW, origH, { fit: "fill" })
          .jpeg({ quality: 90 })
          .toBuffer();

        const resultBase64 = "data:image/jpeg;base64," + finalBuffer.toString("base64");
        console.log(`[Inpaint] Freehand done! Result: ${finalBuffer.length} bytes`);
        return { imageBase64: resultBase64 };
      }

      // ── OBSTACLE LIST MODE: CROP-INPAINT-PASTE ──────────────────────────────
      const scaleX = coordSpace === "canvas800x600" ? origW / 800 : 1;
      const scaleY = coordSpace === "canvas800x600" ? origH / 600 : 1;

      // Start with the original image as working buffer
      let workingBuffer = origBuffer;

      for (let i = 0; i < obstacles!.length; i++) {
        const obs = obstacles![i];
        console.log(`[Inpaint] Processing obstacle ${i + 1}/${obstacles!.length}: ${obs.label}`);

        // Convert obstacle coords to image pixel space
        const cx = obs.x * scaleX;
        const cy = obs.y * scaleY;
        const hw = (obs.width * scaleX) / 2;
        const hh = (obs.height * scaleY) / 2;

        // Add 40% padding around obstacle for better context
        const padX = hw * 0.4;
        const padY = hh * 0.4;

        // Crop region (clamped to image bounds)
        const cropX = Math.max(0, Math.floor(cx - hw - padX));
        const cropY = Math.max(0, Math.floor(cy - hh - padY));
        const cropW = Math.min(origW - cropX, Math.ceil((hw + padX) * 2));
        const cropH = Math.min(origH - cropY, Math.ceil((hh + padY) * 2));

        if (cropW < 10 || cropH < 10) {
          console.log(`[Inpaint] Skipping obstacle ${i + 1} — crop too small`);
          continue;
        }

        // 1. Crop the region from working image
        const cropBuffer = await sharp(workingBuffer)
          .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
          .png()
          .toBuffer();

        // 2. Create white mask for the obstacle within the crop
        // Obstacle position relative to crop
        const maskX0 = Math.max(0, Math.floor(cx - hw - cropX));
        const maskY0 = Math.max(0, Math.floor(cy - hh - cropY));
        const maskX1 = Math.min(cropW, Math.ceil(cx + hw - cropX));
        const maskY1 = Math.min(cropH, Math.ceil(cy + hh - cropY));
        const maskW = Math.max(1, maskX1 - maskX0);
        const maskH = Math.max(1, maskY1 - maskY0);

        // Build mask: black background, white rectangle for obstacle
        const maskBuffer = await sharp({
          create: {
            width: cropW,
            height: cropH,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
          },
        })
          .composite([{
            input: await sharp({
              create: {
                width: maskW,
                height: maskH,
                channels: 3,
                background: { r: 255, g: 255, b: 255 },
              },
            }).png().toBuffer(),
            left: maskX0,
            top: maskY0,
          }])
          .png()
          .toBuffer();

        // 3. Call Cloudflare AI with the crop + mask
        const obstacleLabel = obs.label.replace(/_/g, " ");
        const inpaintPrompt = prompt ||
          `Remove ${obstacleLabel} from terrain. Replace with natural ground matching surrounding area: soil, gravel, grass, or dirt. Photorealistic, seamless, no artifacts.`;

        let resultPng: Buffer;
        try {
          resultPng = await callCloudflareInpaint(cropBuffer, maskBuffer, inpaintPrompt);
        } catch (err) {
          console.error(`[Inpaint] Cloudflare error for obstacle ${i + 1}:`, err);
          continue; // Skip this obstacle, keep working on others
        }

        // 4. Resize result back to crop dimensions
        const resizedResult = await sharp(resultPng)
          .resize(cropW, cropH, { fit: "fill" })
          .png()
          .toBuffer();

        // 5. Composite the result back onto the working image
        workingBuffer = await sharp(workingBuffer)
          .composite([{
            input: resizedResult,
            left: cropX,
            top: cropY,
          }])
          .png()
          .toBuffer();

        console.log(`[Inpaint] Obstacle ${i + 1} erased successfully`);
      }

      // Convert final result to JPEG for smaller size
      const finalBuffer = await sharp(workingBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      const resultBase64 = "data:image/jpeg;base64," + finalBuffer.toString("base64");
      console.log(`[Inpaint] All done! Final result: ${finalBuffer.length} bytes`);
      return { imageBase64: resultBase64 };
    }),
});
