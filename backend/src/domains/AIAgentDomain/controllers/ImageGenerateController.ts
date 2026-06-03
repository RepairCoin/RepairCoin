// backend/src/domains/AIAgentDomain/controllers/ImageGenerateController.ts
//
// POST /api/ai/images/generate — text → branded PNG stored in DigitalOcean
// Spaces (AI Image Generation Phase 1). See implementation.md §7 Phase 1.
//
// Request (JSON): { prompt, dimensions?, quality?, useCase? }
// Response: { success:true, data:{ imageUrl, imageKey, dimensions, costUsd,
//                                  revisedPrompt } }
//        |  { success:false, error } (+ 403/429/400/503 status)
//
// Pipeline (each step gates the next):
//   1. auth + shopId from JWT (never from the body)
//   2. ai_images_enabled kill switch (403 if off)
//   3. SpendCapEnforcer.canSpend (429 if monthly budget exhausted)
//   4. daily rate limit (429 if ≥ DAILY_IMAGE_LIMIT today)
//   5. prompt moderation (400 if flagged — audited, no image call)
//   6. brand-kit injection (colors + tone)
//   7. DALL·E 3 generate → temporary URL
//   8. download immediately (URL expires ~60 min) → buffer
//   9. persist to DO Spaces → public URL + key
//   10. audit row (ALWAYS — success or failure) + recordSpend (success only)
//
// Factory + lazy-default singleton mirrors HelpAssistantController /
// VoiceSpeakController; tests inject mocks via `deps`.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import {
  OpenAIImageClient,
  openAIImageClient,
  IMAGE_SIZES,
  ImageSize,
  ImageQuality,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_IMAGE_QUALITY,
} from "../../../services/openai/OpenAIImageClient";
import {
  OpenAIModerationClient,
  openAIModerationClient,
} from "../../../services/openai/OpenAIModerationClient";
import {
  ImageStorageService,
  imageStorageService,
} from "../../../services/ImageStorageService";
import {
  LogoOverlayService,
  logoOverlayService,
} from "../../../services/LogoOverlayService";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { BrandKitService } from "../services/BrandKitService";
import {
  ImageGenerationAuditLogger,
  imageGenerationAuditLogger,
} from "../services/ImageGenerationAuditLogger";

const MAX_PROMPT_CHARS = 1000; // DALL·E 3 hard cap is 4000; keep prompts tight
const DAILY_IMAGE_LIMIT = 50; // per shop / day (scope §8 risk row)
const VALID_USE_CASES = new Set(["marketing", "ad"]);

export interface ImageGenerateDeps {
  dalle?: OpenAIImageClient;
  moderation?: OpenAIModerationClient;
  storage?: ImageStorageService;
  spendCap?: SpendCapEnforcer;
  brandKit?: BrandKitService;
  logoOverlay?: LogoOverlayService;
  auditLogger?: ImageGenerationAuditLogger;
  pool?: Pool;
}

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

export function makeImageGenerateController(deps: ImageGenerateDeps = {}) {
  const dalle = deps.dalle ?? openAIImageClient;
  const moderation = deps.moderation ?? openAIModerationClient;
  const storage = deps.storage ?? imageStorageService;
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const brandKit = deps.brandKit ?? new BrandKitService();
  const logoOverlay = deps.logoOverlay ?? logoOverlayService;
  const auditLogger = deps.auditLogger ?? imageGenerationAuditLogger;
  const pool = deps.pool ?? getSharedPool();

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
      const { prompt, dimensions, quality, useCase, overlayLogo } = parsed.value;

      // 2. Kill switch — dark by default; flip ai_images_enabled per shop.
      try {
        const r = await pool.query<{ ai_images_enabled: boolean }>(
          `SELECT ai_images_enabled FROM ai_shop_settings WHERE shop_id = $1`,
          [shopId]
        );
        if (!r.rows[0]?.ai_images_enabled) {
          res.status(403).json({
            success: false,
            error: "AI image generation isn't enabled for this shop yet.",
          });
          return;
        }
      } catch (err) {
        logger.error("ImageGenerateController: kill-switch read failed", err);
        res.status(503).json({
          success: false,
          error: "Image generation is temporarily unavailable. Please try again.",
        });
        return;
      }

      // 3. Spend cap.
      const spendCheck = await spendCap.canSpend(shopId);
      if (!spendCheck.allowed) {
        res.status(429).json({
          success: false,
          error:
            "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
          details: {
            currentSpendUsd: spendCheck.currentSpendUsd,
            monthlyBudgetUsd: spendCheck.monthlyBudgetUsd,
            blockReason: spendCheck.blockReason,
          },
        });
        return;
      }

      // 4. Daily rate limit.
      const todayCount = await auditLogger.countToday(shopId);
      if (todayCount >= DAILY_IMAGE_LIMIT) {
        res.status(429).json({
          success: false,
          error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow.`,
        });
        return;
      }

      // 5. Moderation — reject flagged prompts BEFORE spending (audited).
      const mod = await moderation.check(prompt);
      if (mod.flagged) {
        await auditLogger.log({
          shopId,
          operationType: "generate",
          vendor: "openai",
          model: "gpt-image-1",
          prompt,
          sourceImageUrl: null,
          imageUrl: null,
          imageKey: null,
          dimensions,
          useCase,
          costUsd: 0,
          latencyMs: null,
          moderationFlagged: true,
          errorMessage: `moderation_flagged: ${mod.categories.join(",")}`,
        });
        res.status(400).json({
          success: false,
          error:
            "That request was blocked by our content safety check. Try rephrasing it.",
        });
        return;
      }

      // 6. Brand-kit injection (colors + tone; null-safe pre-Phase-3).
      const kit = await brandKit.getBrandKit(shopId);
      const finalPrompt = brandKit.buildBrandedPrompt(prompt, kit);

      // 7-9. Generate → download → persist. Audit + spend ALWAYS recorded.
      let imageUrl: string | null = null;
      let imageKey: string | null = null;
      let revisedPrompt: string | null = null;
      let costUsd = 0;
      let latencyMs: number | null = null;
      let errorMessage: string | null = null;

      try {
        const gen = await dalle.generate(finalPrompt, dimensions, quality);
        costUsd = gen.costUsd;
        latencyMs = gen.latencyMs;
        revisedPrompt = gen.revisedPrompt;

        // Get the image bytes — either download the temporary URL (expires
        // ~60 min) or decode inline base64, depending on what the API returned.
        let buffer: Buffer;
        if (gen.imageUrl) {
          const dl = await fetch(gen.imageUrl);
          if (!dl.ok) {
            throw new Error(`image download failed (status ${dl.status})`);
          }
          buffer = Buffer.from(await dl.arrayBuffer());
        } else if (gen.b64Json) {
          buffer = Buffer.from(gen.b64Json, "base64");
        } else {
          throw new Error("no image data returned");
        }

        // Phase 7 — stamp the shop's real logo (deterministic, pixel-exact).
        // Best-effort: a bad/missing logo never fails the generation. Baked in
        // BEFORE upload so the stored PNG already carries the logo.
        if (overlayLogo && kit?.logoUrl) {
          const overlaid = await logoOverlay.overlaySafe(buffer, kit.logoUrl);
          buffer = overlaid.buffer;
        }

        const stored = await storage.uploadBuffer(
          buffer,
          "image/png",
          `shops/${shopId}/ai-images`,
          "png"
        );
        if (!stored.success || !stored.url) {
          throw new Error(stored.error || "storage upload failed");
        }
        imageUrl = stored.url;
        imageKey = stored.key ?? null;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("ImageGenerateController: generation failed", {
          shopId,
          dimensions,
          error: errorMessage,
        });
      }

      // 10. Audit (always) + record spend (only when we actually got an image).
      await auditLogger.log({
        shopId,
        operationType: "generate",
        vendor: "openai",
        model: "gpt-image-1",
        prompt: finalPrompt,
        sourceImageUrl: null,
        imageUrl,
        imageKey,
        dimensions,
        useCase,
        costUsd: imageUrl ? costUsd : 0,
        latencyMs,
        moderationFlagged: false,
        errorMessage,
      });

      if (!imageUrl) {
        res.status(503).json({
          success: false,
          error:
            "Image generation is temporarily unavailable. Please try again in a moment.",
        });
        return;
      }

      await spendCap.recordSpend(shopId, costUsd);

      res.json({
        success: true,
        data: {
          imageUrl,
          imageKey,
          dimensions,
          costUsd: Number(costUsd.toFixed(6)),
          revisedPrompt,
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
