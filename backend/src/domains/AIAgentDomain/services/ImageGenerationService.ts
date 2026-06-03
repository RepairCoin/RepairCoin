// backend/src/domains/AIAgentDomain/services/ImageGenerationService.ts
//
// The reusable image-generation pipeline (AI Image Generation). Extracted from
// ImageGenerateController so BOTH the HTTP route (POST /api/ai/images/generate)
// AND the marketing tool (propose_campaign_image, Phase 2) run the exact same
// gated pipeline: kill-switch → spend cap → daily rate limit → moderation →
// brand-kit prompt injection → generate (gpt-image-1) → download/decode →
// logo overlay (Phase 7) → store (DO Spaces) → audit → record spend.
//
// generate() returns a structured outcome (never throws into callers); the
// controller maps it to HTTP status, the tool maps it to a display/data result.

import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import {
  OpenAIImageClient,
  openAIImageClient,
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
import { SpendCapEnforcer } from "./SpendCapEnforcer";
import { BrandKitService } from "./BrandKitService";
import {
  ImageGenerationAuditLogger,
  imageGenerationAuditLogger,
} from "./ImageGenerationAuditLogger";

export const MAX_PROMPT_CHARS = 1000;
export const DAILY_IMAGE_LIMIT = 50; // per shop / day

export interface ImageGenerationDeps {
  dalle?: OpenAIImageClient;
  moderation?: OpenAIModerationClient;
  storage?: ImageStorageService;
  spendCap?: SpendCapEnforcer;
  brandKit?: BrandKitService;
  logoOverlay?: LogoOverlayService;
  auditLogger?: ImageGenerationAuditLogger;
  pool?: Pool;
}

export interface GenerateParams {
  prompt: string;
  dimensions?: ImageSize;
  quality?: ImageQuality;
  useCase?: string;
  overlayLogo?: boolean;
}

export interface GenerateOutcome {
  ok: boolean;
  /** Suggested HTTP status (200 ok, 400 bad/flagged, 403 disabled, 429 cap/
   *  rate, 503 unavailable). */
  status: number;
  error?: string;
  imageUrl?: string;
  imageKey?: string;
  dimensions?: string;
  costUsd?: number;
  revisedPrompt?: string | null;
}

export class ImageGenerationService {
  private dalle: OpenAIImageClient;
  private moderation: OpenAIModerationClient;
  private storage: ImageStorageService;
  private spendCap: SpendCapEnforcer;
  private brandKit: BrandKitService;
  private logoOverlay: LogoOverlayService;
  private auditLogger: ImageGenerationAuditLogger;
  private pool: Pool;

  constructor(deps: ImageGenerationDeps = {}) {
    this.dalle = deps.dalle ?? openAIImageClient;
    this.moderation = deps.moderation ?? openAIModerationClient;
    this.storage = deps.storage ?? imageStorageService;
    this.spendCap = deps.spendCap ?? new SpendCapEnforcer();
    this.brandKit = deps.brandKit ?? new BrandKitService();
    this.logoOverlay = deps.logoOverlay ?? logoOverlayService;
    this.auditLogger = deps.auditLogger ?? imageGenerationAuditLogger;
    this.pool = deps.pool ?? getSharedPool();
  }

  async generate(shopId: string, params: GenerateParams): Promise<GenerateOutcome> {
    const prompt = (params.prompt ?? "").trim();
    if (prompt.length === 0) {
      return { ok: false, status: 400, error: "A prompt is required." };
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return { ok: false, status: 400, error: `Prompt exceeds ${MAX_PROMPT_CHARS} characters.` };
    }
    const dimensions = params.dimensions ?? DEFAULT_IMAGE_SIZE;
    const quality = params.quality ?? DEFAULT_IMAGE_QUALITY;
    const useCase = params.useCase ?? "marketing";
    const overlayLogo = params.overlayLogo !== false;

    // 1. Kill switch — dark by default; flip ai_images_enabled per shop.
    try {
      const r = await this.pool.query<{ ai_images_enabled: boolean }>(
        `SELECT ai_images_enabled FROM ai_shop_settings WHERE shop_id = $1`,
        [shopId]
      );
      if (!r.rows[0]?.ai_images_enabled) {
        return { ok: false, status: 403, error: "AI image generation isn't enabled for this shop yet." };
      }
    } catch (err) {
      logger.error("ImageGenerationService: kill-switch read failed", err);
      return { ok: false, status: 503, error: "Image generation is temporarily unavailable. Please try again." };
    }

    // 2. Spend cap.
    const spendCheck = await this.spendCap.canSpend(shopId);
    if (!spendCheck.allowed) {
      return {
        ok: false,
        status: 429,
        error: "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
      };
    }

    // 3. Daily rate limit.
    const todayCount = await this.auditLogger.countToday(shopId);
    if (todayCount >= DAILY_IMAGE_LIMIT) {
      return { ok: false, status: 429, error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow.` };
    }

    // 4. Moderation — reject flagged prompts BEFORE spending (audited).
    const mod = await this.moderation.check(prompt);
    if (mod.flagged) {
      await this.auditLogger.log({
        shopId, operationType: "generate", vendor: "openai", model: "gpt-image-1",
        prompt, sourceImageUrl: null, imageUrl: null, imageKey: null, dimensions, useCase,
        costUsd: 0, latencyMs: null, moderationFlagged: true,
        errorMessage: `moderation_flagged: ${mod.categories.join(",")}`,
      });
      return { ok: false, status: 400, error: "That request was blocked by our content safety check. Try rephrasing it." };
    }

    // 5. Brand-kit injection (colors + tone; null-safe).
    const kit = await this.brandKit.getBrandKit(shopId);
    const finalPrompt = this.brandKit.buildBrandedPrompt(prompt, kit);

    // 6. Generate → bytes → logo overlay → persist. Audit + spend ALWAYS.
    let imageUrl: string | null = null;
    let imageKey: string | null = null;
    let revisedPrompt: string | null = null;
    let costUsd = 0;
    let latencyMs: number | null = null;
    let errorMessage: string | null = null;

    try {
      const gen = await this.dalle.generate(finalPrompt, dimensions, quality);
      costUsd = gen.costUsd;
      latencyMs = gen.latencyMs;
      revisedPrompt = gen.revisedPrompt;

      let buffer: Buffer;
      if (gen.imageUrl) {
        const dl = await fetch(gen.imageUrl);
        if (!dl.ok) throw new Error(`image download failed (status ${dl.status})`);
        buffer = Buffer.from(await dl.arrayBuffer());
      } else if (gen.b64Json) {
        buffer = Buffer.from(gen.b64Json, "base64");
      } else {
        throw new Error("no image data returned");
      }

      // Phase 7 — stamp the real logo (best-effort, baked in before upload).
      if (overlayLogo && kit?.logoUrl) {
        const overlaid = await this.logoOverlay.overlaySafe(buffer, kit.logoUrl);
        buffer = overlaid.buffer;
      }

      const stored = await this.storage.uploadBuffer(buffer, "image/png", `shops/${shopId}/ai-images`, "png");
      if (!stored.success || !stored.url) throw new Error(stored.error || "storage upload failed");
      imageUrl = stored.url;
      imageKey = stored.key ?? null;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("ImageGenerationService: generation failed", { shopId, dimensions, error: errorMessage });
    }

    await this.auditLogger.log({
      shopId, operationType: "generate", vendor: "openai", model: "gpt-image-1",
      prompt: finalPrompt, sourceImageUrl: null, imageUrl, imageKey, dimensions, useCase,
      costUsd: imageUrl ? costUsd : 0, latencyMs, moderationFlagged: false, errorMessage,
    });

    if (!imageUrl) {
      return { ok: false, status: 503, error: "Image generation is temporarily unavailable. Please try again in a moment." };
    }

    await this.spendCap.recordSpend(shopId, costUsd);
    return {
      ok: true, status: 200, imageUrl, imageKey: imageKey ?? undefined,
      dimensions, costUsd: Number(costUsd.toFixed(6)), revisedPrompt,
    };
  }
}

export const imageGenerationService = new ImageGenerationService();
