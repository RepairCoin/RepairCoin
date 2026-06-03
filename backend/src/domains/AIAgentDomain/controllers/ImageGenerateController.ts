// backend/src/domains/AIAgentDomain/controllers/ImageGenerateController.ts
//
// POST /api/ai/images/generate — text → branded PNG stored in DigitalOcean
// Spaces (AI Image Generation Phase 1). Thin HTTP wrapper: coerce + validate
// the request body, then delegate the gated pipeline to ImageGenerationService
// (shared with the marketing propose_campaign_image tool, Phase 2).
//
// Request (JSON): { prompt, dimensions?, quality?, useCase?, overlayLogo? }
// Response: { success:true, data:{ imageUrl, imageKey, dimensions, costUsd,
//                                  revisedPrompt } } | { success:false, error }

import { Request, Response } from "express";
import {
  IMAGE_SIZES,
  ImageSize,
  ImageQuality,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_IMAGE_QUALITY,
} from "../../../services/openai/OpenAIImageClient";
import {
  ImageGenerationService,
  imageGenerationService,
  MAX_PROMPT_CHARS,
} from "../services/ImageGenerationService";

const VALID_USE_CASES = new Set(["marketing", "ad"]);

interface ParsedBody {
  prompt: string;
  dimensions: ImageSize;
  quality: ImageQuality;
  useCase: string;
  overlayLogo: boolean;
}

function parseBody(body: unknown): { value?: ParsedBody; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }
  const b = body as Record<string, unknown>;

  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (prompt.length === 0) return { error: "`prompt` is required" };
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { error: `\`prompt\` exceeds ${MAX_PROMPT_CHARS} characters` };
  }

  const dimensions =
    typeof b.dimensions === "string" &&
    (IMAGE_SIZES as readonly string[]).includes(b.dimensions)
      ? (b.dimensions as ImageSize)
      : DEFAULT_IMAGE_SIZE;

  const quality: ImageQuality =
    b.quality === "low" || b.quality === "high"
      ? b.quality
      : DEFAULT_IMAGE_QUALITY;

  const useCase =
    typeof b.useCase === "string" && VALID_USE_CASES.has(b.useCase)
      ? b.useCase
      : "marketing";

  // Default true — stamp the brand logo when one is set; pass false to skip.
  const overlayLogo = b.overlayLogo !== false;

  return { value: { prompt, dimensions, quality, useCase, overlayLogo } };
}

export interface ImageGenerateDeps {
  service?: ImageGenerationService;
}

export function makeImageGenerateController(deps: ImageGenerateDeps = {}) {
  const service = deps.service ?? imageGenerationService;

  return {
    generate: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }

      const parsed = parseBody(req.body);
      if (parsed.error || !parsed.value) {
        res.status(400).json({
          success: false,
          error: parsed.error || "Invalid request",
        });
        return;
      }

      const outcome = await service.generate(shopId, parsed.value);
      if (!outcome.ok) {
        res.status(outcome.status).json({ success: false, error: outcome.error });
        return;
      }
      res.json({
        success: true,
        data: {
          imageUrl: outcome.imageUrl,
          imageKey: outcome.imageKey,
          dimensions: outcome.dimensions,
          costUsd: outcome.costUsd,
          revisedPrompt: outcome.revisedPrompt,
        },
      });
    },
  };
}

let _default: ReturnType<typeof makeImageGenerateController> | null = null;
export function generateImage(req: Request, res: Response): Promise<void> {
  if (!_default) _default = makeImageGenerateController();
  return _default.generate(req, res);
}
