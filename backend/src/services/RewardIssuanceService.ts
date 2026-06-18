// backend/src/services/RewardIssuanceService.ts
//
// Issue an EXACT amount of RCN from a shop to a customer — the reusable core
// shared by the manual /shops/:shopId/issue-reward route and (Phase 1+) campaign
// rewards. It wraps the SAME battle-tested primitives the route already uses:
//   - on-chain transfer/mint via getTokenMinter() (best-effort, gated by
//     ENABLE_BLOCKCHAIN_MINTING, with a mint fallback after a failed transfer)
//   - shopRepository.issueRewardAtomic() — the atomic shop-balance debit +
//     customer credit + transaction record, which throws on insufficient balance.
//
// Unlike the route, it takes an EXPLICIT amount (no repair/tier/promo math) — the
// caller decides how much. Never throws; returns a typed outcome so batch callers
// (campaign sends) can record per-recipient success/failure without try/catch.
//
// Campaign rewards spec: docs/tasks/strategy/campaign-rewards/.

import { shopRepository, customerRepository } from '../repositories';
// TokenMinter is lazy-imported inside the ENABLE_BLOCKCHAIN_MINTING branch only,
// so the dormant contract module isn't loaded in DB-only mode.
// docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md
import { TierManager } from '../contracts/TierManager';
import { logger } from '../utils/logger';

export type IssueErrorCode =
  | 'invalid_amount'
  | 'shop_not_found'
  | 'shop_inactive'
  | 'customer_not_found'
  | 'customer_inactive'
  | 'self_reward'
  | 'insufficient_balance'
  | 'failed';

export interface IssueExactParams {
  shopId: string;
  customerAddress: string;
  rcnAmount: number;
  /** Tag for logging / future transaction metadata, e.g. 'marketing_campaign'. */
  source: string;
  /** Optional human reason recorded with the on-chain op. */
  reason?: string;
}

export interface IssueExactResult {
  ok: boolean;
  txHash?: string;
  shopNewBalance?: number;
  onChain?: boolean;
  errorCode?: IssueErrorCode;
  error?: string;
}

export class RewardIssuanceService {
  private tierManager = new TierManager();

  /**
   * Issue exactly `rcnAmount` RCN from `shopId` to `customerAddress`.
   * Returns `{ ok:false, errorCode }` for every expected failure (insufficient
   * balance, unregistered/suspended customer, inactive shop, etc.) — never throws.
   */
  async issueExact(params: IssueExactParams): Promise<IssueExactResult> {
    const { shopId, customerAddress, rcnAmount, source, reason } = params;

    if (!Number.isFinite(rcnAmount) || rcnAmount <= 0) {
      return { ok: false, errorCode: 'invalid_amount', error: 'rcnAmount must be greater than 0' };
    }

    const shop = await shopRepository.getShop(shopId);
    if (!shop) return { ok: false, errorCode: 'shop_not_found', error: 'Shop not found' };
    if (!shop.active || !shop.verified) {
      return { ok: false, errorCode: 'shop_inactive', error: 'Shop must be active and verified to issue rewards' };
    }
    if (shop.walletAddress && shop.walletAddress.toLowerCase() === customerAddress.toLowerCase()) {
      return { ok: false, errorCode: 'self_reward', error: "Cannot issue a reward to the shop's own wallet" };
    }

    const customer = await customerRepository.getCustomer(customerAddress);
    if (!customer) return { ok: false, errorCode: 'customer_not_found', error: 'Customer must be registered to receive rewards' };
    if (!customer.isActive) return { ok: false, errorCode: 'customer_inactive', error: 'Cannot issue rewards to a suspended customer' };

    const newTier = this.tierManager.calculateTier((customer.lifetimeEarnings || 0) + rcnAmount);

    // On-chain (best-effort) — mirrors the issue-reward route. Falls back to
    // off-chain tracking when minting is disabled or the chain op fails; the
    // atomic DB step below is the source of truth either way.
    let transactionHash = `offchain_${Date.now()}`;
    let onChain = false;
    if (process.env.ENABLE_BLOCKCHAIN_MINTING === 'true') {
      try {
        const { getTokenMinter } = await import('../contracts/_archive/TokenMinter');
        const minter = getTokenMinter();
        const note = reason || `Campaign reward from shop ${shop.name}`;
        const transfer = await minter.transferTokens(customerAddress, rcnAmount, note);
        if (transfer.success && transfer.transactionHash) {
          transactionHash = transfer.transactionHash;
          onChain = true;
        } else {
          const mint = await minter.adminMintTokens(customerAddress, rcnAmount, `${note} (mint fallback)`);
          if (mint.success && mint.transactionHash) {
            transactionHash = mint.transactionHash;
            onChain = true;
          }
        }
      } catch (err) {
        logger.error('RewardIssuanceService: on-chain op failed, continuing off-chain', {
          shopId, customerAddress, rcnAmount, source,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    try {
      const atomic = await shopRepository.issueRewardAtomic(shopId, customerAddress, rcnAmount, {
        transactionHash,
        repairAmount: 0,
        baseReward: rcnAmount,
        tierBonus: 0,
        promoBonus: 0,
        promoCode: null,
        newTier,
      });
      logger.info('RewardIssuanceService: issued', {
        shopId, customerAddress, rcnAmount, source, onChain,
        shopNewBalance: atomic.shopNewBalance, txHash: transactionHash,
      });
      return { ok: true, txHash: transactionHash, shopNewBalance: atomic.shopNewBalance, onChain };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Insufficient balance')) return { ok: false, errorCode: 'insufficient_balance', error: msg };
      if (msg.includes('Customer not found')) return { ok: false, errorCode: 'customer_not_found', error: msg };
      if (msg.includes('Shop not found')) return { ok: false, errorCode: 'shop_not_found', error: msg };
      logger.error('RewardIssuanceService: atomic issue failed', { shopId, customerAddress, rcnAmount, source, error: msg });
      return { ok: false, errorCode: 'failed', error: msg };
    }
  }
}

export const rewardIssuanceService = new RewardIssuanceService();
