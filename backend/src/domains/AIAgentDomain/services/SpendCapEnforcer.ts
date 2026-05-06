// backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts
//
// Per-shop monthly spend cap. Reads + updates ai_shop_settings.
//
// Two functions:
//   - canSpend(shopId): pre-flight check before making a Claude call. Returns
//     { allowed, useCheaperModel } — orchestrator picks Haiku when
//     useCheaperModel=true (≥ 70% of budget consumed), aborts when allowed=false
//     (≥ 100% of budget consumed).
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
import { SpendCheckResult } from "../types";

const CHEAPER_MODEL_THRESHOLD = 0.7; // ≥ 70% of budget → switch to Haiku

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

    const result = await this.pool.query<{
      monthly_budget_usd: string;
      current_month_spend_usd: string;
    }>(
      `SELECT monthly_budget_usd, current_month_spend_usd
       FROM ai_shop_settings
       WHERE shop_id = $1`,
      [shopId]
    );

    if (result.rows.length === 0) {
      return {
        allowed: false,
        useCheaperModel: false,
        currentSpendUsd: 0,
        monthlyBudgetUsd: 0,
        percentUsed: 0,
        blockReason: "no_shop_settings",
      };
    }

    const row = result.rows[0];
    const budget = parseFloat(row.monthly_budget_usd);
    const spent = parseFloat(row.current_month_spend_usd);
    const percentUsed = budget > 0 ? spent / budget : 0;

    if (spent >= budget) {
      return {
        allowed: false,
        useCheaperModel: false,
        currentSpendUsd: spent,
        monthlyBudgetUsd: budget,
        percentUsed,
        blockReason: "monthly_budget_exceeded",
      };
    }

    return {
      allowed: true,
      useCheaperModel: percentUsed >= CHEAPER_MODEL_THRESHOLD,
      currentSpendUsd: spent,
      monthlyBudgetUsd: budget,
      percentUsed,
    };
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
