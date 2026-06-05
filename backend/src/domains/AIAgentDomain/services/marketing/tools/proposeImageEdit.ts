// backend/src/domains/AIAgentDomain/services/marketing/tools/proposeImageEdit.ts
//
// Tool: propose_image_edit (AI Image Generation Phase 6)
//
// Edits an EXISTING image from a prompt (gpt-image-1 /images/edits — Stability
// was retired, it ignored the edit instruction) and emits a
// `campaign_image_proposal` display (operationType "edit") the shop reviews
// before use — propose-then-tap (G2). Reuses the shared ImageGenerationService
// so the same gates/audit/spend apply.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { ImageGenerationService } from "../../ImageGenerationService";
import { ImageSize } from "../../../../../services/openai/OpenAIImageClient";

const NAME = "propose_image_edit";
const MAX_PROMPT = 1000;

// Optional re-shape of the edit output. Omit to keep the source's shape.
const SHAPE_TO_SIZE: Record<string, ImageSize> = {
  landscape: "1536x1024",
  square: "1024x1024",
  portrait: "1024x1536",
};

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
      shape: {
        type: "string",
        enum: ["landscape", "square", "portrait"],
        description:
          "Optional output shape. OMIT to keep the source image's shape (the " +
          "default — preserves framing). Set only if the shop asks to change it: " +
          "'make it a story/vertical' → portrait, 'banner/landscape' → landscape, " +
          "'square' → square.",
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
    const a = args as {
      source_image_url?: unknown;
      instruction?: unknown;
      shape?: unknown;
    };
    const modelUrlRaw =
      typeof a.source_image_url === "string" ? a.source_image_url.trim() : "";
    const prompt =
      typeof a.instruction === "string" ? a.instruction.trim() : "";
    if (prompt.length === 0) {
      throw new Error(`${NAME}: instruction is required`);
    }
    // Optional re-shape; undefined → edit keeps the source's shape.
    const dimensions =
      typeof a.shape === "string" ? SHAPE_TO_SIZE[a.shape] : undefined;

    // Resolve which image to edit. "Edit this" almost always means the image the
    // owner is LOOKING AT — but that image's URL lives in a frontend display
    // card + the prior tool_result, neither replayed into this turn's text, so
    // the model often omits it or guesses (sometimes a STALE url, e.g. an
    // earlier attachment — which then edits the wrong image at the wrong size).
    // Priority, strongest first:
    //   1. attachedImageUrl — a paperclip upload THIS turn ("edit this photo").
    //   2. lastImageUrl — the image currently displayed in the panel. This beats
    //      the model's url because it's literally what the owner sees, and it
    //      keeps the edit at the SAME size (pickEditSize reads the source).
    //   3. a shop-owned url the model supplied.
    //   4. the shop's most-recently generated/edited image.
    // A url is shop-owned if it carries the `/shops/{shopId}/` prefix.
    const isOwn = (u: string) => !!u && u.includes(`/shops/${ctx.shopId}/`);
    const modelUrl = isOwn(modelUrlRaw) ? modelUrlRaw : "";
    let sourceImageUrl =
      ctx.attachedImageUrl || ctx.lastImageUrl || modelUrl || "";
    if (!sourceImageUrl) {
      const latest = await ctx.pool.query(
        `SELECT image_url FROM ai_image_generations
          WHERE shop_id = $1 AND image_url IS NOT NULL
          ORDER BY id DESC LIMIT 1`,
        [ctx.shopId]
      );
      sourceImageUrl = (latest.rows[0]?.image_url as string | undefined) ?? "";
    }

    if (sourceImageUrl.length === 0) {
      // No usable source and nothing to fall back to — guide the shop instead
      // of erroring, so Claude relays it as prose (propose-then-tap, G2).
      return {
        data: {
          edited: false,
          reason:
            "There's no image to edit yet — generate one first, then ask me to edit it.",
        },
      };
    }

    const service = new ImageGenerationService({ pool: ctx.pool });
    const outcome = await service.edit(ctx.shopId, {
      sourceImageUrl,
      prompt,
      useCase: "marketing",
      dimensions,
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
