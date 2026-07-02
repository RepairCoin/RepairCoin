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
import { MetaConnectionService } from './MetaConnectionService';
import { MetaInsightsService } from './MetaInsightsService';
import { GoogleInsightsService } from './GoogleInsightsService';
import { MetaConfigSyncService } from './MetaConfigSyncService';
import { GoogleConfigSyncService } from './GoogleConfigSyncService';
import { metaPushService } from './MetaPushService';

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
    private readonly subscriptions = new SubscriptionService(),
    private readonly metaConnections = new MetaConnectionService(),
    private readonly metaInsights = new MetaInsightsService(),
    private readonly googleInsights = new GoogleInsightsService(),
    private readonly metaConfigSync = new MetaConfigSyncService(),
    private readonly googleConfigSync = new GoogleConfigSyncService()
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
      // Push Phase 3: import Meta spend/impressions/clicks BEFORE the sweep so it acts on
      // fresh spend (no-op unless ADS_META_PUSH_ENABLED + a configured Meta App).
      const insightsSynced = await this.metaInsights.syncAll();
      if (insightsSynced > 0) logger.info(`Ads Meta insights: synced ${insightsSynced} campaign(s)`);
      // Slice 4: import Google spend/impressions/clicks (no-op unless ADS_GOOGLE_PUSH_ENABLED + a
      // configured Google app). Same partial-upsert contract as Meta insights.
      const googleSynced = await this.googleInsights.syncAll();
      if (googleSynced > 0) logger.info(`Ads Google insights: synced ${googleSynced} campaign(s)`);
      // Two-way config sync: pull budget/status back FROM Meta so the dashboard reflects manual
      // Ads-Manager edits (no-op unless ADS_META_CONFIG_SYNC + a configured Meta App).
      const configReconciled = await this.metaConfigSync.reconcileAll();
      if (configReconciled > 0) logger.info(`Ads Meta config sync: reconciled ${configReconciled} campaign(s)`);
      // Slice 5: pull budget/status back FROM Google (no-op unless ADS_GOOGLE_CONFIG_SYNC + a
      // configured Google app), so the dashboard reflects manual Google-Ads edits.
      const googleReconciled = await this.googleConfigSync.reconcileAll();
      if (googleReconciled > 0) logger.info(`Ads Google config sync: reconciled ${googleReconciled} campaign(s)`);
      const decisions = await this.evaluator.runNightly();
      const acted = decisions.filter((d) => d.action !== 'none').length;
      if (acted > 0) logger.info(`Ads safeguard scheduler: acted on ${acted} campaign(s)`);
      // Push P4 — mirror safeguard hard-pauses to Meta so spend actually stops (best-effort).
      for (const d of decisions) {
        if (d.action === 'hard_pause') {
          await metaPushService.pushStatus(d.campaignId, 'PAUSED')
            .catch((e: any) => logger.warn(`Safeguard Meta pause failed for ${d.campaignId}: ${e?.message || e}`));
        }
      }

      // Q9 retention: purge unconverted leads past the retention window.
      const purged = await this.leads.purgeExpired(LEAD_RETENTION_DAYS);
      if (purged > 0) logger.info(`Ads lead retention: purged ${purged} expired unconverted lead(s)`);

      // Lifecycle Phase 4: apply scheduled tier downgrades that are now due (§9.7/#3).
      const applied = await this.subscriptions.applyDueScheduledChanges();
      if (applied > 0) logger.info(`Ads lifecycle: applied ${applied} scheduled tier change(s)`);

      // Connect-Meta Phase 3: re-extend long-lived user tokens nearing expiry.
      const refreshed = await this.metaConnections.refreshExpiring();
      if (refreshed > 0) logger.info(`Ads Meta connect: refreshed ${refreshed} token(s)`);

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
