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
import { effectiveOverageCapUsd } from "../services/SpendCapEnforcer";

export interface SpendControllerDeps {
  pool?: Pool;
  /** Whether the shop has a usable payment method on file — gate for enabling overage.
   *  Injectable for tests; default resolves the shop's Stripe customer + lists cards. */
  hasPaymentMethod?: (shopId: string) => Promise<boolean>;
  /** Admin overage rollup — injectable for tests; default reads the ai_overage_charges ledger. */
  getOverageSummary?: () => ReturnType<AiOverageChargeRepository["getAllShopsMonthSummary"]>;
  /** Admin "ready to invoice" rollup (completed-month pending) — injectable for tests. */
  getPendingOverage?: () => ReturnType<AiOverageChargeRepository["getPendingSummary"]>;
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
  const getPendingOverage = deps.getPendingOverage ?? (() => new AiOverageChargeRepository().getPendingSummary());
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

        // Spend is DERIVED from ai_usage_events, exactly as SpendCapEnforcer.canSpend derives it
        // (same billable_to_shop + calendar-month scoping). This endpoint feeds the shop's own
        // "AI usage this month" panel, so reading the drifting current_month_spend_usd counter here
        // would show the shop a number lower than the one the cap is actually enforcing against —
        // "the meter says 65% but the AI degraded to Haiku" is a support ticket, not a rounding
        // difference (the counter ran $1.46 light on one shop this month).
        const settings = await pool.query<{
          derived_spend_usd: string;
          current_month_started_at: Date | null;
          ai_overage_enabled: boolean;
          overage_cap_usd: string | null;
        }>(
          `SELECT COALESCE((
                    SELECT SUM(cost_usd) FROM ai_usage_events e
                     WHERE e.shop_id = $1
                       AND e.billable_to_shop
                       AND NOT e.is_error
                       AND DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())
                  ), 0)::text AS derived_spend_usd,
                  current_month_started_at, ai_overage_enabled, overage_cap_usd
           FROM ai_shop_settings
           WHERE shop_id = $1`,
          [shopId]
        );

        // AI Usage Overage add-on availability (T3.2) — the toggle is inert until the master flag is on.
        const overageAvailable = process.env.ENABLE_AI_OVERAGE === "true";
        // Platform default cap (env), shown as the input placeholder / the effective cap when unset.
        const overageCapDefaultUsd = effectiveOverageCapUsd(null);

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
              overageCapUsd: null,
              overageCapDefaultUsd,
            },
          });
          return;
        }

        const row = settings.rows[0];
        const spent = parseFloat(row.derived_spend_usd) || 0;
        const percentUsed = budget > 0 ? spent / budget : 0;

        // Count of successful AI calls this month, across every surface. Previously counted
        // ai_agent_messages alone, which meant a shop whose usage was all Unified Assistant or
        // Insights saw "0 calls" next to a non-zero spend.
        const calls = await pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM ai_usage_events
           WHERE shop_id = $1
             AND billable_to_shop
             AND NOT is_error
             AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
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
            overageCapUsd: row.overage_cap_usd != null ? parseFloat(row.overage_cap_usd) : null,
            overageCapDefaultUsd,
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

    /**
     * POST /api/ai/overage/cap — shop sets its own bill-shock ceiling on billable overage (T3.2
     * per-shop cap). Body: { capUsd: number | null }. `null` (or omitted) clears it → inherit the
     * platform default. A positive number = "stop full-power AI at $X of overage this month". Gated by
     * ENABLE_AI_OVERAGE. Upserts so a shop with no row yet can still set it.
     */
    setOwnShopOverageCap: async (req: Request, res: Response): Promise<void> => {
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
        const raw = (req.body ?? {}).capUsd;
        // null / undefined / '' → clear (inherit the platform default).
        let capUsd: number | null = null;
        if (raw !== null && raw !== undefined && raw !== "") {
          const n = Number(raw);
          // Shops set a POSITIVE ceiling only; 0/negative/NaN is rejected (use clear to inherit default,
          // and "unlimited" is an admin-only concept, not a self-serve one).
          if (!Number.isFinite(n) || n <= 0) {
            res.status(400).json({ success: false, error: "`capUsd` must be a positive number, or null to use the default" });
            return;
          }
          capUsd = Math.round(n * 100) / 100; // clamp to cents
        }

        await pool.query(
          `INSERT INTO ai_shop_settings (shop_id, overage_cap_usd, current_month_started_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (shop_id) DO UPDATE SET overage_cap_usd = EXCLUDED.overage_cap_usd, updated_at = NOW()`,
          [shopId, capUsd]
        );

        res.json({ success: true, data: { overageCapUsd: capUsd, overageCapDefaultUsd: effectiveOverageCapUsd(null) } });
      } catch (err) {
        logger.error("SpendController.setOwnShopOverageCap failed", err);
        res.status(500).json({ success: false, error: "Failed to update overage cap" });
      }
    },

    /**
     * GET /api/ai/admin/cost-summary?days=30 — platform-wide AI spend.
     *
     * Reads ai_usage_events (migration 240), the union of every per-feature cost table. It used to
     * aggregate FROM ai_agent_messages alone, which reported ~30% of real spend — the customer-chat
     * table is not even the biggest line item (the Unified Assistant is). Every surface now counts.
     *
     * Three lenses, deliberately NOT summed together (they are different directions of money):
     *   cogs           — money OUT: what Anthropic/OpenAI/Stability cost us, ads AI included.
     *   overage        — money IN: billed separately via /admin/overage-summary.
     *   reconciliation — the audit vs the per-shop counters, as a drift alarm.
     *
     * `days` scopes cogs to a rolling window (default 30, max 365). Reconciliation ignores it and is
     * always the current calendar month, because that is the window the spend cap enforces on —
     * comparing a 90-day audit against a month-to-date counter would manufacture a drift that isn't real.
     */
    getAdminCostSummary: async (req: Request, res: Response): Promise<void> => {
      try {
        const rawDays = Number((req.query?.days as string) ?? 30);
        const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), 365) : 30;
        const since = `NOW() - INTERVAL '1 day' * ${days}`;

        const [totals, byFeature, byModel, byShop, trend, recon] = await Promise.all([
          // Headline COGS. `billable` splits out the ads-attributed spend, which bills to the ads
          // budget rather than any shop's AI allowance (D3) — so it belongs in COGS but must never
          // be mistaken for shop-consumed allowance.
          pool.query<{
            total_cost_usd: string; billable_cost_usd: string; ads_cost_usd: string;
            total_calls: string; failed_calls: string;
            total_input_tokens: string; total_output_tokens: string;
          }>(
            `SELECT COALESCE(SUM(cost_usd), 0)::text                                       AS total_cost_usd,
                    COALESCE(SUM(cost_usd) FILTER (WHERE billable_to_shop), 0)::text       AS billable_cost_usd,
                    COALESCE(SUM(cost_usd) FILTER (WHERE NOT billable_to_shop), 0)::text   AS ads_cost_usd,
                    COUNT(*)::text                                                          AS total_calls,
                    COUNT(*) FILTER (WHERE is_error)::text                                  AS failed_calls,
                    COALESCE(SUM(input_tokens), 0)::text                                    AS total_input_tokens,
                    COALESCE(SUM(output_tokens), 0)::text                                   AS total_output_tokens
               FROM ai_usage_events
              WHERE created_at >= ${since}`
          ),

          pool.query<{ feature: string; vendor: string; calls: string; cost_usd: string; billable: boolean }>(
            `SELECT feature, vendor, COUNT(*)::text AS calls,
                    COALESCE(SUM(cost_usd), 0)::text AS cost_usd,
                    bool_or(billable_to_shop) AS billable
               FROM ai_usage_events
              WHERE created_at >= ${since}
              GROUP BY feature, vendor
              ORDER BY SUM(cost_usd) DESC NULLS LAST`
          ),

          // Model mix — the lever behind cost per call (Haiku vs Sonnet). NULL model = a source that
          // doesn't record one (voice router, ads lead replies).
          pool.query<{ model: string | null; calls: string; cost_usd: string; input_tokens: string; output_tokens: string }>(
            `SELECT model, COUNT(*)::text AS calls,
                    COALESCE(SUM(cost_usd), 0)::text AS cost_usd,
                    COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
                    COALESCE(SUM(output_tokens), 0)::text AS output_tokens
               FROM ai_usage_events
              WHERE created_at >= ${since}
              GROUP BY model
              ORDER BY SUM(cost_usd) DESC NULLS LAST`
          ),

          pool.query<{ shop_id: string; shop_name: string | null; calls: string; cost_usd: string; billable_cost_usd: string }>(
            `SELECT e.shop_id, s.name AS shop_name, COUNT(*)::text AS calls,
                    COALESCE(SUM(e.cost_usd), 0)::text AS cost_usd,
                    COALESCE(SUM(e.cost_usd) FILTER (WHERE e.billable_to_shop), 0)::text AS billable_cost_usd
               FROM ai_usage_events e
               LEFT JOIN shops s ON s.shop_id = e.shop_id
              WHERE e.created_at >= ${since}
              GROUP BY e.shop_id, s.name
              ORDER BY SUM(e.cost_usd) DESC NULLS LAST
              LIMIT 25`
          ),

          pool.query<{ day: string; cost_usd: string; calls: string }>(
            `SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                    COALESCE(SUM(cost_usd), 0)::text AS cost_usd,
                    COUNT(*)::text AS calls
               FROM ai_usage_events
              WHERE created_at >= ${since}
              GROUP BY DATE_TRUNC('day', created_at)
              ORDER BY DATE_TRUNC('day', created_at)`
          ),

          // Reconciliation: the derived truth vs the denormalized counter, per shop, THIS MONTH.
          // Since canSpend now derives, the counter no longer gates anything — but it is still
          // incremented on every call, which makes it a free canary: a growing drift means
          // recordSpend is silently failing somewhere, or a surface is spending without logging.
          pool.query<{ shop_id: string; shop_name: string | null; derived_usd: string; counter_usd: string }>(
            `SELECT s.shop_id, sh.name AS shop_name,
                    COALESCE(d.c, 0)::text            AS derived_usd,
                    s.current_month_spend_usd::text   AS counter_usd
               FROM ai_shop_settings s
               LEFT JOIN shops sh ON sh.shop_id = s.shop_id
               LEFT JOIN (
                 -- Must match SpendCapEnforcer.canSpend's filter EXACTLY (billable, non-error,
                 -- current month). A drift panel comparing two different definitions of "spend"
                 -- reports differences that aren't drift.
                 SELECT shop_id, SUM(cost_usd) AS c
                   FROM ai_usage_events
                  WHERE billable_to_shop
                    AND NOT is_error
                    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
                  GROUP BY shop_id
               ) d ON d.shop_id = s.shop_id
              WHERE COALESCE(d.c, 0) > 0 OR s.current_month_spend_usd > 0
              ORDER BY COALESCE(d.c, 0) DESC`
          ),
        ]);

        const t = totals.rows[0];
        const totalCalls = parseInt(t.total_calls, 10);
        const failedCalls = parseInt(t.failed_calls, 10);
        const successfulCalls = totalCalls - failedCalls;
        const totalCostUsd = parseFloat(t.total_cost_usd);

        const reconShops = recon.rows.map((r) => {
          const derivedUsd = parseFloat(r.derived_usd);
          const counterUsd = parseFloat(r.counter_usd);
          return {
            shopId: r.shop_id,
            shopName: r.shop_name,
            derivedUsd,
            counterUsd,
            driftUsd: derivedUsd - counterUsd,
          };
        });

        res.json({
          success: true,
          data: {
            periodDays: days,
            cogs: {
              totalCostUsd,
              billableCostUsd: parseFloat(t.billable_cost_usd),
              adsCostUsd: parseFloat(t.ads_cost_usd),
              totalCalls,
              successfulCalls,
              failedCalls,
              errorRate: totalCalls > 0 ? failedCalls / totalCalls : 0,
              avgCostPerCallUsd: successfulCalls > 0 ? totalCostUsd / successfulCalls : 0,
              totalInputTokens: parseInt(t.total_input_tokens, 10),
              totalOutputTokens: parseInt(t.total_output_tokens, 10),
              byFeature: byFeature.rows.map((r) => ({
                feature: r.feature,
                vendor: r.vendor,
                calls: parseInt(r.calls, 10),
                costUsd: parseFloat(r.cost_usd),
                billableToShop: r.billable === true,
              })),
              byModel: byModel.rows.map((r) => ({
                model: r.model,
                calls: parseInt(r.calls, 10),
                costUsd: parseFloat(r.cost_usd),
                inputTokens: parseInt(r.input_tokens, 10),
                outputTokens: parseInt(r.output_tokens, 10),
              })),
              byShop: byShop.rows.map((r) => ({
                shopId: r.shop_id,
                shopName: r.shop_name,
                calls: parseInt(r.calls, 10),
                costUsd: parseFloat(r.cost_usd),
                billableCostUsd: parseFloat(r.billable_cost_usd),
              })),
              trend: trend.rows.map((r) => ({
                day: r.day,
                costUsd: parseFloat(r.cost_usd),
                calls: parseInt(r.calls, 10),
              })),
            },
            reconciliation: {
              scope: "current-month",
              derivedTotalUsd: reconShops.reduce((n, s) => n + s.derivedUsd, 0),
              counterTotalUsd: reconShops.reduce((n, s) => n + s.counterUsd, 0),
              driftUsd: reconShops.reduce((n, s) => n + s.driftUsd, 0),
              shops: reconShops,
            },
          },
        });
      } catch (err) {
        logger.error("SpendController.getAdminCostSummary failed", err);
        res.status(500).json({ success: false, error: "Failed to load cost summary" });
      }
    },

    /** GET /api/ai/admin/overage-summary — admin: per-shop AI Usage Overage this month + grand total,
     *  plus the "ready to invoice" rollup (completed-month pending) and whether charging is live. */
    getAdminOverageSummary: async (_req: Request, res: Response): Promise<void> => {
      try {
        const [{ shops, grandTotal }, pending] = await Promise.all([getOverageSummary(), getPendingOverage()]);
        res.json({
          success: true,
          data: {
            shops,
            grandTotal,
            pending,
            stripeEnabled: process.env.AI_OVERAGE_STRIPE_ENABLED === "true",
          },
        });
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
export function setOwnShopOverageCap(req: Request, res: Response): Promise<void> {
  return getDefaults().setOwnShopOverageCap(req, res);
}
export function getAdminOverageSummary(req: Request, res: Response): Promise<void> {
  return getDefaults().getAdminOverageSummary(req, res);
}
export function invoiceOverage(req: Request, res: Response): Promise<void> {
  return getDefaults().invoiceOverage(req, res);
}
