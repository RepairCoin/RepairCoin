// backend/src/domains/AdsDomain/services/SafeguardScheduler.ts
//
// Nightly cron that runs the ads SafeguardEvaluator (auto-pause campaigns burning
// budget with no leads/bookings). Mirrors CampaignRewardExpiryScheduler's shape
// (node-cron + isRunning lock + singleton getter). Runs at 03:00 daily.

import cron from 'node-cron';
import { logger } from '../../../utils/logger';
import { SafeguardEvaluator } from './SafeguardEvaluator';
import { PerformanceRepository } from '../repositories/PerformanceRepository';
import { LeadRepository } from '../repositories/LeadRepository';
import { AdBillingService } from './AdBillingService';
import { SubscriptionService } from './SubscriptionService';

// Q9: unconverted leads are retained 180 days, then hard-deleted nightly.
const LEAD_RETENTION_DAYS = 180;

export class SafeguardScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  constructor(
    private readonly evaluator = new SafeguardEvaluator(),
    private readonly perf = new PerformanceRepository(),
    private readonly leads = new LeadRepository(),
    private readonly billing = new AdBillingService(),
    private readonly subscriptions = new SubscriptionService()
  ) {}

  start(): void {
    if (this.cronJob) {
      logger.warn('Ads safeguard scheduler is already running');
      return;
    }
    this.cronJob = cron.schedule('0 3 * * *', async () => { await this.tick(); });
    logger.info('Ads safeguard scheduler started — daily 03:00');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Ads safeguard scheduler stopped');
    }
  }

  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // Roll up the lead pipeline → ad_performance_daily FIRST, so the safeguard
      // sweep evaluates fresh leads/bookings/revenue totals.
      await this.perf.rollUpFromPipeline(90);
      await this.perf.rollUpCohortRevenue(120); // Stage 5 cohort 30d/90d revenue
      const decisions = await this.evaluator.runNightly();
      const acted = decisions.filter((d) => d.action !== 'none').length;
      if (acted > 0) logger.info(`Ads safeguard scheduler: acted on ${acted} campaign(s)`);

      // Q9 retention: purge unconverted leads past the retention window.
      const purged = await this.leads.purgeExpired(LEAD_RETENTION_DAYS);
      if (purged > 0) logger.info(`Ads lead retention: purged ${purged} expired unconverted lead(s)`);

      // Lifecycle Phase 4: apply scheduled tier downgrades that are now due (§9.7/#3).
      const applied = await this.subscriptions.applyDueScheduledChanges();
      if (applied > 0) logger.info(`Ads lifecycle: applied ${applied} scheduled tier change(s)`);

      // Q4/Q7: accrue ad-management revenue (Plan B/C daily + Plan A monthly).
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      await this.billing.runNightly(monthStart);
    } catch (err) {
      logger.error('Ads safeguard scheduler tick failed:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

let instance: SafeguardScheduler | null = null;
export function getSafeguardScheduler(): SafeguardScheduler {
  if (!instance) instance = new SafeguardScheduler();
  return instance;
}
