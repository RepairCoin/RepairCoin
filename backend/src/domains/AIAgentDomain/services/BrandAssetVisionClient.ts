// backend/src/domains/AIAgentDomain/services/BrandAssetVisionClient.ts
//
// The "See" capability (AI Image Generation Phase 4): Claude vision over a
// shop's brand asset. v1 use: extract a brand palette from an uploaded logo to
// auto-fill the Brand Kit colors.
//
// Uses @anthropic-ai/sdk directly (same SDK + ANTHROPIC_API_KEY as
// AnthropicClient, which is text-only). The image is downloaded and sent as
// base64 — works regardless of SDK version and avoids Anthropic having to fetch
// an external URL. Sonnet vision is ~$0.005/image.

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../../utils/logger";
import { ClaudeModel } from "../types";

const VISION_MODEL: ClaudeModel = "claude-sonnet-4-6";
const MAX_TOKENS = 300;
// Sonnet list pricing (USD per token).
const INPUT_RATE = 3 / 1_000_000;
const OUTPUT_RATE = 15 / 1_000_000;

const SUPPORTED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const PROMPT =
  "You are extracting a brand color palette from a shop's logo image. Reply " +
  'with ONLY a compact JSON object, no prose: {"primaryColorHex":"#RRGGBB",' +
  '"secondaryColorHex":"#RRGGBB","description":"one short sentence"}. ' +
  "primaryColorHex = the dominant brand color; secondaryColorHex = the next " +
  "most prominent color (or a complementary neutral if the logo is " +
  "single-color). Use uppercase 6-digit hex. description = a one-sentence " +
  "read of the logo's style/mood.";

export interface BrandColorResult {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  description: string | null;
  costUsd: number;
}

export class BrandAssetVisionClient {
  private sdk: Anthropic | null = null;

  private client(): Anthropic {
    if (!this.sdk) {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY not set");
      this.sdk = new Anthropic({ apiKey: key });
    }
    return this.sdk;
  }

  /** Extract a brand palette from a logo image URL. Throws on a hard failure. */
  async extractBrandColors(imageUrl: string): Promise<BrandColorResult> {
    // Download the image → base64.
    const dl = await fetch(imageUrl);
    if (!dl.ok) {
      throw new Error(`logo download failed (status ${dl.status})`);
    }
    let mediaType = (dl.headers.get("content-type") || "image/png")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!SUPPORTED_MEDIA.has(mediaType)) mediaType = "image/png";
    const b64 = Buffer.from(await dl.arrayBuffer()).toString("base64");

    const resp = await this.client().messages.create({
      model: VISION_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: b64,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const costUsd = Number(
      (
        resp.usage.input_tokens * INPUT_RATE +
        resp.usage.output_tokens * OUTPUT_RATE
      ).toFixed(6)
    );

    // Pull the JSON object out of the text response.
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = this.parse(text);

    return { ...parsed, costUsd };
  }

  private parse(text: string): Omit<BrandColorResult, "costUsd"> {
    const empty = { primaryColorHex: null, secondaryColorHex: null, description: null };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn("BrandAssetVisionClient: no JSON in vision response", {
        preview: text.slice(0, 120),
      });
      return empty;
    }
    try {
      const o = JSON.parse(match[0]) as Record<string, unknown>;
      const hex = (v: unknown): string | null => {
        if (typeof v !== "string") return null;
        const t = v.trim().toUpperCase();
        return HEX_RE.test(t) ? t : null;
      };
      return {
        primaryColorHex: hex(o.primaryColorHex),
        secondaryColorHex: hex(o.secondaryColorHex),
        description:
          typeof o.description === "string"
            ? o.description.trim().slice(0, 300)
            : null,
      };
    } catch {
      return empty;
    }
  }
}

export const brandAssetVisionClient = new BrandAssetVisionClient();
