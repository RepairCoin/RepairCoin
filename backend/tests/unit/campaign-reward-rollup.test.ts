import { describe, it, expect } from '@jest/globals';
import {
  deriveCampaignDisplayStatus,
  mapRewardSummary,
  CampaignRewardSummary,
} from '../../src/repositories/MarketingCampaignRepository';

const emptySummary: CampaignRewardSummary = {
  pending: 0,
  redeemed: 0,
  expired: 0,
  issued: 0,
  failed: 0,
  skipped: 0,
};

describe('mapRewardSummary', () => {
  it('parses the reward_* aggregate columns into integers', () => {
    const summary = mapRewardSummary({
      reward_pending: '12',
      reward_redeemed: '5',
      reward_expired: '3',
      reward_issued: '0',
      reward_failed: '1',
      reward_skipped: '2',
    });
    expect(summary).toEqual({
      pending: 12,
      redeemed: 5,
      expired: 3,
      issued: 0,
      failed: 1,
      skipped: 2,
    });
  });

  it('defaults missing/null columns to zero', () => {
    expect(mapRewardSummary({})).toEqual(emptySummary);
    expect(mapRewardSummary({ reward_pending: null })).toEqual(emptySummary);
  });
});

describe('deriveCampaignDisplayStatus', () => {
  it('passes draft / scheduled / cancelled through unchanged', () => {
    for (const status of ['draft', 'scheduled', 'cancelled'] as const) {
      const display = deriveCampaignDisplayStatus(
        { status, rewardType: 'rcn', fulfillmentTrigger: 'on_return' },
        { ...emptySummary, pending: 5 }
      );
      expect(display).toBe(status);
    }
  });

  it('returns "active" for a sent on_return RCN campaign with a pending promise', () => {
    const display = deriveCampaignDisplayStatus(
      { status: 'sent', rewardType: 'rcn', fulfillmentTrigger: 'on_return' },
      { ...emptySummary, pending: 1, redeemed: 4, expired: 2 }
    );
    expect(display).toBe('active');
  });

  it('returns "sent" for a sent on_return RCN campaign with no pending promises', () => {
    const display = deriveCampaignDisplayStatus(
      { status: 'sent', rewardType: 'rcn', fulfillmentTrigger: 'on_return' },
      { ...emptySummary, redeemed: 4, expired: 2 }
    );
    expect(display).toBe('sent');
  });

  it('never returns "active" for on_send RCN campaigns even with pending rows', () => {
    const display = deriveCampaignDisplayStatus(
      { status: 'sent', rewardType: 'rcn', fulfillmentTrigger: 'on_send' },
      { ...emptySummary, pending: 5 }
    );
    expect(display).toBe('sent');
  });

  it('never returns "active" for message-only campaigns', () => {
    const display = deriveCampaignDisplayStatus(
      { status: 'sent', rewardType: 'none', fulfillmentTrigger: 'on_return' },
      { ...emptySummary, pending: 5 }
    );
    expect(display).toBe('sent');
  });
});
