// backend/src/domains/AIAgentDomain/services/marketing/tools/analyzeBrandAssets.ts
//
// Tool: analyze_brand_assets (AI Image Generation Phase 9 — the "See" path for
// in-chat uploads, scope §3.4-B)
//
// Read-only vision. The owner attaches a photo (storefront, product, a draft
// banner, a competitor ad) and asks "what theme fits this?", "what colors are
// in here?", or "critique this". This tool runs Claude vision over the image and
// returns a description + a rough palette + 2-3 campaign theme ideas, which the
// assistant relays in prose (and can act on — e.g. draft a campaign in that
// theme, or extract colors).
//
// Source: `image_url` from args, but it DEFAULTS to the image the owner attached
// to this turn (ctx.attachedImageUrl) — so the owner doesn't have to paste a
// URL. The attached image is shop-owned (shops/{shopId}/ai-uploads), so we only
// ever analyze the requesting shop's own image. No mutation, no spend cap (a
// single ~$0.005 Sonnet vision call, mirroring brand-kit logo analysis).

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { brandAssetVisionClient } from "../../BrandAssetVisionClient";

const NAME = "analyze_brand_assets";

export const analyzeBrandAssets: MarketingTool = {
  name: NAME,
  description:
    "Look at an image the shop owner attached and describe it for marketing — " +
    "what it shows, its mood/style, its dominant colors, and 2-3 campaign theme " +
    "ideas it could anchor. Call this when the owner attaches a photo and asks " +
    "'what theme/campaign fits this?', 'what colors are in this?', 'critique " +
    "this', or 'look at our storefront'. Defaults to the image attached to the " +
    "current message — you usually DON'T need to pass image_url. Read-only; it " +
    "describes, it never edits. To MODIFY the image instead, use " +
    "propose_image_edit.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description:
          "Optional. URL of the image to analyze. Omit to use the image the " +
          "owner attached to this turn (the normal case).",
      },
    },
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    const a = (args ?? {}) as { image_url?: unknown };
    const provided =
      typeof a.image_url === "string" ? a.image_url.trim() : "";

    // Prefer an explicit shop-owned URL; otherwise the turn's attached image.
    const imageUrl =
      provided && provided.includes(`/shops/${ctx.shopId}/`)
        ? provided
        : ctx.attachedImageUrl ?? provided;

    if (!imageUrl) {
      return {
        data: {
          analyzed: false,
          reason:
            "There's no image to look at — attach a photo with the paperclip, then ask me about it.",
        },
      };
    }

    try {
      const result = await brandAssetVisionClient.analyzeImage(imageUrl);
      return {
        data: {
          analyzed: true,
          description: result.description,
          colors: result.colors,
          theme_ideas: result.themeIdeas,
          cost_usd: result.costUsd,
        },
      };
    } catch (err) {
      return {
        data: {
          analyzed: false,
          reason:
            err instanceof Error
              ? `Couldn't analyze the image: ${err.message}`
              : "Couldn't analyze the image. Please try again.",
        },
      };
    }
  },
};
