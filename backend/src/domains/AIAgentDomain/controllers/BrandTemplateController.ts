// backend/src/domains/AIAgentDomain/controllers/BrandTemplateController.ts
//
// Branding Studio Phase 4 — on-demand brand templates.
//   POST /api/ai/brand-kit/templates/generate  { kinds?: TemplateKind[] }
//   GET  /api/ai/brand-kit/templates
//
// Shop-scoped via JWT. Generation delegates to BrandTemplateService →
// ImageGenerationService, which enforces the ai_images_enabled kill-switch + the
// monthly spend cap; we pass those outcomes back so the UI can explain a 403/429.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import {
  BrandTemplateService,
  TEMPLATE_KINDS,
  TemplateKind,
} from "../services/BrandTemplateService";

export interface BrandTemplateControllerDeps {
  templates?: BrandTemplateService;
}

export function makeBrandTemplateController(deps: BrandTemplateControllerDeps = {}) {
  const templates = deps.templates ?? new BrandTemplateService();

  return {
    // POST /templates/generate — render the requested kinds (default: all).
    generate: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      // Validate/normalize requested kinds.
      let kinds: TemplateKind[] = TEMPLATE_KINDS;
      if (Array.isArray(req.body?.kinds)) {
        kinds = req.body.kinds.filter((k: unknown): k is TemplateKind =>
          TEMPLATE_KINDS.includes(k as TemplateKind)
        );
        if (kinds.length === 0) {
          res.status(400).json({
            success: false,
            error: `kinds must include at least one of: ${TEMPLATE_KINDS.join(", ")}`,
          });
          return;
        }
      }

      const userPrompt =
        typeof req.body?.prompt === "string" ? req.body.prompt : undefined;
      try {
        const results = await templates.generateSet(shopId, kinds, userPrompt);
        const anyOk = results.some((r) => r.ok);
        // If everything failed for the same gate, surface that status so the UI
        // can show the right message (disabled / budget exhausted).
        if (!anyOk && results.length > 0) {
          const blocked = results.find((r) => r.status === 403 || r.status === 429);
          if (blocked) {
            res.status(blocked.status).json({
              success: false,
              // Pass the gate's OWN message through — ImageGenerationService now
              // distinguishes the 403 reasons (below-tier → "upgrade to Growth";
              // kill-switch off → "ask an admin"). Flattening them all to "ask an
              // admin" was misleading for below-tier shops.
              error:
                blocked.error ||
                (blocked.status === 403
                  ? "AI image generation isn't available on your plan yet."
                  : "Your monthly AI budget is exhausted. Try again next month."),
              data: { results },
            });
            return;
          }
        }
        res.json({ success: true, data: { results } });
      } catch (err) {
        logger.error("BrandTemplateController.generate failed", err);
        res.status(503).json({
          success: false,
          error: "Couldn't generate templates right now. Please try again.",
        });
      }
    },

    // POST /generate-banner — generate a shop banner (header). Returns the image
    // URL; the client persists it to shops.banner_url. Same gates as templates.
    generateBanner: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      const userPrompt =
        typeof req.body?.prompt === "string" ? req.body.prompt : undefined;
      try {
        const r = await templates.generateBanner(shopId, userPrompt);
        if (!r.ok) {
          res.status(r.status === 403 || r.status === 429 ? r.status : 502).json({
            success: false,
            // Pass the gate's OWN message through (below-tier vs kill-switch vs cap).
            error:
              r.error ||
              (r.status === 403
                ? "AI image generation isn't available on your plan yet."
                : r.status === 429
                ? "Your monthly AI budget is exhausted. Try again next month."
                : "Couldn't generate a banner. Please try again."),
          });
          return;
        }
        res.json({ success: true, data: { url: r.url } });
      } catch (err) {
        logger.error("BrandTemplateController.generateBanner failed", err);
        res.status(503).json({
          success: false,
          error: "Couldn't generate a banner right now. Please try again.",
        });
      }
    },

    // GET /templates — list the shop's generated templates.
    list: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      try {
        const data = await templates.listTemplates(shopId);
        res.json({ success: true, data });
      } catch (err) {
        logger.error("BrandTemplateController.list failed", err);
        res.status(503).json({
          success: false,
          error: "Couldn't load templates right now. Please try again.",
        });
      }
    },

    // DELETE /templates/:id — hard-delete one of the shop's generated templates
    // (image in DO Spaces + the ledger row). Shop-scoped via JWT + the service's
    // `AND shop_id` guard, so a shop can only ever delete its own asset.
    remove: async (req: Request, res: Response): Promise<void> => {
      const shopId = (req as any).user?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: "Shop ID required" });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ success: false, error: "Invalid template id" });
        return;
      }
      try {
        const r = await templates.deleteTemplate(shopId, id);
        if (!r.ok) {
          res
            .status(r.status)
            .json({ success: false, error: r.error || "Couldn't delete template." });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error("BrandTemplateController.remove failed", err);
        res.status(503).json({
          success: false,
          error: "Couldn't delete the template right now. Please try again.",
        });
      }
    },
  };
}

let _default: ReturnType<typeof makeBrandTemplateController> | null = null;
function getDefaults() {
  if (!_default) _default = makeBrandTemplateController();
  return _default;
}

export function generateBrandTemplates(req: Request, res: Response): Promise<void> {
  return getDefaults().generate(req, res);
}
export function listBrandTemplates(req: Request, res: Response): Promise<void> {
  return getDefaults().list(req, res);
}
export function generateShopBanner(req: Request, res: Response): Promise<void> {
  return getDefaults().generateBanner(req, res);
}
export function deleteBrandTemplate(req: Request, res: Response): Promise<void> {
  return getDefaults().remove(req, res);
}
