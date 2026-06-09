// backend/src/services/CampaignRewardExpiryScheduler.ts
//
// Campaign Rewards — Phase 2. Hourly sweep that flips PENDING on_return rewards
// past their return window into 'expired' (CampaignRewardService.expireOverdue →
// repo UPDATE). Expiry is cosmetic/bookkeeping: claimReturningRewards already
// filters out expired rows at redemption time, so this just keeps the ledger
// honest for reporting. Mirrors CampaignScheduler's shape (isRunning lock).

import cron from "node-cron";
import { logger } from "../utils/logger";
import { campaignRewardService } from "./CampaignRewardService";

export class CampaignRewardExpiryScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /** Start the hourly expiry sweep. */
  start(): void {
    if (this.cronJob) {
      logger.warn("Campaign reward expiry scheduler is already running");
      return;
    }
    // Top of every hour — expiry is not time-critical.
    this.cronJob = cron.schedule("0 * * * *", async () => {
      await this.tick();
    });
    logger.info("Campaign reward expiry scheduler started — hourly");
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Campaign reward expiry scheduler stopped");
    }
  }

  /** One pass. Skips if a prior pass is still in flight. */
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const expired = await campaignRewardService.expireOverdue();
      if (expired > 0) {
        logger.info(`Campaign reward expiry scheduler: expired ${expired} pending reward(s)`);
      }
    } catch (error) {
      logger.error("Campaign reward expiry scheduler tick failed:", error);
    } finally {
      this.isRunning = false;
    }
  }
}

let instance: CampaignRewardExpiryScheduler | null = null;
export function getCampaignRewardExpiryScheduler(): CampaignRewardExpiryScheduler {
  if (!instance) instance = new CampaignRewardExpiryScheduler();
  return instance;
}
