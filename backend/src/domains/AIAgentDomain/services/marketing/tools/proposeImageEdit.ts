// backend/src/domains/AIAgentDomain/services/marketing/tools/proposeImageEdit.ts
//
// Tool: propose_image_edit (AI Image Generation Phase 6)
//
// Edits an EXISTING image from a prompt (Stability img2img) and emits a
// `campaign_image_proposal` display (operationType "edit") the shop reviews
// before use — propose-then-tap (G2). Reuses the shared ImageGenerationService
// so the same gates/audit/spend apply.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { ImageGenerationService } from "../../ImageGenerationService";

const NAME = "propose_image_edit";
const MAX_PROMPT = 1000;

export const proposeImageEdit: MarketingTool = {
  name: NAME,
  description:
    "Edit an EXISTING image with a prompt. Call this when the shop wants to " +
    "MODIFY an image they already have — 'replace the background', 'make it " +
    "warmer', 'add a Black Friday overlay to this photo', 'match our brand " +
    "colors'. Requires `source_image_url` (the URL of a previously generated " +
    "image or the shop's uploaded photo) and an `instruction` describing the " +
    "change. Produces ONE edited proposal the shop reviews before use — you " +
    "NEVER finalize it. The shop's logo is re-applied automatically. " +
    "instruction ≤1000 chars.",
  inputSchema: {
    type: "object",
    properties: {
      source_image_url: {
        type: "string",
        description:
          "URL of the existing image to edit (a previously generated image or the shop's uploaded photo).",
      },
      instruction: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROMPT,
        description:
          "What to change — e.g. 'replace the background with a storefront', 'make the lighting warmer'.",
      },
    },
    required: ["source_image_url", "instruction"],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const a = args as { source_image_url?: unknown; instruction?: unknown };
    const sourceImageUrl =
      typeof a.source_image_url === "string" ? a.source_image_url.trim() : "";
    const prompt =
      typeof a.instruction === "string" ? a.instruction.trim() : "";
    if (sourceImageUrl.length === 0) {
      throw new Error(`${NAME}: source_image_url is required`);
    }
    if (prompt.length === 0) {
      throw new Error(`${NAME}: instruction is required`);
    }

    const service = new ImageGenerationService({ pool: ctx.pool });
    const outcome = await service.edit(ctx.shopId, {
      sourceImageUrl,
      prompt,
      useCase: "marketing",
    });

    if (!outcome.ok || !outcome.imageUrl) {
      return {
        data: {
          edited: false,
          reason: outcome.error ?? "Image edit failed. Please try again.",
        },
      };
    }

    return {
      data: {
        edited: true,
        imageUrl: outcome.imageUrl,
        costUsd: outcome.costUsd,
      },
      display: {
        kind: "campaign_image_proposal",
        imageUrl: outcome.imageUrl,
        imageKey: outcome.imageKey ?? null,
        altText: prompt.slice(0, 200),
        prompt,
        operationType: "edit",
        dimensions: outcome.dimensions ?? "",
      },
    };
  },
};
