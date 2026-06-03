// backend/src/domains/AIAgentDomain/controllers/BrandKitController.ts
//
// GET/PUT /api/ai/brand-kit — a shop's brand kit (colors + tone + logo URL) for
// AI Image Generation (Phase 3). The image generator injects these into every
// prompt (BrandKitService.buildBrandedPrompt) so output looks on-brand.
//
// Shop-scoped via JWT: shopId comes from req.user, never a path/body param, so
// a shop can only ever read/write its OWN kit. Logo bytes are uploaded via the
// existing image-upload flow; this endpoint just stores the resulting URL.
//
// Factory + lazy-default singleton mirrors SettingsController /
// HelpAssistantController; tests inject a mock service via `deps`.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import {
  BrandKitService,
  validateBrandKitUpdate,
} from "../services/BrandKitService";

export interface BrandKitControllerDeps {
  brandKit?: BrandKitService;
}

export function makeBrandKitController(deps: BrandKitControllerDeps = {}) {
  const brandKit = deps.brandKit ?? new BrandKitService();

  return {
    // GET — the shop's own kit (nulls when unset).
    getOwn: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      try {
        const kit = await brandKit.getBrandKit(shopId);
        res.json({
          success: true,
          data:
            kit ?? {
              logoUrl: null,
              primaryColorHex: null,
              secondaryColorHex: null,
              toneNotes: null,
            },
        });
      } catch (err) {
        logger.error("BrandKitController.getOwn failed", err);
        res.status(503).json({
          success: false,
          error: "Brand kit is temporarily unavailable. Please try again.",
        });
      }
    },

    // PUT — create or replace the shop's own kit.
    updateOwn: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      const parsed = validateBrandKitUpdate(req.body);
      if (parsed.error || !parsed.value) {
        res.status(400).json({
          success: false,
          error: parsed.error || "Invalid request",
        });
        return;
      }
      try {
        const kit = await brandKit.upsertBrandKit(shopId, parsed.value);
        res.json({ success: true, data: kit });
      } catch (err) {
        logger.error("BrandKitController.updateOwn failed", err);
        res.status(503).json({
          success: false,
          error: "Couldn't save the brand kit. Please try again.",
        });
      }
    },
  };
}

let _default: ReturnType<typeof makeBrandKitController> | null = null;
function getDefaults() {
  if (!_default) _default = makeBrandKitController();
  return _default;
}

export function getOwnBrandKit(req: Request, res: Response): Promise<void> {
  return getDefaults().getOwn(req, res);
}
export function updateOwnBrandKit(req: Request, res: Response): Promise<void> {
  return getDefaults().updateOwn(req, res);
}
