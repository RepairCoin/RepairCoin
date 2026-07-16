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

const CHEAPER_MODEL_THRESHOLD = 0.7; // ≥ 70% of budget → switch to Haiku

// AI Usage Overage (T3.2) master flag. When off, overage never lifts the cap (behavior unchanged),
// regardless of a shop's ai_overage_enabled toggle.
const overageFeatureEnabled = (): boolean => process.env.ENABLE_AI_OVERAGE === "true";

export class SpendCapEnforcer {
  constructor(private readonly pool: Pool = getSharedPool()) {}

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

    const result = await this.pool.query<{ current_month_spend_usd: string; ai_overage_enabled: boolean }>(
      `SELECT current_month_spend_usd, ai_overage_enabled FROM ai_shop_settings WHERE shop_id = $1`,
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
    // The limit is no longer "reached" in the actionable sense — full model, and no upgrade/overage
    // nag (limitReached=false suppresses the banner across all panels). `overageEnabled` still flows
    // for a future "overage active" indicator.
    if (spent >= budget && overageOn) {
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
      await this.pool.query(
        `UPDATE ai_shop_settings
         SET current_month_spend_usd = current_month_spend_usd + $1::numeric,
             updated_at = NOW()
         WHERE shop_id = $2`,
        [costUsd, shopId]
      );
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
