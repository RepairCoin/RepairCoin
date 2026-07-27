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
import { getNotificationGateway } from "../../notification/services/NotificationGateway";

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

/** #7: notify a shop the first time it crosses into overage this month — injectable for tests. Default
 *  dispatches to the shopId as the receiver (persist + ws + push). We address the SHOP ID, not the shop
 *  wallet: a shop's login can be a social wallet that differs from shops.wallet_address, and the
 *  notification bell resolves a shop's inbox as [req.user.address, req.user.shopId] — so shopId-addressed
 *  notifications reliably reach the dashboard while wallet-addressed ones can silently miss. */
export type OverageNotifyFn = (shopId: string, budgetUsd: number) => Promise<void>;
const defaultNotifyOverageStarted: OverageNotifyFn = async (shopId, budgetUsd) => {
  try {
    await getNotificationGateway().dispatch("ai_overage_started", shopId, {
      message:
        `You've passed your $${budgetUsd} monthly AI allowance — full-power AI keeps running, billed at ` +
        `3× usage. You can set a monthly cap anytime in Plans & Billing.`,
      metadata: { shopId, budgetUsd },
    });
  } catch (err) {
    logger.error("SpendCapEnforcer: overage-started notify failed", { shopId, error: (err as Error)?.message });
  }
};

/** Audit row for an AI surface with no per-feature cost table — see recordSpend's `ledger` param. */
export interface MiscUsageLedgerEntry {
  feature: "brand_kit" | "faq_suggestion" | "voice_tts";
  vendor: "anthropic" | "openai";
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
}

export class SpendCapEnforcer {
  constructor(
    private readonly pool: Pool = getSharedPool(),
    private readonly accrueOverage: OverageAccrueFn = defaultAccrueOverage,
    private readonly notifyOverageStartedFn: OverageNotifyFn = defaultNotifyOverageStarted
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

    // Spend is DERIVED from ai_usage_events (migration 240), not read from the incrementing
    // current_month_spend_usd counter. The counter drifts low — a missed increment or a mid-month
    // reset of current_month_started_at silently hands the shop extra headroom (measured 2026-07-24:
    // $1.78 of under-enforcement across 5 shops, $1.46 of it on one shop after a Jul-14 reset).
    // Deriving makes that class of drift impossible: the number can't disagree with the audit
    // because it IS the audit, and there is no month-start field left to corrupt.
    //
    // billable_to_shop filters out ads-attributed spend, which bills to the ads budget rather than
    // the shop's AI allowance (D3). DATE_TRUNC on the calendar month IS the rollover — no reset needed.
    //
    // `NOT is_error` preserves the long-standing product rule that a shop is not charged for OUR
    // failures (the orchestrator has always passed 0 to recordSpend on a failed call). Deriving from
    // the audit would otherwise silently reverse that, because failed calls still carry the tokens
    // they burned. The admin COGS panel deliberately does NOT filter these out — we still paid the
    // vendor for them; they just don't come out of the shop's allowance.
    // Driven by the view, LEFT JOINed to the settings row — deliberately NOT the other way round.
    // The settings row only carries the overage preferences now; spend no longer lives there. A shop
    // whose settings row is missing (mid-onboarding, or wiped by a cleanup) can still have real spend
    // in the audit, and keying off the row would hand it an unlimited free pass — the same
    // under-enforcement hole in a new place.
    const result = await this.pool.query<{
      derived_spend_usd: string;
      ai_overage_enabled: boolean | null;
      overage_cap_usd: string | null;
      has_settings: boolean;
    }>(
      `SELECT COALESCE((
                SELECT SUM(cost_usd) FROM ai_usage_events e
                 WHERE e.shop_id = $1
                   AND e.billable_to_shop
                   AND NOT e.is_error
                   AND DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())
              ), 0)::text          AS derived_spend_usd,
              s.ai_overage_enabled AS ai_overage_enabled,
              s.overage_cap_usd    AS overage_cap_usd,
              (s.shop_id IS NOT NULL) AS has_settings
         FROM (SELECT $1::varchar AS shop_id) q
         LEFT JOIN ai_shop_settings s ON s.shop_id = q.shop_id`,
      [shopId]
    );

    const row = result.rows[0];

    if (!row.has_settings) {
      // Brand-new shop (e.g. mid-onboarding). Lazily provision a tracking row so the per-shop
      // dashboard counter and the overage preferences have somewhere to live. Enforcement itself
      // does NOT depend on this succeeding — spend below is already derived from the audit.
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
    }

    const spent = parseFloat(row.derived_spend_usd);
    const overageOn = overageFeatureEnabled() && row.ai_overage_enabled === true;
    const percentUsed = budget > 0 ? spent / budget : 0;

    // AI Usage Overage (T3.2): the shop opted to keep full-power AI past the cap (billed Usage x3).
    if (spent >= budget && overageOn) {
      // Bill-shock guardrail (Slice 2.5): everything beyond the allowance is overage, so the billable
      // this month = (spent - budget) x multiplier — computed here with no extra query. Once it reaches
      // the cap, STOP lifting the model (revert to Haiku) to prevent a runaway invoice. The cap is the
      // shop's own overage_cap_usd if set, else the platform default (T3.2 per-shop cap).
      const perShopCap = row.overage_cap_usd != null ? Number(row.overage_cap_usd) : null;
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
   *
   * The counter is now a CACHE, not the enforcement source — canSpend derives from
   * ai_usage_events. We keep incrementing it because per-shop dashboards read it and
   * it stays useful as a drift signal against the audit.
   *
   * `ledger`: pass this from surfaces that have NO per-feature cost table of their own
   * (brand-kit vision, FAQ suggestions, voice TTS). It writes the ai_misc_usage row that
   * makes the spend visible to ai_usage_events. Without it those calls charge the counter
   * but are invisible to the audit — which is exactly the hole that made the derived
   * counter under-report before migration 240. Surfaces that already log to their own
   * table (agent/orchestrate/insights/marketing/help/voice/image) must NOT pass it, or the
   * cost would be double-counted.
   */
  async recordSpend(shopId: string, costUsd: number, ledger?: MiscUsageLedgerEntry): Promise<void> {
    if (costUsd <= 0) return; // nothing to record
    if (ledger) await this.recordMiscUsage(shopId, costUsd, ledger);
    try {
      // The month rollover is folded INTO the increment rather than done as a separate statement.
      // canSpend rolls the month too, and in practice every recordSpend follows a canSpend — but
      // nothing enforces that pairing, and a caller that only ever calls recordSpend would accrue
      // into a stale month and have the whole lot zeroed by the next canSpend. Doing it here as one
      // CASE closes that hole for zero extra round-trips.
      const upd = await this.pool.query<{ current_month_spend_usd: string; ai_overage_enabled: boolean }>(
        `UPDATE ai_shop_settings
         SET current_month_spend_usd =
               CASE WHEN DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())
                    THEN $1::numeric
                    ELSE current_month_spend_usd + $1::numeric END,
             current_month_started_at =
               CASE WHEN DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())
                    THEN DATE_TRUNC('month', NOW())
                    ELSE current_month_started_at END,
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
          // #7: tell the shop the FIRST time it crosses into overage this month (the single call whose
          // spend straddled the allowance). Best-effort — never affects the spend increment.
          if (before < budget && after >= budget) {
            await this.notifyOverageStartedFn(shopId, budget).catch(() => undefined);
          }
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
   * Write the ai_usage_events audit row for a surface that has no cost table of its own.
   * Best-effort in the sense that it never throws — but note this is the ONLY record of that
   * spend, so a failure here means the call escapes the cap entirely. Logged loudly for that
   * reason, unlike the counter increment which is merely a cache.
   */
  private async recordMiscUsage(shopId: string, costUsd: number, entry: MiscUsageLedgerEntry): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ai_misc_usage
           (shop_id, feature, vendor, model, input_tokens, output_tokens, cost_usd, latency_ms, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          shopId,
          entry.feature,
          entry.vendor,
          entry.model ?? null,
          entry.inputTokens ?? 0,
          entry.outputTokens ?? 0,
          costUsd,
          entry.latencyMs ?? null,
          JSON.stringify(entry.metadata ?? {}),
        ]
      );
    } catch (err) {
      logger.error("SpendCapEnforcer.recordMiscUsage failed — this spend is now invisible to the cap", {
        shopId,
        feature: entry.feature,
        costUsd,
        error: (err as Error)?.message,
      });
    }
  }

  /**
   * If current_month_started_at is in a previous calendar month, reset
   * current_month_spend_usd to 0 and advance the timestamp. Idempotent.
   *
   * The stamp is DATE_TRUNC('month', NOW()) — the first instant of the month — not NOW(). It used
   * to be NOW(), which made the column record "when we first noticed the month had turned over"
   * rather than when the month began. Two consequences, both bad: a shop first touched on the 22nd
   * got a stamp of the 22nd, and a background sweep that touches many shops at once stamped them
   * all with the same mid-month second (staging shows clusters of 5, 7, 12 and 33 shops sharing a
   * single minute). That made a genuinely anomalous mid-month value indistinguishable from routine
   * noise — it read as data corruption while being nothing of the sort. With the truncated stamp,
   * any mid-month value is now a real signal worth investigating.
   *
   * Concurrency: two parallel orchestrator calls that both detect a stale
   * month will each issue the UPDATE. The UPDATE is set-not-increment so
   * the result is the same regardless of order — both end with spend=0
   * and the same truncated timestamp.
   */
  private async maybeRolloverMonth(shopId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE ai_shop_settings
         SET current_month_spend_usd = 0,
             current_month_started_at = DATE_TRUNC('month', NOW()),
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
