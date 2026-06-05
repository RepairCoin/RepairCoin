// backend/src/services/openai/OpenAIImageClient.ts
//
// Thin client for OpenAI image generation (the "Generate" capability — AI Image
// Generation Phase 1). Sibling to WhisperClient / OpenAITtsClient; reuses the
// SAME OPENAI_API_KEY, so no new vendor / secret surface for generation. See
// docs/tasks/strategy/ai-image-generation/implementation.md §5.
//
// Model: `gpt-image-1` — OpenAI's current image model (supersedes DALL·E 3,
// which is not available on this account). GENERATES (text→image) AND EDITS
// (image+prompt→image). Editing moved here from Stability: Stability's SD3
// img2img ignored the edit instruction (returned the source unchanged at every
// strength), whereas gpt-image-1's /images/edits applies the change reliably and
// preserves text/layout. The API returns base64 image bytes; the caller persists
// them immediately (DigitalOcean Spaces).
//
// Secret hygiene mirrors WhisperClient: reads OPENAI_API_KEY at call time,
// never logs it, sanitized errors. Node 18+ built-in fetch; no `openai` SDK.

import { logger } from "../../utils/logger";

const IMAGE_MODEL = "gpt-image-1";
const IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits";

// Valid gpt-image-1 sizes (dall-e-3's 1792-wide sizes are NOT accepted here):
// square for ad creative, landscape/portrait for banners.
export const IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageQuality = "low" | "medium" | "high";
export const DEFAULT_IMAGE_SIZE: ImageSize = "1536x1024"; // landscape banner
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";

// Approx per-image USD for gpt-image-1, keyed `quality:size`. `medium:1024x1024`
// ≈ $0.042 — keeps the scope §5 cost projections (~$0.04/image) valid. `high`
// is exposed for premium ad creative.
const IMAGE_PRICING: Record<string, number> = {
  "low:1024x1024": 0.011,
  "medium:1024x1024": 0.042,
  "high:1024x1024": 0.167,
  "low:1536x1024": 0.016,
  "medium:1536x1024": 0.063,
  "high:1536x1024": 0.25,
  "low:1024x1536": 0.016,
  "medium:1024x1536": 0.063,
  "high:1024x1536": 0.25,
};

export interface GenerateImageResult {
  /** Temporary OpenAI URL (valid ~60 min) — download + persist immediately.
   *  Null when the API returns base64 instead (see b64Json). */
  imageUrl: string | null;
  /** Base64 PNG, when the API returns image bytes inline instead of a URL.
   *  The caller decodes this directly (no download step). */
  b64Json: string | null;
  /** The model may rewrite the prompt; useful to store for debugging/audit. */
  revisedPrompt: string | null;
  costUsd: number;
  latencyMs: number;
}

export class OpenAIImageClient {
  /**
   * Generate one image from a text prompt.
   *
   * @throws Error with a sanitized message; OPENAI_API_KEY never leaks.
   */
  async generate(
    prompt: string,
    size: ImageSize = DEFAULT_IMAGE_SIZE,
    quality: ImageQuality = DEFAULT_IMAGE_QUALITY
  ): Promise<GenerateImageResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to backend/.env (never commit)."
      );
    }

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch(IMAGE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // NOTE: no `response_format` — the images API rejects it now
        // ("Unknown parameter"). gpt-image-1 returns base64; some models/
        // accounts return a URL. We handle BOTH below.
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt,
          size,
          quality,
          n: 1,
        }),
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      logger.error("OpenAIImageClient network error", {
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Image generation request failed — network error");
    }

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.error("OpenAIImageClient non-OK response", {
        status: res.status,
        latencyMs,
        body: body.slice(0, 500),
      });
      throw new Error(`OpenAI image API returned status ${res.status}`);
    }

    const payload = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    const first = payload.data?.[0];
    if (!first?.url && !first?.b64_json) {
      logger.error("OpenAIImageClient missing image data", { payload });
      throw new Error("OpenAI image API returned no image data");
    }

    const costUsd = IMAGE_PRICING[`${quality}:${size}`] ?? 0.08;

    return {
      imageUrl: first.url ?? null,
      b64Json: first.b64_json ?? null,
      revisedPrompt: first.revised_prompt ?? null,
      costUsd: Number(costUsd.toFixed(6)),
      latencyMs,
    };
  }

  /**
   * Edit an existing image from a prompt (gpt-image-1 `/images/edits`). Applies
   * the instruction to `source` while keeping composition/text. Returns base64
   * PNG bytes (the caller persists them). `size` should match the source's
   * aspect ratio; the caller picks it. @throws sanitized Error; key never leaks.
   */
  async edit(
    source: Buffer,
    prompt: string,
    size: ImageSize = DEFAULT_IMAGE_SIZE,
    quality: ImageQuality = DEFAULT_IMAGE_QUALITY
  ): Promise<{ b64Json: string; costUsd: number; latencyMs: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to backend/.env (never commit)."
      );
    }

    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append(
      "image",
      new Blob([new Uint8Array(source)], { type: "image/png" }),
      "image.png"
    );
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");

    const startedAt = Date.now();
    let res: Response;
    try {
      // No Content-Type header — fetch + FormData set the multipart boundary.
      res = await fetch(IMAGE_EDIT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      logger.error("OpenAIImageClient edit network error", {
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Image edit request failed — network error");
    }

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.error("OpenAIImageClient edit non-OK response", {
        status: res.status,
        latencyMs,
        body: body.slice(0, 500),
      });
      throw new Error(`OpenAI image edit API returned status ${res.status}`);
    }

    const payload = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) {
      logger.error("OpenAIImageClient edit missing image data", { payload });
      throw new Error("OpenAI image edit API returned no image data");
    }

    // Edits are priced like generation for gpt-image-1 (input image adds a small
    // token cost; the table value is a close approximation for the audit).
    const costUsd = IMAGE_PRICING[`${quality}:${size}`] ?? 0.08;

    return { b64Json: b64, costUsd: Number(costUsd.toFixed(6)), latencyMs };
  }
}

export const openAIImageClient = new OpenAIImageClient();
