// backend/src/services/CampaignRewardService.ts
//
// Campaign Rewards — Phase 1. Fulfills a campaign's reward when it sends.
// Phase 1 scope: flat RCN, on_send only. (Variable amounts, redeem-on-return,
// and coupons are Phases 2-4 — see docs/tasks/strategy/campaign-rewards/.)
//
// Flow (on_send RCN):
//   1. gate on the per-shop campaign_rewards_enabled flag
//   2. eligibility split (has wallet, not the shop's own; issueExact re-checks
//      registration/active per recipient)
//   3. balance gate — block the whole send if the shop can't cover the full
//      eligible set (all-or-nothing, predictable)
//   4. issue per recipient via RewardIssuanceService (each mint+debit is atomic,
//      so a failure leaves the balance untouched — no refund bookkeeping needed)
//   5. record per-recipient outcome on the reward ledger; return counts

import { Pool } from 'pg';
import { getSharedPool } from '../utils/database-pool';
import { shopRepository } from '../repositories';
import {
  MarketingCampaignRepository,
  MarketingCampaign,
} from '../repositories/MarketingCampaignRepository';
import { rewardIssuanceService } from './RewardIssuanceService';
import { logger } from '../utils/logger';

export interface RewardRecipient {
  walletAddress: string;
  email?: string;
  name?: string;
}

export interface RewardFulfillmentResult {
  issued: number;
  skipped: number;
  failed: number;
  totalIssuedRcn: number;
}

/** Thrown when the shop balance can't cover the campaign's full reward — the
 *  caller should abort the send WITHOUT having emailed anyone. */
export class CampaignRewardBlockedError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'CampaignRewardBlockedError';
  }
}

export class CampaignRewardService {
  private pool: Pool;
  private campaignRepo: MarketingCampaignRepository;

  constructor(pool?: Pool) {
    this.pool = pool ?? getSharedPool();
    this.campaignRepo = new MarketingCampaignRepository();
  }

  /** True only for a campaign whose reward we fulfill in Phase 1: flat on_send RCN. */
  hasOnSendRcnReward(campaign: MarketingCampaign): boolean {
    return (
      campaign.rewardType === 'rcn' &&
      (campaign.fulfillmentTrigger ?? 'on_send') === 'on_send' &&
      !!campaign.rewardRcnAmount &&
      campaign.rewardRcnAmount > 0
    );
  }

  private async isEnabled(shopId: string): Promise<boolean> {
    try {
      const r = await this.pool.query<{ campaign_rewards_enabled: boolean }>(
        `SELECT campaign_rewards_enabled FROM ai_shop_settings WHERE shop_id = $1`,
        [shopId]
      );
      return r.rows[0]?.campaign_rewards_enabled === true;
    } catch {
      return false;
    }
  }

  /**
   * Issue a flat RCN reward to every eligible recipient at send time.
   * Throws CampaignRewardBlockedError when the shop balance can't cover the full
   * eligible set (so the caller blocks the send before emailing anyone).
   */
  async fulfillOnSend(
    campaign: MarketingCampaign,
    recipients: RewardRecipient[]
  ): Promise<RewardFulfillmentResult> {
    const shopId = campaign.shopId;
    const amount = campaign.rewardRcnAmount as number;
    const result: RewardFulfillmentResult = { issued: 0, skipped: 0, failed: 0, totalIssuedRcn: 0 };

    if (!(await this.isEnabled(shopId))) {
      logger.warn('CampaignRewardService: reward configured but campaign_rewards_enabled is OFF — skipping fulfillment', {
        shopId, campaignId: campaign.id,
      });
      return result;
    }

    const shop = await shopRepository.getShop(shopId);
    const shopWallet = shop?.walletAddress?.toLowerCase();
    const eligible = recipients.filter(
      (r) => r.walletAddress && r.walletAddress.toLowerCase() !== shopWallet
    );

    // Balance gate — all-or-nothing.
    const totalNeeded = eligible.length * amount;
    const balance = shop?.purchasedRcnBalance ?? 0;
    if (totalNeeded > 0 && balance < totalNeeded) {
      throw new CampaignRewardBlockedError(
        `This campaign's reward needs ${totalNeeded} RCN, but the shop's balance is ${balance} RCN.`,
        { required: totalNeeded, available: balance, perRecipient: amount, recipients: eligible.length }
      );
    }

    const reason = `Reward: campaign "${campaign.name}"`;
    for (const r of eligible) {
      const addr = r.walletAddress;
      const out = await rewardIssuanceService.issueExact({
        shopId, customerAddress: addr, rcnAmount: amount, source: 'marketing_campaign', reason,
      });
      if (out.ok) {
        result.issued++;
        result.totalIssuedRcn += amount;
        await this.campaignRepo.markRecipientReward(campaign.id, addr, {
          kind: 'rcn', amount, status: 'issued', txHash: out.txHash, issuedAt: new Date(), error: null,
        });
      } else if (
        out.errorCode === 'customer_not_found' ||
        out.errorCode === 'customer_inactive' ||
        out.errorCode === 'self_reward'
      ) {
        // Not reachable for an RCN reward — emailed, but no token. Skipped, not failed.
        result.skipped++;
        await this.campaignRepo.markRecipientReward(campaign.id, addr, {
          kind: 'rcn', amount, status: 'skipped', error: out.error,
        });
      } else {
        result.failed++;
        await this.campaignRepo.markRecipientReward(campaign.id, addr, {
          kind: 'rcn', amount, status: 'failed', error: out.error,
        });
      }
    }

    logger.info('CampaignRewardService: on_send RCN fulfillment complete', {
      campaignId: campaign.id, ...result,
    });
    return result;
  }

  // ---- Phase 2: redeem-on-return ----

  /** True for a campaign whose RCN reward lands when the customer next returns. */
  hasOnReturnRcnReward(campaign: MarketingCampaign): boolean {
    return (
      campaign.rewardType === 'rcn' &&
      campaign.fulfillmentTrigger === 'on_return' &&
      !!campaign.rewardRcnAmount &&
      campaign.rewardRcnAmount > 0
    );
  }

  /**
   * Write a PENDING reward per eligible recipient at send time — no debit now.
   * The reward is issued later, when the customer completes an order within the
   * return window (redeemReturning). No balance gate here: the balance is checked
   * at redemption, so a win-back only ever spends on customers who actually return.
   */
  async fulfillOnReturn(
    campaign: MarketingCampaign,
    recipients: RewardRecipient[]
  ): Promise<{ pending: number; skipped: number }> {
    const shopId = campaign.shopId;
    const amount = campaign.rewardRcnAmount as number;
    const result = { pending: 0, skipped: 0 };

    if (!(await this.isEnabled(shopId))) {
      logger.warn('CampaignRewardService: on_return reward but campaign_rewards_enabled is OFF — skipping', {
        shopId, campaignId: campaign.id,
      });
      return result;
    }

    const shop = await shopRepository.getShop(shopId);
    const shopWallet = shop?.walletAddress?.toLowerCase();
    const windowDays = campaign.returnWindowDays && campaign.returnWindowDays > 0 ? campaign.returnWindowDays : 30;
    const expiresAt = new Date(Date.now() + windowDays * 86400000);

    for (const r of recipients) {
      if (!r.walletAddress || r.walletAddress.toLowerCase() === shopWallet) {
        result.skipped++;
        continue;
      }
      await this.campaignRepo.markRecipientReward(campaign.id, r.walletAddress, {
        kind: 'rcn', amount, status: 'pending', expiresAt, error: null,
      });
      result.pending++;
    }

    logger.info('CampaignRewardService: on_return pending rewards written', {
      campaignId: campaign.id, windowDays, ...result,
    });
    return result;
  }

  /**
   * Redeem any pending on_return rewards a customer earned, when they return
   * (a service.order_completed at the campaign's shop). Atomic claim prevents
   * double-issue across concurrent orders / event redeliveries; the RCN is issued
   * with the balance checked at this moment.
   */
  async redeemReturning(
    shopId: string,
    customerAddress: string
  ): Promise<{ redeemed: number; failed: number; totalRcn: number }> {
    const result = { redeemed: 0, failed: 0, totalRcn: 0 };
    const claimed = await this.campaignRepo.claimReturningRewards(shopId, customerAddress);
    if (claimed.length === 0) return result;

    for (const c of claimed) {
      const amount = c.rewardAmount;
      if (!amount || amount <= 0) continue;
      const out = await rewardIssuanceService.issueExact({
        shopId, customerAddress, rcnAmount: amount, source: 'marketing_campaign_return',
        reason: `Reward: returned for campaign "${c.campaignName}"`,
      });
      if (out.ok) {
        result.redeemed++;
        result.totalRcn += amount;
        // Row is already 'redeemed' from the claim — just attach the tx hash.
        await this.campaignRepo.markRecipientReward(c.campaignId, customerAddress, {
          txHash: out.txHash, error: null,
        });
      } else {
        // Issue failed after the optimistic claim — downgrade so it isn't counted
        // as delivered (and an admin can retry).
        result.failed++;
        await this.campaignRepo.markRecipientReward(c.campaignId, customerAddress, {
          status: 'failed', error: out.error,
        });
      }
    }

    logger.info('CampaignRewardService: redeem-on-return processed', {
      shopId, customerAddress, ...result,
    });
    return result;
  }

  /** Sweep pending on_return rewards past their window into 'expired'. */
  async expireOverdue(): Promise<number> {
    return this.campaignRepo.expireOverdueRewards();
  }

  /** Re-issue rewards to recipients whose first attempt failed. Idempotent —
   *  only touches rows still in 'failed'. */
  async retryFailed(campaign: MarketingCampaign): Promise<RewardFulfillmentResult> {
    const failed = await this.campaignRepo.findFailedRewardRecipients(campaign.id);
    return this.fulfillOnSend(
      campaign,
      failed.map((f) => ({ walletAddress: f.customerAddress }))
    );
  }
}

export const campaignRewardService = new CampaignRewardService();
