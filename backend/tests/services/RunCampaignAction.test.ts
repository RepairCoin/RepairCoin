// Custom Workflows §9.2 — the `run_campaign` action.
//
// Two properties carry the whole design, and both are the kind that look like implementation detail
// until they misfire in production:
//
//   1. It is SHOP-scoped. The scheduler runs an action once per customer in the target audience, so a
//      per-customer campaign action fires N campaigns to N people, each addressing all N again.
//   2. It CLONES. `MarketingService.sendCampaign` throws on `status === 'sent'` and then marks the
//      campaign sent, so an action pointing straight at a campaign works exactly once and throws on
//      every later trigger — a workflow that quietly stops doing anything.

import {
  AUTO_MESSAGE_ACTION_TYPES,
  NO_TEMPLATE_ACTIONS,
  SHOP_SCOPED_ACTIONS,
} from '../../src/services/autoMessageActions/registry';
import {
  RunCampaignAction,
  parseRunCampaignPayload,
} from '../../src/services/autoMessageActions/runCampaignAction';

const rule = (over: Record<string, unknown> = {}) =>
  ({ id: 'rule-1', shopId: 'peanut', name: 'Weekly promo', ...over }) as any;

const ctx = (payload: unknown, over: Record<string, unknown> = {}) =>
  ({
    rule: rule(),
    shopId: 'peanut',
    customerAddress: '',
    shopName: 'Peanut Repairs',
    actionType: 'run_campaign',
    actionPayload: payload,
    ...over,
  }) as any;

/** Minimal stand-ins — the point is which calls happen, not what the real services return. */
const makeDeps = (source: Record<string, unknown> | null) => {
  const shops = { getShop: jest.fn(async () => ({ name: "Peanut Repairs", email: "p@x.test", walletAddress: "0xabc" })) } as any;
  const created: any[] = [];
  const sent: string[] = [];
  const campaigns = {
    findById: jest.fn(async () => source),
    create: jest.fn(async (params: any) => {
      created.push(params);
      return { id: `clone-${created.length}`, ...params };
    }),
  } as any;
  const marketing = {
    sendCampaign: jest.fn(async (id: string) => {
      sent.push(id);
      return { totalRecipients: 3 };
    }),
  } as any;
  return { campaigns, marketing, shops, created, sent };
};

const SOURCE = {
  id: 'camp-1',
  shopId: 'peanut',
  name: 'Spring promo',
  campaignType: 'offer_coupon',
  subject: 'Spring deals',
  previewText: null,
  designContent: { blocks: [] },
  templateId: null,
  audienceType: 'all_customers',
  audienceFilters: {},
  deliveryMethod: 'both',
  serviceId: null,
};

describe('run_campaign registration', () => {
  it('is offered as an action', () => {
    expect(AUTO_MESSAGE_ACTION_TYPES).toContain('run_campaign');
  });

  // Fires once per rule per tick. Without this the scheduler sends one campaign per recipient.
  it('is shop-scoped, so it runs once and not once per customer', () => {
    expect(SHOP_SCOPED_ACTIONS.has('run_campaign')).toBe(true);
  });

  it('needs no messageTemplate — the campaign carries its own body', () => {
    expect(NO_TEMPLATE_ACTIONS.has('run_campaign')).toBe(true);
  });
});

describe('payload parsing', () => {
  it('accepts a campaign id', () => {
    expect(parseRunCampaignPayload({ campaignId: ' camp-1 ' })).toEqual({ campaignId: 'camp-1' });
  });

  // An empty id must not survive as "" — the API rejects a missing one precisely so a rule cannot sit
  // published and erroring on every tick.
  it('treats blank or missing as absent', () => {
    expect(parseRunCampaignPayload({ campaignId: '   ' })).toEqual({});
    expect(parseRunCampaignPayload({})).toEqual({});
    expect(parseRunCampaignPayload(null)).toEqual({});
  });
});

describe('execute', () => {
  it('clones the campaign and sends the CLONE, never the original', async () => {
    const { campaigns, marketing, created, sent , shops } = makeDeps(SOURCE);
    const res = await new RunCampaignAction(marketing, campaigns, shops).execute(
      ctx({ campaignId: 'camp-1' })
    );

    expect(res.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(sent).toEqual(['clone-1']);
    expect(sent).not.toContain('camp-1');
  });

  it('carries the source campaign\'s content and audience onto the clone', async () => {
    const { campaigns, marketing, created , shops } = makeDeps(SOURCE);
    await new RunCampaignAction(marketing, campaigns, shops).execute(ctx({ campaignId: 'camp-1' }));

    expect(created[0]).toMatchObject({
      shopId: 'peanut',
      campaignType: 'offer_coupon',
      subject: 'Spring deals',
      audienceType: 'all_customers',
      deliveryMethod: 'both',
    });
  });

  // Rewards are money on a recurring schedule nobody re-approves each run. Until that has its own
  // decision, the clone sends the message and skips the payout.
  it('does not carry rewards onto the clone', async () => {
    const { campaigns, marketing, created , shops } = makeDeps({
      ...SOURCE,
      rewardType: 'rcn',
      rewardRcnAmount: 50,
    });
    await new RunCampaignAction(marketing, campaigns, shops).execute(ctx({ campaignId: 'camp-1' }));

    expect(created[0]).not.toHaveProperty('rewardType');
    expect(created[0]).not.toHaveProperty('rewardRcnAmount');
  });

  it('refuses a campaign belonging to another shop', async () => {
    const { campaigns, marketing, sent , shops } = makeDeps({ ...SOURCE, shopId: 'someone-else' });
    const res = await new RunCampaignAction(marketing, campaigns, shops).execute(
      ctx({ campaignId: 'camp-1' })
    );

    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('skips cleanly when the campaign has been deleted', async () => {
    const { campaigns, marketing, sent , shops } = makeDeps(null);
    const res = await new RunCampaignAction(marketing, campaigns, shops).execute(
      ctx({ campaignId: 'gone' })
    );

    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('skips when no campaign was configured', async () => {
    const { campaigns, marketing , shops } = makeDeps(SOURCE);
    const res = await new RunCampaignAction(marketing, campaigns, shops).execute(ctx({}));

    expect(res.ok).toBe(false);
    expect(campaigns.findById).not.toHaveBeenCalled();
  });

  // The scheduler processes every shop in one tick; a throw here would take the rest of the run with it.
  it('swallows a send failure instead of taking down the tick', async () => {
    const { campaigns, created , shops } = makeDeps(SOURCE);
    const marketing = {
      sendCampaign: jest.fn(async () => {
        throw new Error('SMTP exploded');
      }),
    } as any;

    const res = await new RunCampaignAction(marketing, campaigns, shops).execute(
      ctx({ campaignId: 'camp-1' })
    );

    expect(res.ok).toBe(false);
    expect(created).toHaveLength(1); // it got as far as cloning
  });
});
