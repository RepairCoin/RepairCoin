// backend/src/services/CampaignScheduler.ts
//
// FixFlow AI Operator — Phase 3 (send-later). Runs every minute and sends any
// marketing campaign whose scheduled time has arrived
// (MarketingService.processScheduledCampaigns → getScheduledCampaigns:
// status='scheduled' AND scheduled_at <= NOW()). The send itself marks the
// campaign 'sent', so a campaign can't be re-sent; the `isRunning` lock also
// prevents overlapping ticks if a batch runs long.
//
// Email + in-app only — no SMS/Twilio. Mirrors LowStockAlertScheduler's shape.

import cron from "node-cron";
import { logger } from "../utils/logger";
import { MarketingService } from "./MarketingService";

export class CampaignScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRun: Date | null = null;
  private readonly marketingService = new MarketingService();

  /** Start the minutely scheduled-campaign sender. */
  start(): void {
    if (this.cronJob) {
      logger.warn("Campaign scheduler is already running");
      return;
    }
    // Every minute — minute-granularity is plenty for "send at 2pm".
    this.cronJob = cron.schedule("* * * * *", async () => {
      await this.tick();
    });
    logger.info(
      "Campaign scheduler started — every minute, sends due scheduled campaigns"
    );
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Campaign scheduler stopped");
    }
  }

  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  /** One pass. Skips if a prior pass is still in flight (lock). */
  async tick(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Campaign scheduler tick already in progress, skipping");
      return;
    }
    this.isRunning = true;
    try {
      await this.marketingService.processScheduledCampaigns();
      this.lastRun = new Date();
    } catch (error) {
      logger.error("Campaign scheduler tick failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isSchedulerRunning(),
      isTickInProgress: this.isRunning,
      lastRun: this.lastRun,
      schedule: "every minute",
    };
  }
}

let instance: CampaignScheduler | null = null;
export function getCampaignScheduler(): CampaignScheduler {
  if (!instance) instance = new CampaignScheduler();
  return instance;
}
