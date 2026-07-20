// backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts
//
// Per-shop monthly spend cap. Reads + updates ai_shop_settings.
//
// The monthly budget is a PURE FUNCTION of the shop's subscription tier ($10 Starter / $30 Growth /
// $75 Business — AI_TIER_ALLOWANCE), computed at read from getShopTier. It is never hand-set by an
// admin and there is no stored value to drift; an upgrade/downgrade takes effect on the next call.
//
// Two functions:
//   - canSpend(shopId): pre-flight check before making a Claude call. Returns
//     { allowed, useCheaperModel, limitReached } — caller picks Haiku when useCheaperModel=true
//     (≥ 70% of budget). SOFT LANDING (D2): at ≥ 100% the call is STILL allowed but limitReached=true
//     and useCheaperModel=true → run Haiku-only + surface an upgrade message; never a hard block.
//   - recordSpend(shopId, costUsd): post-call increment of current_month_spend_usd.
//     Auto-rolls the month boundary if current_month_started_at is in a previous
//     calendar month (resets spend to 0 + advances timestamp).
//
// The auto-rollover lives here, not in a cron. We trust the next request after
// a month boundary to trigger the reset. Trade-off: if a shop has zero traffic
// in a new month, current_month_spend_usd shows the previous month's value
// until traffic resumes — acceptable for the per-shop dashboard read.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { getShopTier } from "../../../utils/shopTier";
import { AI_TIER_ALLOWANCE, SubscriptionTier } from "../../../config/subscriptionPlans";
import { SpendCheckResult } from "../types";
import { AiOverageChargeRepository } from "../../../repositories/AiOverageChargeRepository";

const CHEAPER_MODEL_THRESHOLD = 0.7; // ≥ 70% of budget → switch to Haiku

// AI Usage Overage (T3.2) master flag. When off, overage never lifts the cap (behavior unchanged),
// regardless of a shop's ai_overage_enabled toggle.
const overageFeatureEnabled = (): boolean => process.env.ENABLE_AI_OVERAGE === "true";

// "Usage x3" — the billable multiplier on overage cost. Kept in sync with AiOverageChargeRepository's default.
const OVERAGE_MULTIPLIER = 3;

// Bill-shock guardrail (Slice 2.5): a monthly cap on the BILLABLE overage (dollars the shop would be
// invoiced). Once reached, overage stops lifting the model — reverts to the Haiku soft-landing so a
// runaway session can't produce a surprise invoice. 0 = unlimited (no guardrail).
//
// PLATFORM DEFAULT (env AI_OVERAGE_MONTHLY_CAP_USD, default $100) — the fallback when a shop hasn't set
// its own. A shop can override it per-shop via ai_shop_settings.overage_cap_usd (T3.2 per-shop cap).
const overagePlatformCapUsd = (): number => {
  const n = Number(process.env.AI_OVERAGE_MONTHLY_CAP_USD ?? "100");
  return Number.isFinite(n) && n >= 0 ? n : 100;
};

/** The cap that actually applies to a shop: its own overage_cap_usd if set (NULL = inherit), else the
 *  platform default. A negative stored value is ignored (treated as unset). Exported for reuse/tests. */
export const effectiveOverageCapUsd = (perShopCapUsd: number | null | undefined): number => {
  if (perShopCapUsd != null && Number.isFinite(perShopCapUsd) && perShopCapUsd >= 0) return perShopCapUsd;
  return overagePlatformCapUsd();
};

/** Accrue the marginal overage (USD beyond the allowance) — injectable for tests. Default = the
 *  ai_overage_charges ledger repo, lazily built (avoids a DB touch at import). */
export type OverageAccrueFn = (shopId: string, overageCostUsd: number) => Promise<void>;
let _overageRepo: AiOverageChargeRepository | null = null;
const defaultAccrueOverage: OverageAccrueFn = (shopId, usd) => {
  if (!_overageRepo) _overageRepo = new AiOverageChargeRepository();
  return _overageRepo.accrue(shopId, usd);
};

export class SpendCapEnforcer {
  constructor(
    private readonly pool: Pool = getSharedPool(),
    private readonly accrueOverage: OverageAccrueFn = defaultAccrueOverage
  ) {}

  /**
   * Pre-flight check: can this shop afford one more AI call?
   *
   * Reads ai_shop_settings for the shop, auto-rolls the month if needed
   * (this is the natural rollover trigger — see file header), and returns
   * a structured decision.
   */
  async canSpend(shopId: string): Promise<SpendCheckResult> {
    await this.maybeRolloverMonth(shopId);

    // Budget = the shop's CURRENT tier allowance ($10/$30/$75). Computed at read; not stored/editable.
    const budget = AI_TIER_ALLOWANCE[await this.resolveTier(shopId)];

    const result = await this.pool.query<{ current_month_spend_usd: string; ai_overage_enabled: boolean; overage_cap_usd: string | null }>(
      `SELECT current_month_spend_usd, ai_overage_enabled, overage_cap_usd FROM ai_shop_settings WHERE shop_id = $1`,
      [shopId]
    );

    if (result.rows.length === 0) {
      // No settings row yet — a brand-new shop (e.g. mid-onboarding). Lazily provision a tracking row
      // so recordSpend works, and allow the call against the tier budget (don't hard-block first-run AI).
      try {
        await this.pool.query(
          `INSERT INTO ai_shop_settings (shop_id, current_month_started_at)
           VALUES ($1, NOW())
           ON CONFLICT (shop_id) DO NOTHING`,
          [shopId]
        );
      } catch (err) {
        logger.error("SpendCapEnforcer.canSpend: default settings provision failed", err);
      }
      return { allowed: true, useCheaperModel: false, currentSpendUsd: 0, monthlyBudgetUsd: budget, percentUsed: 0 };
    }

    const spent = parseFloat(result.rows[0].current_month_spend_usd);
    const overageOn = overageFeatureEnabled() && result.rows[0].ai_overage_enabled === true;
    const percentUsed = budget > 0 ? spent / budget : 0;

    // AI Usage Overage (T3.2): the shop opted to keep full-power AI past the cap (billed Usage x3).
    if (spent >= budget && overageOn) {
      // Bill-shock guardrail (Slice 2.5): everything beyond the allowance is overage, so the billable
      // this month = (spent - budget) x multiplier — computed here with no extra query. Once it reaches
      // the cap, STOP lifting the model (revert to Haiku) to prevent a runaway invoice. The cap is the
      // shop's own overage_cap_usd if set, else the platform default (T3.2 per-shop cap).
      const perShopCap = result.rows[0].overage_cap_usd != null ? Number(result.rows[0].overage_cap_usd) : null;
      const cap = effectiveOverageCapUsd(perShopCap);
      const billableOverageUsd = (spent - budget) * OVERAGE_MULTIPLIER;
      if (cap > 0 && billableOverageUsd >= cap) {
        return { allowed: true, useCheaperModel: true, limitReached: true, overageEnabled: true, overageCapReached: true, currentSpendUsd: spent, monthlyBudgetUsd: budget, percentUsed };
      }
      // Under the guardrail — keep the FULL model. The limit is no longer "reached" in the actionable
      // sense, so limitReached=false suppresses the upgrade/overage nag across all panels.
      return { allowed: true, useCheaperModel: false, limitReached: false, overageEnabled: true, currentSpendUsd: spent, monthlyBudgetUsd: budget, percentUsed };
    }

    // Soft landing (D2): at/over 100% the call is STILL allowed — never a dead-end — but MUST run
    // Haiku-only, and the caller surfaces "upgrade your plan for more AI". Expensive/vision ops that
    // can't cheaply degrade treat limitReached as a block instead.
    if (spent >= budget) {
      return { allowed: true, useCheaperModel: true, limitReached: true, overageEnabled: false, currentSpendUsd: spent, monthlyBudgetUsd: budget, percentUsed };
    }

    return {
      allowed: true,
      useCheaperModel: percentUsed >= CHEAPER_MODEL_THRESHOLD,
      currentSpendUsd: spent,
      monthlyBudgetUsd: budget,
      percentUsed,
    };
  }

  /** The shop's current subscription tier ($10/$30/$75), fail-closed to the lowest allowance. */
  private async resolveTier(shopId: string): Promise<SubscriptionTier> {
    try {
      return await getShopTier(shopId);
    } catch {
      return "starter";
    }
  }

  /**
   * Increment the shop's current_month_spend_usd by `costUsd`. Called by the
   * orchestrator after a successful Claude call. If the call failed, the
   * orchestrator passes 0 (no charge to the shop for failed requests).
   */
  async recordSpend(shopId: string, costUsd: number): Promise<void> {
    if (costUsd <= 0) return; // nothing to record
    try {
      const upd = await this.pool.query<{ current_month_spend_usd: string; ai_overage_enabled: boolean }>(
        `UPDATE ai_shop_settings
         SET current_month_spend_usd = current_month_spend_usd + $1::numeric,
             updated_at = NOW()
         WHERE shop_id = $2
         RETURNING current_month_spend_usd, ai_overage_enabled`,
        [costUsd, shopId]
      );

      // AI Usage Overage (T3.2 Slice 2) — when overage is on, ledger the portion of THIS spend that
      // fell BEYOND the monthly allowance (billed Usage x3). Best-effort: accrual never affects the
      // spend increment above (the AI reply already happened).
      const row = upd.rows?.[0];
      if (overageFeatureEnabled() && row?.ai_overage_enabled === true) {
        const after = parseFloat(row.current_month_spend_usd);
        const before = after - costUsd;
        const budget = AI_TIER_ALLOWANCE[await this.resolveTier(shopId)];
        // Only the slice of this increment above the allowance counts. If the call started already
        // over the cap, the whole cost is overage; if it straddled the cap, only the part past it.
        const overagePortion = Math.max(0, after - Math.max(before, budget));
        if (overagePortion > 0) {
          await this.accrueOverage(shopId, overagePortion).catch((e) => {
            logger.error("SpendCapEnforcer: overage accrual failed", {
              shopId,
              error: (e as Error)?.message,
            });
          });
        }
      }
    } catch (err) {
      logger.error("SpendCapEnforcer.recordSpend failed", err);
      // Swallow — the AI reply already happened, missing one spend
      // increment is a soft failure (will under-report cost but not break
      // anything). Audit log catches the cost separately.
    }
  }

  /**
   * If current_month_started_at is in a previous calendar month, reset
   * current_month_spend_usd to 0 and advance the timestamp. Idempotent.
   *
   * Concurrency: two parallel orchestrator calls that both detect a stale
   * month will each issue the UPDATE. The UPDATE is set-not-increment so
   * the result is the same regardless of order — both end with spend=0
   * and timestamp=NOW.
   */
  private async maybeRolloverMonth(shopId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE ai_shop_settings
         SET current_month_spend_usd = 0,
             current_month_started_at = NOW(),
             updated_at = NOW()
         WHERE shop_id = $1
           AND DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())`,
        [shopId]
      );
    } catch (err) {
      logger.error("SpendCapEnforcer.maybeRolloverMonth failed", err);
      // Don't block — at worst the next call will see stale spend
    }
  }
}

export const spendCapEnforcer = new SpendCapEnforcer();
