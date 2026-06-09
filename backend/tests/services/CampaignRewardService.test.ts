// backend/tests/services/CampaignRewardService.test.ts
//
// Campaign Rewards — Phase 1 unit tests. Covers the orchestration logic in
// CampaignRewardService (flag gate, eligibility split, balance gate, per-recipient
// outcomes, idempotent retry). The actual RCN issuance (RewardIssuanceService) is
// mocked — these tests assert HOW the service decides/records, not the on-chain mint.

// Mock the injected dependencies. (Vars must be `mock`-prefixed to be referenced
// inside jest.mock factories.)
const mockIssueExact = jest.fn();
const mockGetShop = jest.fn();
const mockMarkRecipientReward = jest.fn();
const mockFindFailedRewardRecipients = jest.fn();
const mockClaimReturningRewards = jest.fn();
const mockExpireOverdueRewards = jest.fn();

jest.mock('../../src/utils/database-pool', () => ({
  getSharedPool: jest.fn(),
}));
jest.mock('../../src/services/RewardIssuanceService', () => ({
  rewardIssuanceService: { issueExact: (...args: any[]) => mockIssueExact(...args) },
  RewardIssuanceService: jest.fn(),
}));
jest.mock('../../src/repositories', () => ({
  shopRepository: { getShop: (...args: any[]) => mockGetShop(...args) },
}));
jest.mock('../../src/repositories/MarketingCampaignRepository', () => ({
  MarketingCampaignRepository: jest.fn().mockImplementation(() => ({
    markRecipientReward: (...args: any[]) => mockMarkRecipientReward(...args),
    findFailedRewardRecipients: (...args: any[]) => mockFindFailedRewardRecipients(...args),
    claimReturningRewards: (...args: any[]) => mockClaimReturningRewards(...args),
    expireOverdueRewards: (...args: any[]) => mockExpireOverdueRewards(...args),
  })),
}));

import {
  CampaignRewardService,
  CampaignRewardBlockedError,
} from '../../src/services/CampaignRewardService';

// ----- Helpers -----

const SHOP_WALLET = '0xshopwallet000000000000000000000000000000';

const campaign = (overrides: Record<string, any> = {}): any => ({
  id: 'camp_1',
  shopId: 'shop_test',
  name: 'Win-back',
  rewardType: 'rcn',
  rewardMode: 'flat',
  rewardRcnAmount: 10,
  fulfillmentTrigger: 'on_send',
  ...overrides,
});

const recipients = (...addrs: string[]) => addrs.map((walletAddress) => ({ walletAddress }));

/** A pool whose flag query returns the given enabled state. */
const poolWith = (enabled: boolean): any => ({
  query: jest.fn().mockResolvedValue({ rows: [{ campaign_rewards_enabled: enabled }] }),
});

const service = (enabled = true) => new CampaignRewardService(poolWith(enabled));

beforeEach(() => {
  mockMarkRecipientReward.mockResolvedValue(undefined);
  mockGetShop.mockResolvedValue({ walletAddress: SHOP_WALLET, purchasedRcnBalance: 1000 });
  mockIssueExact.mockResolvedValue({ ok: true, txHash: '0xtx', shopNewBalance: 990, onChain: false });
});

// ----- hasOnSendRcnReward -----

describe('hasOnSendRcnReward', () => {
  it('is true for a flat on_send RCN reward', () => {
    expect(service().hasOnSendRcnReward(campaign())).toBe(true);
  });
  it('is false when there is no reward', () => {
    expect(service().hasOnSendRcnReward(campaign({ rewardType: 'none', rewardRcnAmount: null }))).toBe(false);
  });
  it('is false for a coupon reward', () => {
    expect(service().hasOnSendRcnReward(campaign({ rewardType: 'coupon' }))).toBe(false);
  });
  it('is false for an on_return reward (handled in Phase 2)', () => {
    expect(service().hasOnSendRcnReward(campaign({ fulfillmentTrigger: 'on_return' }))).toBe(false);
  });
  it('is false when the amount is missing or zero', () => {
    expect(service().hasOnSendRcnReward(campaign({ rewardRcnAmount: 0 }))).toBe(false);
    expect(service().hasOnSendRcnReward(campaign({ rewardRcnAmount: null }))).toBe(false);
  });
});

// ----- fulfillOnSend -----

describe('fulfillOnSend', () => {
  it('skips fulfillment (and never issues) when campaign_rewards_enabled is OFF', async () => {
    const res = await service(false).fulfillOnSend(campaign(), recipients('0xa', '0xb'));
    expect(res).toEqual({ issued: 0, skipped: 0, failed: 0, totalIssuedRcn: 0 });
    expect(mockIssueExact).not.toHaveBeenCalled();
    expect(mockMarkRecipientReward).not.toHaveBeenCalled();
  });

  it('issues to every eligible recipient and records them as issued', async () => {
    const res = await service().fulfillOnSend(campaign(), recipients('0xa', '0xb', '0xc'));
    expect(res).toEqual({ issued: 3, skipped: 0, failed: 0, totalIssuedRcn: 30 });
    expect(mockIssueExact).toHaveBeenCalledTimes(3);
    expect(mockIssueExact).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: 'shop_test', rcnAmount: 10, source: 'marketing_campaign' })
    );
    expect(mockMarkRecipientReward).toHaveBeenCalledWith(
      'camp_1', '0xa', expect.objectContaining({ status: 'issued', amount: 10, txHash: '0xtx' })
    );
  });

  it('blocks the whole send when the shop balance cannot cover the full eligible set', async () => {
    mockGetShop.mockResolvedValue({ walletAddress: SHOP_WALLET, purchasedRcnBalance: 25 }); // need 3×10=30
    await expect(service().fulfillOnSend(campaign(), recipients('0xa', '0xb', '0xc'))).rejects.toBeInstanceOf(
      CampaignRewardBlockedError
    );
    // Nothing issued when blocked.
    expect(mockIssueExact).not.toHaveBeenCalled();
  });

  it('carries the shortfall details on the block error', async () => {
    mockGetShop.mockResolvedValue({ walletAddress: SHOP_WALLET, purchasedRcnBalance: 25 });
    expect.assertions(1);
    try {
      await service().fulfillOnSend(campaign(), recipients('0xa', '0xb', '0xc'));
    } catch (e: any) {
      expect(e.details).toEqual({ required: 30, available: 25, perRecipient: 10, recipients: 3 });
    }
  });

  it("excludes the shop's own wallet from eligibility", async () => {
    const res = await service().fulfillOnSend(campaign(), recipients('0xa', SHOP_WALLET.toUpperCase()));
    expect(res.issued).toBe(1); // only 0xa
    expect(mockIssueExact).toHaveBeenCalledTimes(1);
    expect(mockIssueExact).toHaveBeenCalledWith(expect.objectContaining({ customerAddress: '0xa' }));
  });

  it('marks unreachable customers as skipped and real errors as failed', async () => {
    mockIssueExact
      .mockResolvedValueOnce({ ok: true, txHash: '0xtx' }) // 0xa issued
      .mockResolvedValueOnce({ ok: false, errorCode: 'customer_not_found', error: 'not registered' }) // 0xb skipped
      .mockResolvedValueOnce({ ok: false, errorCode: 'failed', error: 'mint blew up' }); // 0xc failed

    const res = await service().fulfillOnSend(campaign(), recipients('0xa', '0xb', '0xc'));
    expect(res).toEqual({ issued: 1, skipped: 1, failed: 1, totalIssuedRcn: 10 });
    expect(mockMarkRecipientReward).toHaveBeenCalledWith('camp_1', '0xb', expect.objectContaining({ status: 'skipped' }));
    expect(mockMarkRecipientReward).toHaveBeenCalledWith('camp_1', '0xc', expect.objectContaining({ status: 'failed' }));
  });

  it('is a no-op with no eligible recipients (no block, no issue)', async () => {
    const res = await service().fulfillOnSend(campaign(), []);
    expect(res).toEqual({ issued: 0, skipped: 0, failed: 0, totalIssuedRcn: 0 });
    expect(mockIssueExact).not.toHaveBeenCalled();
  });
});

// ----- retryFailed -----

describe('retryFailed', () => {
  it('re-issues only the recipients still marked failed', async () => {
    mockFindFailedRewardRecipients.mockResolvedValue([
      { customerAddress: '0xa' },
      { customerAddress: '0xb' },
    ]);
    const res = await service().retryFailed(campaign());
    expect(mockFindFailedRewardRecipients).toHaveBeenCalledWith('camp_1');
    expect(mockIssueExact).toHaveBeenCalledTimes(2);
    expect(res.issued).toBe(2);
  });

  it('does nothing when there are no failed recipients', async () => {
    mockFindFailedRewardRecipients.mockResolvedValue([]);
    const res = await service().retryFailed(campaign());
    expect(res).toEqual({ issued: 0, skipped: 0, failed: 0, totalIssuedRcn: 0 });
    expect(mockIssueExact).not.toHaveBeenCalled();
  });
});

// ----- Phase 2: redeem-on-return -----

const onReturn = (overrides: Record<string, any> = {}) =>
  campaign({ fulfillmentTrigger: 'on_return', returnWindowDays: 30, ...overrides });

describe('hasOnReturnRcnReward', () => {
  it('is true for an on_return RCN reward', () => {
    expect(service().hasOnReturnRcnReward(onReturn())).toBe(true);
  });
  it('is false for an on_send reward', () => {
    expect(service().hasOnReturnRcnReward(campaign())).toBe(false);
  });
});

describe('fulfillOnReturn', () => {
  it('writes a PENDING reward per eligible recipient with an expiry, and never issues at send', async () => {
    const res = await service().fulfillOnReturn(onReturn(), recipients('0xa', '0xb'));
    expect(res).toEqual({ pending: 2, skipped: 0 });
    expect(mockIssueExact).not.toHaveBeenCalled(); // nothing issued at send
    expect(mockMarkRecipientReward).toHaveBeenCalledWith(
      'camp_1', '0xa',
      expect.objectContaining({ status: 'pending', amount: 10, expiresAt: expect.any(Date) })
    );
  });

  it("skips the shop's own wallet", async () => {
    const res = await service().fulfillOnReturn(onReturn(), recipients('0xa', SHOP_WALLET));
    expect(res).toEqual({ pending: 1, skipped: 1 });
  });

  it('skips entirely when the flag is OFF', async () => {
    const res = await service(false).fulfillOnReturn(onReturn(), recipients('0xa'));
    expect(res).toEqual({ pending: 0, skipped: 0 });
    expect(mockMarkRecipientReward).not.toHaveBeenCalled();
  });
});

describe('redeemReturning', () => {
  it('issues a claimed pending reward and attaches the tx hash', async () => {
    mockClaimReturningRewards.mockResolvedValue([
      { id: 'r1', campaignId: 'camp_1', customerAddress: '0xa', rewardAmount: 25, campaignName: 'Win-back' },
    ]);
    const res = await service().redeemReturning('shop_test', '0xa');
    expect(res).toEqual({ redeemed: 1, failed: 0, totalRcn: 25 });
    expect(mockIssueExact).toHaveBeenCalledWith(
      expect.objectContaining({ rcnAmount: 25, source: 'marketing_campaign_return' })
    );
    expect(mockMarkRecipientReward).toHaveBeenCalledWith('camp_1', '0xa', expect.objectContaining({ txHash: '0xtx' }));
  });

  it('is a no-op when nothing is claimed (idempotent — already redeemed / no pending)', async () => {
    mockClaimReturningRewards.mockResolvedValue([]);
    const res = await service().redeemReturning('shop_test', '0xa');
    expect(res).toEqual({ redeemed: 0, failed: 0, totalRcn: 0 });
    expect(mockIssueExact).not.toHaveBeenCalled();
  });

  it('downgrades a claimed reward to failed when issuance fails', async () => {
    mockClaimReturningRewards.mockResolvedValue([
      { id: 'r1', campaignId: 'camp_1', customerAddress: '0xa', rewardAmount: 25, campaignName: 'Win-back' },
    ]);
    mockIssueExact.mockResolvedValue({ ok: false, errorCode: 'insufficient_balance', error: 'short' });
    const res = await service().redeemReturning('shop_test', '0xa');
    expect(res).toEqual({ redeemed: 0, failed: 1, totalRcn: 0 });
    expect(mockMarkRecipientReward).toHaveBeenCalledWith('camp_1', '0xa', expect.objectContaining({ status: 'failed' }));
  });
});

describe('expireOverdue', () => {
  it('delegates to the repo and returns the count expired', async () => {
    mockExpireOverdueRewards.mockResolvedValue(4);
    await expect(service().expireOverdue()).resolves.toBe(4);
    expect(mockExpireOverdueRewards).toHaveBeenCalled();
  });
});

// ----- Phase 3: variable RCN (by_tier / by_spend) -----

/** Pool that serves BOTH the flag query and the tier/spend resolve query. */
const poolVariable = (resolveRows: any[]): any => ({
  query: jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('campaign_rewards_enabled')) {
      return Promise.resolve({ rows: [{ campaign_rewards_enabled: true }] });
    }
    if (sql.includes('FROM customers')) {
      return Promise.resolve({ rows: resolveRows });
    }
    return Promise.resolve({ rows: [] });
  }),
});
const serviceV = (rows: any[]) => new CampaignRewardService(poolVariable(rows));

describe('variable rewards — gating', () => {
  it('hasOnSendRcnReward is true when any tier amount is > 0', () => {
    const c = campaign({ rewardMode: 'by_tier', rewardRcnAmount: null, rewardRcnByTier: { GOLD: 50, BRONZE: 0 } });
    expect(service().hasOnSendRcnReward(c)).toBe(true);
  });
  it('hasOnSendRcnReward is false when every tier amount is 0', () => {
    const c = campaign({ rewardMode: 'by_tier', rewardRcnAmount: null, rewardRcnByTier: { GOLD: 0, BRONZE: 0 } });
    expect(service().hasOnSendRcnReward(c)).toBe(false);
  });
  it('hasOnSendRcnReward is true when any spend band is > 0', () => {
    const c = campaign({ rewardMode: 'by_spend', rewardRcnAmount: null, rewardSpendBands: [{ minSpend: 0, rcn: 10 }] });
    expect(service().hasOnSendRcnReward(c)).toBe(true);
  });
});

describe('fulfillOnSend — by_tier', () => {
  it('issues each recipient the amount for their tier and skips those with no tier mapping', async () => {
    const c = campaign({ rewardMode: 'by_tier', rewardRcnAmount: null, rewardRcnByTier: { GOLD: 50, SILVER: 25, BRONZE: 10 } });
    const svc = serviceV([
      { addr: '0xa', tier: 'GOLD', spend: '0' },
      { addr: '0xb', tier: 'BRONZE', spend: '0' },
      // 0xc absent → no tier → amount 0 → skipped
    ]);
    const res = await svc.fulfillOnSend(c, recipients('0xa', '0xb', '0xc'));
    expect(res).toEqual({ issued: 2, skipped: 1, failed: 0, totalIssuedRcn: 60 });
    expect(mockIssueExact).toHaveBeenCalledWith(expect.objectContaining({ customerAddress: '0xa', rcnAmount: 50 }));
    expect(mockIssueExact).toHaveBeenCalledWith(expect.objectContaining({ customerAddress: '0xb', rcnAmount: 10 }));
  });
});

describe('fulfillOnSend — by_spend', () => {
  it('issues the highest band each customer qualifies for', async () => {
    const c = campaign({
      rewardMode: 'by_spend', rewardRcnAmount: null,
      rewardSpendBands: [{ minSpend: 0, rcn: 10 }, { minSpend: 500, rcn: 25 }, { minSpend: 1000, rcn: 50 }],
    });
    const svc = serviceV([
      { addr: '0xa', tier: null, spend: '1500' }, // → 50
      { addr: '0xb', tier: null, spend: '600' },  // → 25
      { addr: '0xc', tier: null, spend: '100' },  // → 10
    ]);
    const res = await svc.fulfillOnSend(c, recipients('0xa', '0xb', '0xc'));
    expect(res).toEqual({ issued: 3, skipped: 0, failed: 0, totalIssuedRcn: 85 });
  });

  it('blocks the send when the variable TOTAL exceeds the balance', async () => {
    mockGetShop.mockResolvedValue({ walletAddress: SHOP_WALLET, purchasedRcnBalance: 40 });
    const c = campaign({ rewardMode: 'by_tier', rewardRcnAmount: null, rewardRcnByTier: { GOLD: 50, BRONZE: 10 } });
    const svc = serviceV([
      { addr: '0xa', tier: 'GOLD', spend: '0' },   // 50
      { addr: '0xb', tier: 'BRONZE', spend: '0' },  // 10  → total 60 > 40
    ]);
    await expect(svc.fulfillOnSend(c, recipients('0xa', '0xb'))).rejects.toBeInstanceOf(CampaignRewardBlockedError);
    expect(mockIssueExact).not.toHaveBeenCalled();
  });
});
