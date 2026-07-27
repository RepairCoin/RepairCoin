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
import { smartModel } from "../../../config/aiModels";

const VISION_MODEL: ClaudeModel = smartModel();
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

// Branding Studio (onboarding) — the fuller brand read behind the wizard's
// "AI Brand Analysis" step: colors PLUS a marketing profile, in ONE vision call
// (cost-parity with extractBrandColors). The 4 marketing styles MUST match the
// wizard's options so the suggestion can pre-select a card.
export const MARKETING_STYLE_OPTIONS = [
  "Professional & Corporate",
  "Modern & Tech",
  "Friendly & Local",
  "Premium & Luxury",
] as const;
export type MarketingStyleOption = (typeof MARKETING_STYLE_OPTIONS)[number];

export interface BrandProfileResult {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  description: string | null;
  brandPersonality: string | null;
  industryStyle: string | null;
  recommendedTone: string | null;
  marketingStyle: MarketingStyleOption | null;
  headline: string | null;
  costUsd: number;
}

const BRAND_PROFILE_PROMPT =
  "You are a brand strategist analyzing a shop's logo to build its marketing " +
  "profile. Reply with ONLY a compact JSON object, no prose: " +
  '{"primaryColorHex":"#RRGGBB","secondaryColorHex":"#RRGGBB",' +
  '"description":"one short sentence on the logo style/mood",' +
  '"brandPersonality":"three traits joined by \' • \'",' +
  '"industryStyle":"short industry/style label",' +
  '"recommendedTone":"three tone words joined by \' • \'",' +
  '"marketingStyle":"EXACTLY one of: Professional & Corporate | Modern & Tech | ' +
  'Friendly & Local | Premium & Luxury",' +
  '"headline":"a short punchy tagline, max 6 words"}. ' +
  "Use uppercase 6-digit hex. primaryColorHex = dominant brand color, " +
  "secondaryColorHex = next most prominent (or a complementary neutral if " +
  "single-color). brandPersonality and recommendedTone = exactly three short " +
  "words/phrases joined by ' • '. marketingStyle MUST be one of the four options " +
  "verbatim.";

export interface ImageAnalysisResult {
  /** One- to two-sentence read of what's in the image + its style/mood. */
  description: string | null;
  /** Dominant colors as uppercase 6-digit hex (best-effort, may be empty). */
  colors: string[];
  /** 2-3 short marketing/campaign theme ideas the image suggests. */
  themeIdeas: string[];
  costUsd: number;
}

const ANALYZE_PROMPT =
  "You are a marketing creative assistant looking at a photo a shop owner " +
  "uploaded (e.g. their storefront, a product, or a draft ad). Reply with ONLY " +
  'a compact JSON object, no prose: {"description":"1-2 sentences on what this ' +
  'shows and its mood/style","colors":["#RRGGBB", ...],"themeIdeas":["short ' +
  'campaign angle", ...]}. colors = up to 4 dominant colors as uppercase ' +
  "6-digit hex. themeIdeas = 2-3 concise marketing angles this image could " +
  "anchor (e.g. 'cozy neighborhood vibe', 'bold limited-time sale'). Keep each " +
  "themeIdea under 8 words.";

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

  /**
   * Branding Studio — full brand-profile read from a logo: colors + personality,
   * industry style, recommended tone, a suggested marketing style, and a headline.
   * One vision call. Same base64 download path as extractBrandColors. Throws on a
   * hard download failure; soft-fails individual fields to null.
   */
  async analyzeBrand(imageUrl: string): Promise<BrandProfileResult> {
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
      max_tokens: 400,
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
            { type: "text", text: BRAND_PROFILE_PROMPT },
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

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return { ...this.parseBrandProfile(text), costUsd };
  }

  private parseBrandProfile(text: string): Omit<BrandProfileResult, "costUsd"> {
    const empty: Omit<BrandProfileResult, "costUsd"> = {
      primaryColorHex: null,
      secondaryColorHex: null,
      description: null,
      brandPersonality: null,
      industryStyle: null,
      recommendedTone: null,
      marketingStyle: null,
      headline: null,
    };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn("BrandAssetVisionClient.analyzeBrand: no JSON in response", {
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
      const str = (v: unknown, max: number): string | null =>
        typeof v === "string" && v.trim().length > 0
          ? v.trim().slice(0, max)
          : null;
      const style = typeof o.marketingStyle === "string" ? o.marketingStyle.trim() : "";
      const marketingStyle = (MARKETING_STYLE_OPTIONS as readonly string[]).includes(style)
        ? (style as MarketingStyleOption)
        : null;
      return {
        primaryColorHex: hex(o.primaryColorHex),
        secondaryColorHex: hex(o.secondaryColorHex),
        description: str(o.description, 300),
        brandPersonality: str(o.brandPersonality, 200),
        industryStyle: str(o.industryStyle, 200),
        recommendedTone: str(o.recommendedTone, 200),
        marketingStyle,
        headline: str(o.headline, 200),
      };
    } catch {
      return empty;
    }
  }

  /**
   * Broader "See" read for the in-chat upload (Phase 9): describe an arbitrary
   * shop photo + suggest campaign themes + pull a rough palette. Same base64
   * download path as extractBrandColors. Throws on a hard download failure.
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    const dl = await fetch(imageUrl);
    if (!dl.ok) {
      throw new Error(`image download failed (status ${dl.status})`);
    }
    let mediaType = (dl.headers.get("content-type") || "image/png")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!SUPPORTED_MEDIA.has(mediaType)) mediaType = "image/png";
    const b64 = Buffer.from(await dl.arrayBuffer()).toString("base64");

    const resp = await this.client().messages.create({
      model: VISION_MODEL,
      max_tokens: 400,
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
            { type: "text", text: ANALYZE_PROMPT },
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

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const empty: Omit<ImageAnalysisResult, "costUsd"> = {
      description: null,
      colors: [],
      themeIdeas: [],
    };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn("BrandAssetVisionClient.analyzeImage: no JSON in response", {
        preview: text.slice(0, 120),
      });
      return { ...empty, costUsd };
    }
    try {
      const o = JSON.parse(match[0]) as Record<string, unknown>;
      const colors = Array.isArray(o.colors)
        ? (o.colors as unknown[])
            .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
            .filter((c) => HEX_RE.test(c))
            .slice(0, 4)
        : [];
      const themeIdeas = Array.isArray(o.themeIdeas)
        ? (o.themeIdeas as unknown[])
            .map((t) => (typeof t === "string" ? t.trim().slice(0, 60) : ""))
            .filter((t) => t.length > 0)
            .slice(0, 3)
        : [];
      return {
        description:
          typeof o.description === "string"
            ? o.description.trim().slice(0, 400)
            : null,
        colors,
        themeIdeas,
        costUsd,
      };
    } catch {
      return { ...empty, costUsd };
    }
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
