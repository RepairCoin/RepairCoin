// backend/src/domains/AIAgentDomain/services/marketing/tools/proposeCampaignImage.ts
//
// Tool: propose_campaign_image (AI Image Generation Phase 2)
//
// Generates a branded marketing image from a text description and emits a
// `campaign_image_proposal` display the shop reviews (approve / regenerate)
// before it lands in a campaign — Claude never finalizes it (G2: propose, the
// owner taps).
//
// Reuses the shared ImageGenerationService, so the SAME gates apply regardless
// of entry point: ai_images_enabled kill-switch, spend cap, daily rate limit,
// moderation, brand-kit color/tone injection, logo overlay, audit, spend. A
// business-blocked outcome (disabled / over cap / flagged) returns data without
// a display so Claude relays the reason in prose rather than erroring.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { ImageGenerationService } from "../../ImageGenerationService";
import { ImageSize } from "../../../../../services/openai/OpenAIImageClient";
import { LogoPlacement } from "../../../../../services/LogoOverlayService";

const NAME = "propose_campaign_image";
const MAX_PROMPT = 1000;

const ORIENTATION: Record<string, ImageSize> = {
  landscape: "1536x1024",
  square: "1024x1024",
  portrait: "1024x1536",
};

// Logo control the shop can request. "auto" (default) = smart placement in the
// clearest spot; "none" = don't stamp the logo; the rest force an anchor.
const LOGO_CHOICES = [
  "auto",
  "none",
  "bottom-right",
  "bottom-left",
  "bottom-center",
  "top-right",
  "top-left",
  "top-center",
] as const;

export const proposeCampaignImage: MarketingTool = {
  name: NAME,
  description:
    "Generate a branded marketing IMAGE (banner / graphic / ad creative) from " +
    "a text description. Call this when the shop asks to 'add an image / " +
    "banner / graphic / visual' to a campaign or 'make a picture for' a " +
    "promotion. Produces ONE image proposal the shop reviews (approve / " +
    "regenerate) before it's used — you NEVER finalize or send it. Give a " +
    "vivid, specific `prompt` (subject, mood, and any on-image text like " +
    "'20% OFF'). The shop's brand colors + logo are applied automatically — " +
    "don't ask for them. Prompt ≤1000 chars.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROMPT,
        description:
          "Vivid description of the image (subject, mood, any on-image text). " +
          "Brand colors + logo are applied automatically.",
      },
      orientation: {
        type: "string",
        enum: ["landscape", "square", "portrait"],
        description:
          "Image shape. landscape = email banner (default), square = social/ad, " +
          "portrait = story. If the shop asks for a specific shape — 'banner' or " +
          "'landscape' → landscape; 'square' → square; 'story', 'vertical', or " +
          "'portrait' → portrait — set this to match.",
      },
      logo: {
        type: "string",
        enum: [...LOGO_CHOICES],
        description:
          "Where to place the shop's logo. 'auto' (default) = smart placement " +
          "in the clearest spot so it doesn't cover text/subjects. Set 'none' if " +
          "the shop says NOT to include the logo. Set a specific anchor if they " +
          "ask — e.g. 'logo at the bottom center' → bottom-center, 'top left' → " +
          "top-left. Only set this when the shop expresses a preference; " +
          "otherwise omit it (auto).",
      },
    },
    required: ["prompt"],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const a = args as { prompt?: unknown; orientation?: unknown; logo?: unknown };
    const prompt = typeof a.prompt === "string" ? a.prompt.trim() : "";
    if (prompt.length === 0) {
      throw new Error(`${NAME}: prompt is required`);
    }

    const orientation =
      typeof a.orientation === "string" ? a.orientation : "landscape";
    const dimensions = ORIENTATION[orientation] ?? ORIENTATION.landscape;

    // Logo control: "none" → don't stamp it; an anchor → force it there; else
    // (or unrecognized) → "auto" smart placement.
    const logoChoice =
      typeof a.logo === "string" && (LOGO_CHOICES as readonly string[]).includes(a.logo)
        ? a.logo
        : "auto";
    const overlayLogo = logoChoice !== "none";
    const logoPlacement = (logoChoice === "none" ? "auto" : logoChoice) as LogoPlacement;

    // Shop-scoped: shopId from the JWT-sourced ctx, never from Claude's args.
    const service = new ImageGenerationService({ pool: ctx.pool });
    const outcome = await service.generate(ctx.shopId, {
      prompt,
      dimensions,
      useCase: "marketing",
      overlayLogo,
      logoPlacement,
    });

    if (!outcome.ok || !outcome.imageUrl) {
      // Disabled / over cap / flagged / failed — relay the reason in prose.
      return {
        data: {
          generated: false,
          reason: outcome.error ?? "Image generation failed. Please try again.",
        },
      };
    }

    return {
      data: {
        generated: true,
        imageUrl: outcome.imageUrl,
        costUsd: outcome.costUsd,
      },
      display: {
        kind: "campaign_image_proposal",
        imageUrl: outcome.imageUrl,
        imageKey: outcome.imageKey ?? null,
        altText: prompt.slice(0, 200),
        prompt,
        operationType: "generate",
        dimensions: outcome.dimensions ?? dimensions,
      },
    };
  },
};
