// backend/src/domains/AIAgentDomain/services/AiOverageBillingScheduler.ts
//
// T3.2 prod-readiness (#5): monthly cron that invoices every shop's completed-month AI Usage Overage.
// Mirrors SafeguardScheduler's shape (node-cron + isRunning lock + singleton getter). Runs at 06:00 on
// the 1st of each month, AFTER the prior month has fully closed. Fully gated by AI_OVERAGE_STRIPE_ENABLED
// (invoiceAllDue already no-ops when off), so this is inert until charging is turned on. The per-shop
// claim in AiOverageStripeService keeps this safe even if a manual admin run overlaps.

import cron from 'node-cron';
import { logger } from '../../../utils/logger';
import { aiOverageStripeService } from './AiOverageStripeService';

export class AiOverageBillingScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(private readonly billing = aiOverageStripeService) {}

  start(): void {
    if (this.cronJob) {
      logger.warn('AI overage billing scheduler is already running');
      return;
    }
    // 06:00 on the 1st of every month.
    this.cronJob = cron.schedule('0 6 1 * *', async () => { await this.tick(); });
    logger.info('AI overage billing scheduler started — monthly 06:00 on the 1st');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('AI overage billing scheduler stopped');
    }
  }

  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      if (process.env.AI_OVERAGE_STRIPE_ENABLED !== 'true') {
        logger.info('AI overage billing scheduler tick skipped — AI_OVERAGE_STRIPE_ENABLED off');
        return;
      }
      const results = await this.billing.invoiceAllDue();
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      logger.info(`AI overage billing run: invoiced ${ok} shop(s)` + (failed.length ? `, ${failed.length} failed` : ''));
      // #10 monitoring: surface failures as structured errors so log-based alerting catches them.
      for (const f of failed) {
        logger.error('AI overage billing: shop invoice failed', { alert: 'ai_overage_billing_failed', shopId: f.shopId, error: f.error });
      }
    } catch (err) {
      logger.error('AI overage billing scheduler tick failed:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

let instance: AiOverageBillingScheduler | null = null;
export function getAiOverageBillingScheduler(): AiOverageBillingScheduler {
  if (!instance) instance = new AiOverageBillingScheduler();
  return instance;
}
