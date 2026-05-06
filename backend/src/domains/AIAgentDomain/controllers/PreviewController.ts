// backend/src/domains/AIAgentDomain/controllers/PreviewController.ts
//
// POST /api/ai/preview — shop-side live preview of what the AI will say
// for a given service + tone. Used by the AISalesAssistantSection on the
// shop dashboard's create/edit service page.
//
// Phase 3 Task 6. Replaces frontend's hardcoded aiPreviewMocks.ts (Phase 7
// will swap the frontend to call this endpoint).
//
// Cost-conscious design:
//   - Always uses Haiku 4.5 (10x cheaper than Sonnet, sufficient for previews)
//   - 1-hour in-memory cache per (serviceId, tone) to prevent budget burn
//     when shop owners hit refresh repeatedly
//   - Sample question is fixed unless the shop owner provides one — keeps
//     cache key bounded
//
// Auth: shop must own the service OR be admin.

import { Request, Response } from "express";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { AnthropicClient } from "../services/AnthropicClient";
import { buildSystemPrompt } from "../services/PromptTemplates";
import { logger } from "../../../utils/logger";
import {
  AgentContext,
  AITone,
  ClaudeModel,
} from "../types";

const PREVIEW_MODEL: ClaudeModel = "claude-haiku-4-5-20251001";
const PREVIEW_MAX_TOKENS = 250;
const DEFAULT_SAMPLE_QUESTION = "Hi! How much does this cost and when can I book?";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const VALID_TONES: AITone[] = ["friendly", "professional", "urgent"];

interface CacheEntry {
  reply: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  cachedAt: number;
}

const previewCache = new Map<string, CacheEntry>();

/**
 * Test-only: clear the cache. Exposed for unit tests; production code never
 * calls this.
 */
export function _clearPreviewCacheForTests(): void {
  previewCache.clear();
}

/**
 * Build a synthetic AgentContext for preview. No real customer data is fetched
 * — the AI demo doesn't personalize for the shop owner's preview. This keeps
 * cache hit rates high and avoids leaking real customer info into preview UI.
 */
function buildPreviewContext(
  service: any,
  shop: { shopName: string; category: string | null },
  tone: AITone
): AgentContext {
  return {
    service: {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      description: service.description ?? "",
      priceUsd: Number(service.priceUsd ?? 0),
      durationMinutes: service.durationMinutes,
      category: service.category ?? "general",
      customInstructions: service.aiCustomInstructions ?? null,
      bookingAssistance: service.aiBookingAssistance ?? false,
      suggestUpsells: false, // No siblings in preview to keep prompt size + cost bounded
    },
    customer: {
      address: "0xPREVIEW",
      name: "Sample Customer",
      tier: "BRONZE",
      rcnBalance: 0,
      joinedAt: null,
    },
    shop: {
      shopId: service.shopId,
      shopName: shop.shopName,
      category: shop.category,
      hoursSummary: null,
      timezone: null,
    },
    conversationHistory: [], // Fresh conversation for preview
    siblingServices: [],
  };
}

interface PreviewRequestBody {
  serviceId: string;
  tone?: AITone;
  sampleQuestion?: string;
}

export interface PreviewControllerDeps {
  serviceRepo?: ServiceRepository;
  anthropicClient?: AnthropicClient;
}

/**
 * Factory: returns an Express handler for POST /api/ai/preview.
 *
 * Body: { serviceId, tone?, sampleQuestion? }
 * Returns: { reply, model, latencyMs, costUsd, cached }
 *
 * Auth: handled by route-level middleware. Caller is either shop owner of
 * the service, OR an admin.
 *
 * Tests inject mocked deps via the factory; production passes none and gets
 * fresh ServiceRepository + AnthropicClient instances.
 */
export function makePreviewAIReply(deps: PreviewControllerDeps = {}) {
  const repo = deps.serviceRepo ?? new ServiceRepository();
  const client = deps.anthropicClient ?? new AnthropicClient();

  return async function previewAIReply(req: Request, res: Response): Promise<void> {
    try {
    const body = req.body as PreviewRequestBody;
    const { serviceId } = body || {};
    const sampleQuestion = body?.sampleQuestion?.trim() || DEFAULT_SAMPLE_QUESTION;

    if (!serviceId) {
      res.status(400).json({ success: false, error: "serviceId is required" });
      return;
    }

    // Load the service
    const service = await repo.getServiceById(serviceId);
    if (!service) {
      res.status(404).json({ success: false, error: "Service not found" });
      return;
    }

    // Auth: shop owner of THIS service, or admin
    const userRole = (req as any).user?.role;
    const userShopId = (req as any).user?.shopId;
    const isAdmin = userRole === "admin";
    const isOwnerShop = userRole === "shop" && userShopId === service.shopId;
    if (!isAdmin && !isOwnerShop) {
      res.status(403).json({
        success: false,
        error: "Only the shop that owns this service or an admin can preview AI replies",
      });
      return;
    }

    // Resolve tone — body wins, else service's stored tone, else professional
    const requestedTone = body?.tone;
    const tone: AITone = requestedTone && VALID_TONES.includes(requestedTone)
      ? requestedTone
      : (service.aiTone as AITone) || "professional";

    // Cache key. Custom sampleQuestion bypasses cache to avoid unbounded
    // key explosion — only the default question is cached.
    const useCache = !body?.sampleQuestion;
    const cacheKey = `${serviceId}:${tone}`;

    if (useCache) {
      const hit = previewCache.get(cacheKey);
      if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
        res.json({
          success: true,
          data: {
            reply: hit.reply,
            model: hit.model,
            latencyMs: hit.latencyMs,
            costUsd: hit.costUsd,
            cached: true,
          },
        });
        return;
      }
    }

    // Need shop info for the prompt — minimal lookup, no full repository call
    // (Treasury route uses raw pg; we'll do the same for one-off shop name + category)
    const { getSharedPool } = require("../../../utils/database-pool");
    const pool = getSharedPool();
    const shopRow = await pool.query(
      `SELECT name, category FROM shops WHERE shop_id = $1`,
      [service.shopId]
    );
    if (shopRow.rows.length === 0) {
      res.status(404).json({ success: false, error: "Shop not found for this service" });
      return;
    }
    const shop = {
      shopName: shopRow.rows[0].name as string,
      category: (shopRow.rows[0].category as string) ?? null,
    };

    // Build synthetic context + prompt
    const ctx = buildPreviewContext(service, shop, tone);
    const systemPrompt = buildSystemPrompt(tone, ctx);

    // Call Claude — Haiku for speed + low cost on previews
    const response = await client.complete({
      systemPrompt: [{ text: systemPrompt, cache: true }],
      messages: [{ role: "user", content: sampleQuestion }],
      model: PREVIEW_MODEL,
      maxTokens: PREVIEW_MAX_TOKENS,
    });

    const result = {
      reply: response.text,
      model: response.model,
      latencyMs: response.latencyMs,
      costUsd: response.costUsd,
      cached: false,
    };

    if (useCache) {
      previewCache.set(cacheKey, {
        reply: result.reply,
        model: result.model,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        cachedAt: Date.now(),
      });
    }

    res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error("AI preview failed", err);
      const status = err?.status === 429 ? 429 : 500;
      res.status(status).json({
        success: false,
        error: status === 429 ? "Anthropic rate limit hit — try again in a moment" : "Failed to generate preview",
      });
    }
  };
}

/**
 * Default Express handler for POST /api/ai/preview.
 * Lazily instantiates dependencies on first request — avoids requiring
 * ANTHROPIC_API_KEY at module-load time (which would break test imports
 * and non-AI server boot paths).
 */
let _defaultHandler: ReturnType<typeof makePreviewAIReply> | null = null;
export function previewAIReply(req: Request, res: Response): Promise<void> {
  if (!_defaultHandler) {
    _defaultHandler = makePreviewAIReply();
  }
  return _defaultHandler(req, res);
}
