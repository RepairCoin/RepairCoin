// backend/src/services/stability/StabilityClient.ts
//
// Thin client for Stability AI's Stable Image API — the "Edit" capability (AI
// Image Generation Phase 6). DALL·E/gpt-image-1 GENERATE; Stability EDITS an
// existing image from a prompt (image-to-image, or inpaint with a mask).
//
// New 3rd vendor: reads STABILITY_API_KEY (already in .env). Node 18+ fetch +
// FormData + Blob, no SDK. `Accept: image/*` returns the edited image bytes
// directly. Secret hygiene mirrors WhisperClient: key read at call time, never
// logged, sanitized errors.

import { logger } from "../../utils/logger";

const STABILITY_MODEL = "sd3.5-large";
const I2I_ENDPOINT = "https://api.stability.ai/v2beta/stable-image/generate/sd3";
const INPAINT_ENDPOINT = "https://api.stability.ai/v2beta/stable-image/edit/inpaint";
// SD3.5 Large image-to-image ≈ 6.5 credits @ $0.01/credit. Fixed per-edit cost
// for the audit row (scope §5 budgeted ~$0.045-0.065/edit).
const COST_PER_EDIT_USD = 0.065;

export interface EditImageResult {
  image: Buffer; // edited PNG bytes
  costUsd: number;
  latencyMs: number;
}

export interface EditOptions {
  /** When supplied, inpaint (edit only the masked region). Otherwise img2img. */
  mask?: Buffer;
  /** img2img only: 0 = keep source, 1 = ignore source. Default 0.6. */
  strength?: number;
}

export class StabilityClient {
  /**
   * Edit `source` per `prompt`. img2img by default; inpaint when a mask is
   * given. @throws Error with a sanitized message; STABILITY_API_KEY never leaks.
   */
  async edit(
    source: Buffer,
    prompt: string,
    opts: EditOptions = {}
  ): Promise<EditImageResult> {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "STABILITY_API_KEY is not set. Add it to backend/.env (never commit)."
      );
    }

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("output_format", "png");
    form.append(
      "image",
      new Blob([new Uint8Array(source)], { type: "image/png" }),
      "image.png"
    );

    let endpoint: string;
    if (opts.mask) {
      endpoint = INPAINT_ENDPOINT;
      form.append(
        "mask",
        new Blob([new Uint8Array(opts.mask)], { type: "image/png" }),
        "mask.png"
      );
    } else {
      endpoint = I2I_ENDPOINT;
      form.append("model", STABILITY_MODEL);
      form.append("mode", "image-to-image");
      form.append("strength", String(opts.strength ?? 0.6));
    }

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "image/*",
          // Do NOT set Content-Type — fetch + FormData set the multipart boundary.
        },
        body: form,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      logger.error("StabilityClient network error", {
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Image edit request failed — network error");
    }

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.error("StabilityClient non-OK response", {
        status: res.status,
        latencyMs,
        body: body.slice(0, 500),
      });
      throw new Error(`Stability API returned status ${res.status}`);
    }

    const image = Buffer.from(await res.arrayBuffer());
    if (image.length === 0) {
      throw new Error("Stability API returned empty image");
    }

    return { image, costUsd: COST_PER_EDIT_USD, latencyMs };
  }
}

export const stabilityClient = new StabilityClient();
export const STABILITY_EDIT_MODEL = STABILITY_MODEL;
