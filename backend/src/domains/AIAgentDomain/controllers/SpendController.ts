// backend/src/domains/AIAgentDomain/controllers/SpendController.ts
//
// Phase 3 Task 12 — surface AI spend data to shop owners + admins.
//
// Two endpoints:
//   GET /api/ai/spend                   — shop: own spend snapshot
//   GET /api/admin/ai/cost-summary      — admin: platform-wide aggregate
//
// Both read from `ai_shop_settings` (per-shop denormalized counters) and
// `ai_agent_messages` (audit log of every Claude call). The audit table is
// the source of truth for actual cost; ai_shop_settings.current_month_spend_usd
// is the running denormalized counter used by SpendCapEnforcer for fast
// per-call budget checks.

import { Request, Response } from "express";
import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

const DEFAULT_MONTHLY_BUDGET = 20.0;

export interface SpendControllerDeps {
  pool?: Pool;
}

/**
 * Factory: returns Express handlers. Tests inject mocked pool; production
 * gets the shared pool. Same pattern as PreviewController.
 */
export function makeSpendControllers(deps: SpendControllerDeps = {}) {
  const pool = deps.pool ?? getSharedPool();

  return {
    getOwnShopSpend: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const settings = await pool.query<{
          monthly_budget_usd: string;
          current_month_spend_usd: string;
          current_month_started_at: Date | null;
        }>(
          `SELECT monthly_budget_usd, current_month_spend_usd, current_month_started_at
           FROM ai_shop_settings
           WHERE shop_id = $1`,
          [shopId]
        );

        if (settings.rows.length === 0) {
          // Shop has no AI settings row yet — treat as zero spend with default
          // budget. Don't auto-create the row from a GET endpoint.
          res.json({
            success: true,
            data: {
              currentMonthSpendUsd: 0,
              monthlyBudgetUsd: DEFAULT_MONTHLY_BUDGET,
              percentUsed: 0,
              monthStartedAt: null,
              callsThisMonth: 0,
            },
          });
          return;
        }

        const row = settings.rows[0];
        const budget = parseFloat(row.monthly_budget_usd) || DEFAULT_MONTHLY_BUDGET;
        const spent = parseFloat(row.current_month_spend_usd) || 0;
        const percentUsed = budget > 0 ? spent / budget : 0;

        // Bonus: count of successful Claude calls this month from the audit
        // log. Useful diagnostic when the spend counter looks suspiciously
        // low — operator can check whether calls are happening at all.
        const calls = await pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM ai_agent_messages
           WHERE shop_id = $1
             AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
             AND error_message IS NULL`,
          [shopId]
        );

        res.json({
          success: true,
          data: {
            currentMonthSpendUsd: spent,
            monthlyBudgetUsd: budget,
            percentUsed,
            monthStartedAt: row.current_month_started_at,
            callsThisMonth: parseInt(calls.rows[0]?.count ?? "0", 10),
          },
        });
      } catch (err) {
        logger.error("SpendController.getOwnShopSpend failed", err);
        res.status(500).json({ success: false, error: "Failed to load spend" });
      }
    },

    getAdminCostSummary: async (_req: Request, res: Response): Promise<void> => {
      try {
        // Platform-wide aggregate from the audit log (source of truth) + the
        // per-shop counters (denormalized snapshot). We surface BOTH because
        // a drift between them is a useful operational signal.
        const auditAggregate = await pool.query<{
          total_calls: string;
          successful_calls: string;
          failed_calls: string;
          total_cost_usd: string;
          total_input_tokens: string;
          total_output_tokens: string;
        }>(
          `SELECT
             COUNT(*)::text AS total_calls,
             COUNT(*) FILTER (WHERE error_message IS NULL)::text AS successful_calls,
             COUNT(*) FILTER (WHERE error_message IS NOT NULL)::text AS failed_calls,
             COALESCE(SUM(cost_usd), 0)::text AS total_cost_usd,
             COALESCE(SUM(input_tokens), 0)::text AS total_input_tokens,
             COALESCE(SUM(output_tokens), 0)::text AS total_output_tokens
           FROM ai_agent_messages
           WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
        );

        const topSpenders = await pool.query<{
          shop_id: string;
          calls: string;
          cost_usd: string;
        }>(
          `SELECT shop_id,
                  COUNT(*)::text AS calls,
                  COALESCE(SUM(cost_usd), 0)::text AS cost_usd
           FROM ai_agent_messages
           WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
             AND error_message IS NULL
           GROUP BY shop_id
           ORDER BY SUM(cost_usd) DESC NULLS LAST
           LIMIT 10`
        );

        const denormalizedTotal = await pool.query<{
          shops_with_spend: string;
          ai_enabled_shops: string;
          counter_total_usd: string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE current_month_spend_usd > 0)::text AS shops_with_spend,
             COUNT(*) FILTER (WHERE ai_global_enabled = true)::text AS ai_enabled_shops,
             COALESCE(SUM(current_month_spend_usd), 0)::text AS counter_total_usd
           FROM ai_shop_settings`
        );

        const audit = auditAggregate.rows[0];
        const counters = denormalizedTotal.rows[0];
        const totalCalls = parseInt(audit.total_calls, 10);
        const successfulCalls = parseInt(audit.successful_calls, 10);
        const failedCalls = parseInt(audit.failed_calls, 10);
        const auditTotal = parseFloat(audit.total_cost_usd);
        const counterTotal = parseFloat(counters.counter_total_usd);

        res.json({
          success: true,
          data: {
            month: {
              totalCalls,
              successfulCalls,
              failedCalls,
              errorRate: totalCalls > 0 ? failedCalls / totalCalls : 0,
              totalCostUsd: auditTotal,
              avgCostPerCallUsd: successfulCalls > 0 ? auditTotal / successfulCalls : 0,
              totalInputTokens: parseInt(audit.total_input_tokens, 10),
              totalOutputTokens: parseInt(audit.total_output_tokens, 10),
            },
            topSpenders: topSpenders.rows.map((r) => ({
              shopId: r.shop_id,
              calls: parseInt(r.calls, 10),
              costUsd: parseFloat(r.cost_usd),
            })),
            shopCounters: {
              shopsWithSpend: parseInt(counters.shops_with_spend, 10),
              aiEnabledShops: parseInt(counters.ai_enabled_shops, 10),
              denormalizedTotalUsd: counterTotal,
              // Drift between the audit log (source of truth) and the
              // denormalized per-shop counters. A non-zero drift suggests
              // SpendCapEnforcer.recordSpend() is silently failing for some
              // calls (e.g., DB transient errors that get swallowed).
              counterDriftUsd: auditTotal - counterTotal,
            },
          },
        });
      } catch (err) {
        logger.error("SpendController.getAdminCostSummary failed", err);
        res.status(500).json({ success: false, error: "Failed to load cost summary" });
      }
    },
  };
}

// Lazy default handlers for production (matches PreviewController pattern).
let _defaultControllers: ReturnType<typeof makeSpendControllers> | null = null;
function getDefaults() {
  if (!_defaultControllers) _defaultControllers = makeSpendControllers();
  return _defaultControllers;
}

export function getOwnShopSpend(req: Request, res: Response): Promise<void> {
  return getDefaults().getOwnShopSpend(req, res);
}
export function getAdminCostSummary(req: Request, res: Response): Promise<void> {
  return getDefaults().getAdminCostSummary(req, res);
}
