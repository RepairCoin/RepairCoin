// backend/src/domains/AdsDomain/services/SafeguardEvaluator.ts
//
// Stage 1 — nightly auto-pause. Plan B contract terms (risks-doc §7):
//   spend >= $400 with 0 leads     → SOFT ALERT (notify; campaign keeps running)
//   spend >= $800 with 0 bookings  → HARD PAUSE (status='paused' + notify + event)
// Thresholds are per-campaign (ad_safeguards_state; defaults 40000/80000 cents).
// `decide` is pure (unit-tested); runNightly does the IO + actions.

import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { PerformanceRepository, CampaignTotals } from '../repositories/PerformanceRepository';
import { SafeguardRepository } from '../repositories/SafeguardRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { shopRepository } from '../../../repositories';

export type SafeguardAction = 'none' | 'soft_alert' | 'hard_pause';

export interface SafeguardThresholds {
  softCents: number; // no-leads soft-alert threshold
  hardCents: number; // no-bookings hard-pause threshold
}

export interface SafeguardDecision {
  campaignId: string;
  action: SafeguardAction;
  reason?: string;
}

export class SafeguardEvaluator {
  constructor(
    private readonly campaigns = new CampaignRepository(),
    private readonly perf = new PerformanceRepository(),
    private readonly safeguards = new SafeguardRepository(),
    private readonly notifications = new NotificationRepository()
  ) {}

  /** PURE decision — easy to unit-test without a DB. */
  static decide(totals: CampaignTotals, t: SafeguardThresholds): SafeguardAction {
    const { totalSpendCents: spend, totalLeads: leads, totalBookings: bookings } = totals;
    if (spend >= t.hardCents && bookings === 0) return 'hard_pause';
    if (spend >= t.softCents && leads === 0) return 'soft_alert';
    return 'none';
  }

  /** PURE — Safeguard 5: should we nudge a FREE creative swap? Fires earlier/softer than auto-pause:
   *  once meaningful spend is in, flag if there are no leads, or the cost-per-lead is too high. */
  static shouldRefreshCreative(
    totals: CampaignTotals,
    t: { spendCents: number; cplCents: number }
  ): { refresh: boolean; reason?: string } {
    const { totalSpendCents: spend, totalLeads: leads } = totals;
    if (spend < t.spendCents) return { refresh: false };
    const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;
    if (leads === 0) return { refresh: true, reason: `Spent ${dollars(spend)} with 0 leads — try a new creative` };
    const cpl = spend / leads;
    if (cpl > t.cplCents) return { refresh: true, reason: `Cost per lead ${dollars(cpl)} is high — try a new creative` };
    return { refresh: false };
  }

  /** PURE — Safeguard 4: has a test-budget campaign earned its scale-up? True when it has spent
   *  AND revenue ≥ minRoas × spend (default 1× = at least broke even). The window/elapsed check
   *  is done by the caller (needs the clock). */
  static testBudgetReady(totals: CampaignTotals, minRoas: number): boolean {
    const { totalSpendCents: spend, totalRevenueCents: revenue } = totals;
    if (spend <= 0) return false;
    return revenue / spend >= minRoas;
  }

  /** Evaluate every active campaign; act on breaches. Returns the decisions made. */
  async runNightly(): Promise<SafeguardDecision[]> {
    const active = await this.campaigns.listActive();
    const decisions: SafeguardDecision[] = [];
    for (const c of active) {
      try {
        const [totals, state] = await Promise.all([
          this.perf.getTotals(c.id),
          this.safeguards.ensureDefault(c.id),
        ]);
        // Safeguard 5 — flag a free creative swap when underperforming (env-tunable thresholds:
        // default $200 spend, $50 CPL ceiling). Independent of auto-pause; set the nudge flag.
        const refresh = SafeguardEvaluator.shouldRefreshCreative(totals, {
          spendCents: parseInt(process.env.ADS_CREATIVE_REFRESH_SPEND_CENTS || '20000', 10),
          cplCents: parseInt(process.env.ADS_CREATIVE_REFRESH_CPL_CENTS || '5000', 10),
        });
        if (refresh.refresh) {
          await this.campaigns.setCreativeRefresh(c.id, true, refresh.reason ?? null);
        }

        // Safeguard 4 — test-budget campaign that has run its window with ≥ break-even ROI → flag
        // "ready to scale" (admin confirms; we never auto-raise spend).
        const full = await this.campaigns.findById(c.id);
        if (full?.isTestBudget && !full.testBudgetUpgradeReady && full.testBudgetStartedAt) {
          const windowDays = parseInt(process.env.ADS_TEST_BUDGET_WINDOW_DAYS || '30', 10);
          const elapsedMs = Date.now() - new Date(full.testBudgetStartedAt).getTime();
          if (elapsedMs >= windowDays * 86400000) {
            const minRoas = parseFloat(process.env.ADS_TEST_BUDGET_MIN_ROAS || '1');
            if (SafeguardEvaluator.testBudgetReady(totals, minRoas)) {
              await this.campaigns.update(c.id, { testBudgetUpgradeReady: true });
              logger.info(`SafeguardEvaluator: test-budget campaign ${c.id} ready to scale (ROAS ≥ ${minRoas})`);
            }
          }
        }

        const action = SafeguardEvaluator.decide(totals, {
          softCents: state.autoPauseThresholdCents,
          hardCents: state.autoPauseNoBookingsCents,
        });
        if (action === 'none') continue;

        const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`;
        const reason =
          action === 'hard_pause'
            ? `Spent ${dollars(totals.totalSpendCents)} with 0 bookings`
            : `Spent ${dollars(totals.totalSpendCents)} with 0 leads`;

        if (action === 'hard_pause') {
          await this.campaigns.update(c.id, { status: 'paused' });
          await this.safeguards.recordPause(c.id, reason);
          await eventBus.publish(
            createDomainEvent(
              AdsEvents.CAMPAIGN_PAUSED_BY_SAFEGUARD,
              c.id,
              { shopId: c.shopId, reason },
              'AdsDomain'
            )
          );
        }
        await this.notifyShop(c.shopId, action, reason);
        decisions.push({ campaignId: c.id, action, reason });
        logger.info(`SafeguardEvaluator: ${action} campaign ${c.id} — ${reason}`);
      } catch (err) {
        logger.error(`SafeguardEvaluator: failed for campaign ${c.id}`, err);
      }
    }
    return decisions;
  }

  private async notifyShop(shopId: string, action: SafeguardAction, reason: string): Promise<void> {
    try {
      const shop = await shopRepository.getShop(shopId);
      const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
      if (!receiver) return;
      await this.notifications.create({
        senderAddress: 'system',
        receiverAddress: receiver,
        notificationType: action === 'hard_pause' ? 'ad_campaign_paused' : 'ad_campaign_alert',
        message:
          action === 'hard_pause'
            ? `An ad campaign was auto-paused: ${reason}.`
            : `Ad campaign alert: ${reason}. It's still running — review it soon.`,
        metadata: { shopId, reason, safeguard: action },
      });
    } catch (err) {
      logger.error('SafeguardEvaluator: notifyShop failed', err);
    }
  }
}
