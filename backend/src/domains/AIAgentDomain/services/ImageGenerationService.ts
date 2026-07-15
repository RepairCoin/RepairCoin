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
import { shopHasFeature } from "../../../utils/shopTier";
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
  LogoPlacement,
} from "../../../services/LogoOverlayService";
import { SpendCapEnforcer } from "./SpendCapEnforcer";
import { BrandKitService } from "./BrandKitService";
import {
  ImageGenerationAuditLogger,
  imageGenerationAuditLogger,
} from "./ImageGenerationAuditLogger";
// NOTE: editing moved from Stability to gpt-image-1 (OpenAIImageClient.edit) —
// Stability SD3 img2img ignored the edit instruction. StabilityClient.ts is kept
// in the tree for reference but is no longer wired into this service.

export const MAX_PROMPT_CHARS = 1000;
export const DAILY_IMAGE_LIMIT = 50; // per shop / day

/** Human phrase for the area to keep clear for the logo, used in the generation
 *  prompt. For "auto" we ask the model to free up one corner (the picker then
 *  chooses the cleanest of the 6 candidate spots). */
function reservedAreaPhrase(placement: LogoPlacement): string {
  switch (placement) {
    case "bottom-center":
      return "the bottom-center area";
    case "top-center":
      return "the top-center area";
    case "bottom-right":
      return "the bottom-right corner";
    case "bottom-left":
      return "the bottom-left corner";
    case "top-right":
      return "the top-right corner";
    case "top-left":
      return "the top-left corner";
    case "auto":
    default:
      return "one corner (e.g. a bottom corner)";
  }
}

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

export interface EditParams {
  sourceImageUrl: string;
  prompt: string;
  /** img2img only: 0 keep source … 1 ignore source. Default 0.6. */
  strength?: number;
  overlayLogo?: boolean;
  useCase?: string;
  /** Output size override. Default = match the source's aspect ratio
   *  (preserves framing). Set to re-shape the edit (landscape/portrait/square). */
  dimensions?: ImageSize;
}

export interface GenerateParams {
  prompt: string;
  dimensions?: ImageSize;
  quality?: ImageQuality;
  useCase?: string;
  /** False = don't stamp the logo at all. Default true (when a logo exists). */
  overlayLogo?: boolean;
  /** Where to stamp the logo. Default "auto" (quietest spot). Ignored when
   *  overlayLogo is false. */
  logoPlacement?: LogoPlacement;
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

  /** Shared gates for generate + edit: kill-switch → spend cap → daily rate
   *  limit. Returns a blocking outcome, or null when all gates pass. */
  private async checkGates(shopId: string, useCase: string): Promise<GenerateOutcome | null> {
    try {
      const r = await this.pool.query<{ ai_images_enabled: boolean }>(
        `SELECT ai_images_enabled FROM ai_shop_settings WHERE shop_id = $1`,
        [shopId]
      );
      if (!r.rows[0]?.ai_images_enabled) {
        return { ok: false, status: 403, error: "AI image generation isn't enabled for this shop yet." };
      }
      // WS2 tier entitlement — AI Image Generation is a Growth+ feature. A stale "enabled" flag on a
      // below-tier shop can't bypass it.
      if (!(await shopHasFeature(shopId, "aiImageGen"))) {
        return { ok: false, status: 403, error: "AI image generation is available on the Growth plan and above — upgrade to use it." };
      }
    } catch (err) {
      logger.error("ImageGenerationService: kill-switch read failed", err);
      return { ok: false, status: 503, error: "Image generation is temporarily unavailable. Please try again." };
    }

    // WS3 soft-landing: text chat degrades to a cheaper model past the cap, but
    // image generation is expensive and CAN'T degrade — so, like BrandKit's vision
    // endpoints, it hard-stops at the cap. `allowed` stays true under soft-landing,
    // so we must also block on `limitReached` (else images keep spending past cap).
    // EXCEPTION: ads creative (useCase 'ads') is COGS, metered separately in
    // ad_ai_costs and exempt from the shop's included allowance (T3.3) — it must
    // NOT be blocked by the shop's AI cap.
    const isAds = useCase === "ads";
    const spendCheck = await this.spendCap.canSpend(shopId);
    if (!isAds && (!spendCheck.allowed || spendCheck.limitReached)) {
      return {
        ok: false,
        status: 429,
        error:
          "You've reached your plan's monthly AI limit. Upgrade your plan or add AI Usage overage to generate more images.",
      };
    }

    const todayCount = await this.auditLogger.countToday(shopId);
    if (todayCount >= DAILY_IMAGE_LIMIT) {
      return { ok: false, status: 429, error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow.` };
    }
    return null;
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
    const logoPlacement: LogoPlacement = params.logoPlacement ?? "auto";

    // 1-3. Gates: kill-switch → spend cap → daily rate limit.
    const gate = await this.checkGates(shopId, useCase);
    if (gate) return gate;

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
    let finalPrompt = this.brandKit.buildBrandedPrompt(prompt, kit);

    // If we're going to stamp the logo, ask the model to RESERVE that spot —
    // keep it clear of text/subjects so the logo doesn't clip the headline. This
    // is what makes "smart" placement actually clean rather than least-bad.
    const willStampLogo = overlayLogo && !!kit?.logoUrl;
    if (willStampLogo) {
      finalPrompt = `${finalPrompt} IMPORTANT: keep ${reservedAreaPhrase(logoPlacement)} of the image visually clean — no text, faces, or key subjects there — leaving room for a small logo.`;
    }

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
        const overlaid = await this.logoOverlay.overlaySafe(buffer, kit.logoUrl, {
          corner: logoPlacement,
        });
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

    // Ads creative is COGS (metered in ad_ai_costs), NOT part of the shop's
    // included AI allowance — don't drain the $10/$30/$75 pool with it (T3.3).
    if (useCase !== "ads") await this.spendCap.recordSpend(shopId, costUsd);
    return {
      ok: true, status: 200, imageUrl, imageKey: imageKey ?? undefined,
      dimensions, costUsd: Number(costUsd.toFixed(6)), revisedPrompt,
    };
  }

  /** Pick the gpt-image-1 size whose aspect ratio matches the source PNG so an
   *  edit keeps the original framing. Reads the PNG IHDR (no decode); falls back
   *  to the default landscape size for non-PNG / unreadable buffers. */
  private pickEditSize(buf: Buffer): ImageSize {
    let w = 0;
    let h = 0;
    // PNG: 8-byte signature, 4-byte length, "IHDR", then width/height (BE u32).
    if (buf.length >= 24 && buf.toString("ascii", 12, 16) === "IHDR") {
      w = buf.readUInt32BE(16);
      h = buf.readUInt32BE(20);
    }
    if (!w || !h) return DEFAULT_IMAGE_SIZE;
    const ratio = w / h;
    if (ratio >= 1.2) return "1536x1024"; // landscape
    if (ratio <= 0.83) return "1024x1536"; // portrait
    return "1024x1024"; // square
  }

  /**
   * Edit an existing image (Phase 6) via gpt-image-1 `/images/edits`. Same gates
   * as generate; downloads the source, sends it + the edit prompt to OpenAI,
   * optionally re-stamps the logo, stores + audits (operation_type 'edit',
   * vendor 'openai'). The edit prompt is the user's instruction — we do NOT
   * inject brand colors (the source already defines the look).
   * (Was Stability SD3 img2img, which ignored the instruction — see
   * OpenAIImageClient header.)
   */
  async edit(shopId: string, params: EditParams): Promise<GenerateOutcome> {
    const prompt = (params.prompt ?? "").trim();
    if (prompt.length === 0) {
      return { ok: false, status: 400, error: "An edit instruction is required." };
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return { ok: false, status: 400, error: `Prompt exceeds ${MAX_PROMPT_CHARS} characters.` };
    }
    const sourceImageUrl = (params.sourceImageUrl ?? "").trim();
    if (sourceImageUrl.length === 0) {
      return { ok: false, status: 400, error: "A source image is required to edit." };
    }
    const overlayLogo = params.overlayLogo !== false;
    const useCase = params.useCase ?? "marketing";

    const gate = await this.checkGates(shopId, useCase);
    if (gate) return gate;

    const mod = await this.moderation.check(prompt);
    if (mod.flagged) {
      await this.auditLogger.log({
        shopId, operationType: "edit", vendor: "openai", model: "gpt-image-1",
        prompt, sourceImageUrl, imageUrl: null, imageKey: null, dimensions: null, useCase,
        costUsd: 0, latencyMs: null, moderationFlagged: true,
        errorMessage: `moderation_flagged: ${mod.categories.join(",")}`,
      });
      return { ok: false, status: 400, error: "That edit was blocked by our content safety check. Try rephrasing it." };
    }

    const kit = await this.brandKit.getBrandKit(shopId);

    let imageUrl: string | null = null;
    let imageKey: string | null = null;
    let costUsd = 0;
    let latencyMs: number | null = null;
    let errorMessage: string | null = null;
    // The size we edit at — derived from the source's aspect ratio so the edit
    // keeps the original framing. Recorded + returned (was dropped before).
    let dimensions: string | null = null;

    try {
      const dl = await fetch(sourceImageUrl);
      if (!dl.ok) throw new Error(`source download failed (status ${dl.status})`);
      const sourceBuf = Buffer.from(await dl.arrayBuffer());

      // gpt-image-1 edit (not Stability — SD3 img2img ignored the instruction).
      // Output size: an explicit override (re-shape request) if given, else match
      // the source's aspect ratio so the edit keeps the original framing.
      const size = params.dimensions ?? this.pickEditSize(sourceBuf);
      dimensions = size;
      const edited = await this.dalle.edit(sourceBuf, prompt, size);
      costUsd = edited.costUsd;
      latencyMs = edited.latencyMs;
      let buffer: Buffer = Buffer.from(edited.b64Json, "base64");

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
      logger.error("ImageGenerationService: edit failed", { shopId, error: errorMessage });
    }

    await this.auditLogger.log({
      shopId, operationType: "edit", vendor: "openai", model: "gpt-image-1",
      prompt, sourceImageUrl, imageUrl, imageKey, dimensions, useCase,
      costUsd: imageUrl ? costUsd : 0, latencyMs, moderationFlagged: false, errorMessage,
    });

    if (!imageUrl) {
      return { ok: false, status: 503, error: "Image editing is temporarily unavailable. Please try again in a moment." };
    }

    // Ads creative is COGS (metered in ad_ai_costs), exempt from the shop's
    // included AI allowance — don't drain the pool with it (T3.3).
    if (useCase !== "ads") await this.spendCap.recordSpend(shopId, costUsd);
    return {
      ok: true, status: 200, imageUrl, imageKey: imageKey ?? undefined,
      dimensions: dimensions ?? undefined,
      costUsd: Number(costUsd.toFixed(6)), revisedPrompt: null,
    };
  }
}

export const imageGenerationService = new ImageGenerationService();
