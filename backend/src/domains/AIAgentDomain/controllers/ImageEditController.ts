// backend/src/domains/AIAgentDomain/controllers/ImageEditController.ts
//
// POST /api/ai/images/edit — edit an existing image from a prompt (AI Image
// Generation Phase 6, Stability img2img). Thin HTTP wrapper: validate the body,
// delegate to ImageGenerationService.edit (shared with the propose_image_edit
// tool). Same gates/audit/spend as generate.
//
// Request (JSON): { sourceImageUrl, prompt, strength?, overlayLogo? }
// Response: { success:true, data:{ imageUrl, imageKey, costUsd } } | { success:false, error }

import { Request, Response } from "express";
import {
  ImageGenerationService,
  imageGenerationService,
  MAX_PROMPT_CHARS,
} from "../services/ImageGenerationService";

interface ParsedEdit {
  sourceImageUrl: string;
  prompt: string;
  strength?: number;
  overlayLogo: boolean;
}

function parseBody(body: unknown): { value?: ParsedEdit; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }
  const b = body as Record<string, unknown>;

  const sourceImageUrl =
    typeof b.sourceImageUrl === "string" ? b.sourceImageUrl.trim() : "";
  if (sourceImageUrl.length === 0) {
    return { error: "`sourceImageUrl` is required" };
  }

  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (prompt.length === 0) return { error: "`prompt` is required" };
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { error: `\`prompt\` exceeds ${MAX_PROMPT_CHARS} characters` };
  }

  let strength: number | undefined;
  if (typeof b.strength === "number" && b.strength >= 0 && b.strength <= 1) {
    strength = b.strength;
  }

  const overlayLogo = b.overlayLogo !== false;

  return { value: { sourceImageUrl, prompt, strength, overlayLogo } };
}

export interface ImageEditDeps {
  service?: ImageGenerationService;
}

export function makeImageEditController(deps: ImageEditDeps = {}) {
  const service = deps.service ?? imageGenerationService;

  return {
    edit: async (req: Request, res: Response): Promise<void> => {
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

      const outcome = await service.edit(shopId, parsed.value);
      if (!outcome.ok) {
        res.status(outcome.status).json({ success: false, error: outcome.error });
        return;
      }
      res.json({
        success: true,
        data: {
          imageUrl: outcome.imageUrl,
          imageKey: outcome.imageKey,
          costUsd: outcome.costUsd,
        },
      });
    },
  };
}

let _default: ReturnType<typeof makeImageEditController> | null = null;
export function editImage(req: Request, res: Response): Promise<void> {
  if (!_default) _default = makeImageEditController();
  return _default.edit(req, res);
}
