// backend/src/domains/AIAgentDomain/controllers/MetricsController.ts
//
// GET /api/ai/metrics?range=30d — Shop-side AI Sales Agent Impact Metrics.
// See scope-doc:
//   docs/tasks/strategy/ai-sales-agent/ai-sales-agent-impact-metrics.md
//
// Responsibilities:
//   - Validate the `range` query param (default 30d).
//   - Look up the shop's `human_reply_baseline_minutes` (default 240).
//   - Call MetricsAggregator and return the combined response shape.
//
// Factory + lazy-default pattern mirrors SettingsController so tests can
// inject a mocked pool / aggregator. Server-side caching lands in Task 2.4.

import { Request, Response } from "express";
import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import {
  MetricsAggregator,
  ImpactMetrics,
  MetricsWindow,
} from "../services/MetricsAggregator";

// Mirrors SettingsController.DEFAULT_HUMAN_REPLY_BASELINE_MINUTES. Local
// to keep this change additive — hoist to constants.ts if a third caller
// shows up.
const DEFAULT_HUMAN_REPLY_BASELINE_MINUTES = 240;

export type MetricsRange = "7d" | "30d" | "90d" | "all";
export const DEFAULT_METRICS_RANGE: MetricsRange = "30d";
const VALID_RANGES: ReadonlySet<MetricsRange> = new Set([
  "7d",
  "30d",
  "90d",
  "all",
]);

export interface MetricsResponse extends ImpactMetrics {
  range: MetricsRange;
  baselineMinutes: number;
}

export interface RangeValidationResult {
  ok: boolean;
  error?: string;
  value?: MetricsRange;
}

/**
 * Parse the `range` query string. Absent → default 30d; invalid → reject.
 * Pure — exported for unit testing.
 */
export function parseMetricsRange(raw: unknown): RangeValidationResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: DEFAULT_METRICS_RANGE };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "range must be a string" };
  }
  if (!VALID_RANGES.has(raw as MetricsRange)) {
    return {
      ok: false,
      error: `range must be one of: ${Array.from(VALID_RANGES).join(", ")}`,
    };
  }
  return { ok: true, value: raw as MetricsRange };
}

/** Map the validated range to a SQL window lower bound. `all` → null. */
export function windowStartForRange(range: MetricsRange): MetricsWindow {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Read the shop's per-shop baseline. Missing row → safe default. */
async function fetchBaselineMinutes(
  pool: Pool,
  shopId: string
): Promise<number> {
  const r = await pool.query<{ human_reply_baseline_minutes: number | null }>(
    `SELECT human_reply_baseline_minutes
     FROM ai_shop_settings WHERE shop_id = $1`,
    [shopId]
  );
  if (r.rows.length === 0) return DEFAULT_HUMAN_REPLY_BASELINE_MINUTES;
  return r.rows[0].human_reply_baseline_minutes ?? DEFAULT_HUMAN_REPLY_BASELINE_MINUTES;
}

/** 60s default — dashboard reloads should hit the cache, not the DB. */
export const DEFAULT_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  data: MetricsResponse;
}

export interface MetricsControllerDeps {
  pool?: Pool;
  aggregator?: MetricsAggregator;
  /** Override clock for tests (defaults to Date.now). */
  now?: () => number;
  /** Override TTL for tests (defaults to DEFAULT_CACHE_TTL_MS). Set 0 to disable. */
  cacheTtlMs?: number;
}

export function makeMetricsController(deps: MetricsControllerDeps = {}) {
  const pool = deps.pool ?? getSharedPool();
  const aggregator = deps.aggregator ?? new MetricsAggregator({ pool });
  const now = deps.now ?? (() => Date.now());
  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  // Per-(shopId, range) response cache. Closure-scoped so each factory
  // instance has its own cache — tests don't see cross-test pollution.
  // Memory bound is (shops × ranges) — small in practice.
  const cache = new Map<string, CacheEntry>();

  const cacheKey = (shopId: string, range: MetricsRange) => `${shopId}:${range}`;

  return {
    getMetrics: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const parsed = parseMetricsRange(req.query?.range);
        if (!parsed.ok || !parsed.value) {
          res.status(400).json({ success: false, error: parsed.error });
          return;
        }
        const range = parsed.value;

        // Cache check — only successful aggregator responses are cached, so
        // a stale 5xx never gets served from cache.
        if (cacheTtlMs > 0) {
          const key = cacheKey(shopId, range);
          const entry = cache.get(key);
          const t = now();
          if (entry && entry.expiresAt > t) {
            res.json({ success: true, data: entry.data });
            return;
          }
          if (entry) cache.delete(key); // expired — drop
        }

        const baselineMinutes = await fetchBaselineMinutes(pool, shopId);
        const metrics = await aggregator.aggregate({
          shopId,
          windowStart: windowStartForRange(range),
          baselineMinutes,
        });

        const data: MetricsResponse = { range, baselineMinutes, ...metrics };

        if (cacheTtlMs > 0) {
          cache.set(cacheKey(shopId, range), {
            expiresAt: now() + cacheTtlMs,
            data,
          });
        }

        res.json({ success: true, data });
      } catch (err) {
        logger.error("MetricsController.getMetrics failed", err);
        res.status(500).json({
          success: false,
          error: "Failed to load AI metrics",
        });
      }
    },
  };
}

// Lazy default handler for production (matches SettingsController pattern).
let _defaultController: ReturnType<typeof makeMetricsController> | null = null;
function getDefaults() {
  if (!_defaultController) _defaultController = makeMetricsController();
  return _defaultController;
}

export function getMetrics(req: Request, res: Response): Promise<void> {
  return getDefaults().getMetrics(req, res);
}
