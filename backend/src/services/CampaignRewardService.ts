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
import { shopHasFeature } from '../utils/shopTier';
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
      this.hasRewardAmount(campaign)
    );
  }

  /** True when the reward config grants RCN to someone — flat amount > 0, OR any
   *  tier/spend band > 0. Lets the has*RcnReward guards cover variable modes. */
  private hasRewardAmount(campaign: MarketingCampaign): boolean {
    const mode = campaign.rewardMode || 'flat';
    if (mode === 'by_tier') {
      return !!campaign.rewardRcnByTier && Object.values(campaign.rewardRcnByTier).some((v) => v > 0);
    }
    if (mode === 'by_spend') {
      return !!campaign.rewardSpendBands && campaign.rewardSpendBands.some((b) => b.rcn > 0);
    }
    return !!campaign.rewardRcnAmount && campaign.rewardRcnAmount > 0; // flat
  }

  /**
   * Per-recipient RCN amount, keyed by LOWERCASED address, per the reward mode.
   *   flat     → the same amount for everyone (no DB query)
   *   by_tier  → each customer's tier mapped through rewardRcnByTier
   *   by_spend → each customer's shop spend mapped to the highest matching band
   * Variable modes do ONE batch lookup of tier + shop spend. Addresses with no
   * reward (missing tier entry / below all bands) map to 0.
   */
  private async resolveAmounts(
    campaign: MarketingCampaign,
    addresses: string[]
  ): Promise<Map<string, number>> {
    const mode = campaign.rewardMode || 'flat';
    const lower = addresses.map((a) => a.toLowerCase());
    const map = new Map<string, number>();

    if (mode === 'flat') {
      const amt = campaign.rewardRcnAmount || 0;
      for (const a of lower) map.set(a, amt);
      return map;
    }
    if (lower.length === 0) return map;

    const r = await this.pool.query<{ addr: string; tier: string | null; spend: string | null }>(
      `SELECT LOWER(c.address) AS addr, c.tier,
              COALESCE(o.spend, 0)::float8::text AS spend
         FROM customers c
         LEFT JOIN (
           SELECT customer_address, SUM(total_amount) AS spend
             FROM service_orders
            WHERE shop_id = $1 AND status IN ('paid','completed')
            GROUP BY customer_address
         ) o ON LOWER(o.customer_address) = LOWER(c.address)
        WHERE LOWER(c.address) = ANY($2)`,
      [campaign.shopId, lower]
    );
    const info = new Map(
      r.rows.map((row) => [row.addr, { tier: row.tier, spend: Number(row.spend) || 0 }])
    );
    for (const a of lower) {
      const it = info.get(a);
      let amt = 0;
      if (it) {
        if (mode === 'by_tier') amt = (it.tier && campaign.rewardRcnByTier?.[it.tier]) || 0;
        else if (mode === 'by_spend') amt = this.bandAmount(campaign.rewardSpendBands, it.spend);
      }
      map.set(a, amt);
    }
    return map;
  }

  /** The RCN for a spend: the highest band whose minSpend the customer meets. */
  private bandAmount(
    bands: Array<{ minSpend: number; rcn: number }> | null,
    spend: number
  ): number {
    if (!bands || bands.length === 0) return 0;
    let best = 0;
    let bestMin = -1;
    for (const b of bands) {
      if (spend >= b.minSpend && b.minSpend >= bestMin) {
        bestMin = b.minSpend;
        best = b.rcn;
      }
    }
    return best;
  }

  private async isEnabled(shopId: string): Promise<boolean> {
    try {
      const r = await this.pool.query<{ campaign_rewards_enabled: boolean }>(
        `SELECT campaign_rewards_enabled FROM ai_shop_settings WHERE shop_id = $1`,
        [shopId]
      );
      if (r.rows[0]?.campaign_rewards_enabled !== true) return false;
      // WS2 tier entitlement — Campaign Rewards is Growth+; a stale flag can't bypass it.
      return await shopHasFeature(shopId, "campaignRewards");
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

    // Per-recipient amounts (flat / by_tier / by_spend), then the all-or-nothing
    // balance gate on the SUM.
    const amounts = await this.resolveAmounts(campaign, eligible.map((r) => r.walletAddress));
    const totalNeeded = Array.from(amounts.values()).reduce((s, v) => s + v, 0);
    const balance = shop?.purchasedRcnBalance ?? 0;
    if (totalNeeded > 0 && balance < totalNeeded) {
      const isFlat = (campaign.rewardMode || 'flat') === 'flat';
      throw new CampaignRewardBlockedError(
        `This campaign's reward needs ${totalNeeded} RCN, but the shop's balance is ${balance} RCN.`,
        isFlat
          ? { required: totalNeeded, available: balance, perRecipient: campaign.rewardRcnAmount || 0, recipients: eligible.length }
          : { required: totalNeeded, available: balance, recipients: eligible.length }
      );
    }

    const reason = `Reward: campaign "${campaign.name}"`;
    for (const r of eligible) {
      const addr = r.walletAddress;
      const amount = amounts.get(addr.toLowerCase()) ?? 0;
      if (amount <= 0) {
        // No reward for this customer under the chosen tier/spend schedule.
        result.skipped++;
        await this.campaignRepo.markRecipientReward(campaign.id, addr, {
          kind: 'rcn', amount: 0, status: 'skipped', error: 'no reward for this customer (tier/spend)',
        });
        continue;
      }
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

  /**
   * Non-mutating affordability check for an on_send RCN reward — used by the
   * review modal to warn / disable Send BEFORE the owner taps (the same numbers
   * the balance gate uses at send time). `applicable:false` means there's no
   * on_send RCN reward to gate (nothing to warn about).
   */
  async precheckOnSend(
    campaign: MarketingCampaign,
    recipients: RewardRecipient[]
  ): Promise<{ applicable: boolean; required: number; available: number; affordable: boolean }> {
    if (!this.hasOnSendRcnReward(campaign) || !(await this.isEnabled(campaign.shopId))) {
      return { applicable: false, required: 0, available: 0, affordable: true };
    }
    const shop = await shopRepository.getShop(campaign.shopId);
    const shopWallet = shop?.walletAddress?.toLowerCase();
    const eligible = recipients.filter(
      (r) => r.walletAddress && r.walletAddress.toLowerCase() !== shopWallet
    );
    const amounts = await this.resolveAmounts(campaign, eligible.map((r) => r.walletAddress));
    const required = Array.from(amounts.values()).reduce((s, v) => s + v, 0);
    const available = shop?.purchasedRcnBalance ?? 0;
    return { applicable: true, required, available, affordable: required <= available };
  }

  // ---- Phase 2: redeem-on-return ----

  /** True for a campaign whose RCN reward lands when the customer next returns. */
  hasOnReturnRcnReward(campaign: MarketingCampaign): boolean {
    return (
      campaign.rewardType === 'rcn' &&
      campaign.fulfillmentTrigger === 'on_return' &&
      this.hasRewardAmount(campaign)
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
    const result = { pending: 0, skipped: 0 };

    if (!(await this.isEnabled(shopId))) {
      logger.warn('CampaignRewardService: on_return reward but campaign_rewards_enabled is OFF — skipping', {
        shopId, campaignId: campaign.id,
      });
      return result;
    }

    const shop = await shopRepository.getShop(shopId);
    const shopWallet = shop?.walletAddress?.toLowerCase();
    const eligible = recipients.filter(
      (r) => r.walletAddress && r.walletAddress.toLowerCase() !== shopWallet
    );
    result.skipped = recipients.length - eligible.length;

    const amounts = await this.resolveAmounts(campaign, eligible.map((r) => r.walletAddress));
    const windowDays = campaign.returnWindowDays && campaign.returnWindowDays > 0 ? campaign.returnWindowDays : 30;
    const expiresAt = new Date(Date.now() + windowDays * 86400000);

    for (const r of eligible) {
      const amount = amounts.get(r.walletAddress.toLowerCase()) ?? 0;
      if (amount <= 0) {
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
