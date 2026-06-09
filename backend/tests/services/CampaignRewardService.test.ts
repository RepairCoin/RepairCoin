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
