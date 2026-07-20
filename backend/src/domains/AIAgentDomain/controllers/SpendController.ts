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
import { getShopAiBudget } from "../../../utils/shopTier";
import { logger } from "../../../utils/logger";
import { shopRepository } from "../../../repositories";
import { getStripeService } from "../../../services/StripeService";
import { AiOverageChargeRepository } from "../../../repositories/AiOverageChargeRepository";
import { AiOverageStripeService, aiOverageStripeService } from "../services/AiOverageStripeService";

export interface SpendControllerDeps {
  pool?: Pool;
  /** Whether the shop has a usable payment method on file — gate for enabling overage.
   *  Injectable for tests; default resolves the shop's Stripe customer + lists cards. */
  hasPaymentMethod?: (shopId: string) => Promise<boolean>;
  /** Admin overage rollup — injectable for tests; default reads the ai_overage_charges ledger. */
  getOverageSummary?: () => ReturnType<AiOverageChargeRepository["getAllShopsMonthSummary"]>;
  /** Slice 3 Stripe invoicing — injectable for tests; default = the real service (flag-gated). */
  overageStripe?: Pick<AiOverageStripeService, "invoiceShopPending" | "invoiceAllDue">;
}

/** Default card-on-file check: shop's Stripe customer (from the $500 subscription) has ≥1 payment method. */
async function defaultHasPaymentMethod(shopId: string): Promise<boolean> {
  try {
    const shop = await shopRepository.getShop(shopId);
    if (!shop?.stripeCustomerId) return false;
    const pms = await getStripeService().listPaymentMethods(shop.stripeCustomerId);
    return Array.isArray(pms) && pms.length > 0;
  } catch (err) {
    logger.error("defaultHasPaymentMethod failed", { shopId, error: (err as Error)?.message });
    return false; // fail closed — no proof of a card ⇒ don't let them enable a billable feature
  }
}

/**
 * Factory: returns Express handlers. Tests inject mocked pool; production
 * gets the shared pool. Same pattern as PreviewController.
 */
export function makeSpendControllers(deps: SpendControllerDeps = {}) {
  const pool = deps.pool ?? getSharedPool();
  const hasPaymentMethod = deps.hasPaymentMethod ?? defaultHasPaymentMethod;
  const getOverageSummary = deps.getOverageSummary ?? (() => new AiOverageChargeRepository().getAllShopsMonthSummary());
  const overageStripe = deps.overageStripe ?? aiOverageStripeService;

  return {
    getOwnShopSpend: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        // Budget = the shop's tier allowance ($10/$30/$75), read-only. The stored monthly_budget_usd is inert.
        const budget = await getShopAiBudget(shopId);

        const settings = await pool.query<{
          current_month_spend_usd: string;
          current_month_started_at: Date | null;
          ai_overage_enabled: boolean;
        }>(
          `SELECT current_month_spend_usd, current_month_started_at, ai_overage_enabled
           FROM ai_shop_settings
           WHERE shop_id = $1`,
          [shopId]
        );

        // AI Usage Overage add-on availability (T3.2) — the toggle is inert until the master flag is on.
        const overageAvailable = process.env.ENABLE_AI_OVERAGE === "true";

        if (settings.rows.length === 0) {
          // Shop has no AI settings row yet — treat as zero spend against the tier budget.
          // Don't auto-create the row from a GET endpoint.
          res.json({
            success: true,
            data: {
              currentMonthSpendUsd: 0,
              monthlyBudgetUsd: budget,
              percentUsed: 0,
              monthStartedAt: null,
              callsThisMonth: 0,
              overageEnabled: false,
              overageAvailable,
            },
          });
          return;
        }

        const row = settings.rows[0];
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

        // AI Usage Overage (T3.2 Slice 2) — the shop's accrued overage this month (billable Usage x3).
        // Only queried when the feature is live, so a normal shop pays no extra query cost.
        let overageChargeUsd = 0;
        if (overageAvailable) {
          const ov = await pool.query<{ amount_cents: string }>(
            `SELECT amount_cents FROM ai_overage_charges
             WHERE shop_id = $1 AND period_month = DATE_TRUNC('month', now())::date`,
            [shopId]
          );
          overageChargeUsd = ov.rows.length ? (parseFloat(ov.rows[0].amount_cents) || 0) / 100 : 0;
        }

        res.json({
          success: true,
          data: {
            currentMonthSpendUsd: spent,
            monthlyBudgetUsd: budget,
            percentUsed,
            monthStartedAt: row.current_month_started_at,
            callsThisMonth: parseInt(calls.rows[0]?.count ?? "0", 10),
            overageEnabled: row.ai_overage_enabled === true,
            overageAvailable,
            overageChargeUsd,
          },
        });
      } catch (err) {
        logger.error("SpendController.getOwnShopSpend failed", err);
        res.status(500).json({ success: false, error: "Failed to load spend" });
      }
    },

    /**
     * POST /api/ai/overage — shop enables/disables the AI Usage Overage add-on (T3.2 Slice 1).
     * Body: { enabled: boolean }. Gated by ENABLE_AI_OVERAGE (409 when the feature isn't live).
     * Upserts ai_shop_settings so a shop with no row yet can still opt in.
     */
    setOwnShopOverage: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        if (process.env.ENABLE_AI_OVERAGE !== "true") {
          res.status(409).json({ success: false, error: "AI Usage Overage is not available yet" });
          return;
        }
        const body = req.body ?? {};
        const enabled = body.enabled;
        if (typeof enabled !== "boolean") {
          res.status(400).json({ success: false, error: "`enabled` (boolean) is required" });
          return;
        }
        // Consent-at-enable (Slice 2.5): enabling requires an explicit acknowledgement of the
        // "Usage x3, pay as you grow" terms. Disabling doesn't. We stamp ai_overage_consent_at as the
        // audit trail. Consent is preserved on disable (historical record).
        if (enabled && body.consent !== true) {
          res.status(400).json({ success: false, error: "Consent to the Usage x3 overage terms is required to enable" });
          return;
        }
        // Card-required-to-enable (Slice 2.5): a billable feature needs a payment method on file so a
        // charge never fails. Enforced by default; AI_OVERAGE_REQUIRE_CARD=false bypasses it for
        // behavior-testing on staging (where shops may have no card).
        if (enabled && process.env.AI_OVERAGE_REQUIRE_CARD !== "false") {
          if (!(await hasPaymentMethod(shopId))) {
            res.status(402).json({
              success: false,
              error: "Add a payment method before enabling AI Usage Overage",
              code: "payment_method_required",
            });
            return;
          }
        }

        await pool.query(
          `INSERT INTO ai_shop_settings (shop_id, ai_overage_enabled, ai_overage_consent_at, current_month_started_at)
           VALUES ($1, $2, ${enabled ? "NOW()" : "NULL"}, NOW())
           ON CONFLICT (shop_id)
             DO UPDATE SET ai_overage_enabled = EXCLUDED.ai_overage_enabled${enabled ? ", ai_overage_consent_at = NOW()" : ""}, updated_at = NOW()`,
          [shopId, enabled]
        );

        res.json({ success: true, data: { overageEnabled: enabled } });
      } catch (err) {
        logger.error("SpendController.setOwnShopOverage failed", err);
        res.status(500).json({ success: false, error: "Failed to update overage setting" });
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

    /** GET /api/ai/admin/overage-summary — admin: per-shop AI Usage Overage this month + grand total. */
    getAdminOverageSummary: async (_req: Request, res: Response): Promise<void> => {
      try {
        const { shops, grandTotal } = await getOverageSummary();
        res.json({ success: true, data: { shops, grandTotal } });
      } catch (err) {
        logger.error("SpendController.getAdminOverageSummary failed", err);
        res.status(500).json({ success: false, error: "Failed to load overage summary" });
      }
    },

    /** POST /api/ai/admin/overage-invoice — admin: invoice a shop's pending overage via Stripe
     *  (body {shopId}), or all due shops (body {all:true}). Gated by AI_OVERAGE_STRIPE_ENABLED (501). */
    invoiceOverage: async (req: Request, res: Response): Promise<void> => {
      const body = req.body ?? {};
      try {
        if (body.all === true) {
          const results = await overageStripe.invoiceAllDue();
          res.json({ success: true, data: { results } });
          return;
        }
        if (!body.shopId || typeof body.shopId !== "string") {
          res.status(400).json({ success: false, error: "`shopId` (or `all:true`) is required" });
          return;
        }
        const result = await overageStripe.invoiceShopPending(body.shopId);
        res.json({ success: true, data: result });
      } catch (err: any) {
        const status = typeof err?.status === "number" ? err.status : 500;
        if (status >= 500) logger.error("SpendController.invoiceOverage failed", err);
        res.status(status).json({ success: false, error: err?.message || "Failed to invoice overage" });
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
export function setOwnShopOverage(req: Request, res: Response): Promise<void> {
  return getDefaults().setOwnShopOverage(req, res);
}
export function getAdminOverageSummary(req: Request, res: Response): Promise<void> {
  return getDefaults().getAdminOverageSummary(req, res);
}
export function invoiceOverage(req: Request, res: Response): Promise<void> {
  return getDefaults().invoiceOverage(req, res);
}
