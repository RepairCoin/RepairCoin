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
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import {
  BrandAssetVisionClient,
  brandAssetVisionClient,
} from "../services/BrandAssetVisionClient";

export interface BrandKitControllerDeps {
  brandKit?: BrandKitService;
  spendCap?: SpendCapEnforcer;
  vision?: BrandAssetVisionClient;
}

export function makeBrandKitController(deps: BrandKitControllerDeps = {}) {
  const brandKit = deps.brandKit ?? new BrandKitService();
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const vision = deps.vision ?? brandAssetVisionClient;

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
              logoOverrideUrl: null,
              shopLogoUrl: null,
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

    // POST /analyze-logo — Phase 4 vision: extract a brand palette from a logo
    // image URL so the brand-kit form can auto-fill the colors. Spend-capped.
    analyzeLogo: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      let logoUrl =
        typeof req.body?.logoUrl === "string" ? req.body.logoUrl.trim() : "";
      // Fall back to the shop's effective logo (override ?? shop profile logo)
      // so "Suggest colors from logo" works without re-passing a URL.
      if (logoUrl.length === 0) {
        const kit = await brandKit.getBrandKit(shopId);
        logoUrl = kit?.logoUrl ?? "";
      }
      if (logoUrl.length === 0) {
        res.status(400).json({
          success: false,
          error:
            "Add a logo first — set your shop logo under Settings → Shop Profile, or upload an override here.",
        });
        return;
      }

      const spend = await spendCap.canSpend(shopId);
      if (!spend.allowed) {
        res.status(429).json({
          success: false,
          error:
            "AI budget for this month is exhausted. Try again next month or enter colors manually.",
        });
        return;
      }

      try {
        const r = await vision.extractBrandColors(logoUrl);
        await spendCap.recordSpend(shopId, r.costUsd);
        res.json({
          success: true,
          data: {
            primaryColorHex: r.primaryColorHex,
            secondaryColorHex: r.secondaryColorHex,
            description: r.description,
          },
        });
      } catch (err) {
        logger.error("BrandKitController.analyzeLogo failed", err);
        res.status(503).json({
          success: false,
          error:
            "Couldn't analyze the logo right now. Please try again or enter colors manually.",
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
export function analyzeLogoColors(req: Request, res: Response): Promise<void> {
  return getDefaults().analyzeLogo(req, res);
}
