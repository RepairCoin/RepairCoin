// Custom Workflows §9.2 item 2 — the `draft_reorder` action.
//
// This is the second automated path to reach POSuggestionService, and the first one ended badly: the
// `reorder_recommendation` insights TOOL, presented as a read, called generateSuggestions() from a
// nightly detector and manufactured 12 purchase-order suggestions across 5 staging shops. The rule
// written down afterwards was "never call it from a detector or a sweep".
//
// This is not that. A detector claims to observe; an action a shop configured and published is asking
// for the write. What these tests pin is the difference being deliberate, and the consequences bounded.

import { DraftReorderAction } from '../../src/services/autoMessageActions/draftReorderAction';
import {
  AUTO_MESSAGE_ACTION_TYPES,
  NO_TEMPLATE_ACTIONS,
  SHOP_SCOPED_ACTIONS,
} from '../../src/services/autoMessageActions/registry';

const ctx = (over: Record<string, unknown> = {}) =>
  ({
    rule: { id: 'rule-1', name: 'Reorder low stock', triggerType: 'event', eventType: 'low_stock' },
    shopId: 'peanut',
    customerAddress: '',
    shopName: 'Peanut Repairs',
    actionType: 'draft_reorder',
    actionPayload: {},
    ...over,
  }) as any;

describe('draft_reorder registration', () => {
  it('is offered as an action', () => {
    expect(AUTO_MESSAGE_ACTION_TYPES).toContain('draft_reorder');
  });

  // Reordering happens to inventory. Run per customer it would redraft the same PO once per person.
  it('is shop-scoped', () => {
    expect(SHOP_SCOPED_ACTIONS.has('draft_reorder')).toBe(true);
  });

  it('carries no message template', () => {
    expect(NO_TEMPLATE_ACTIONS.has('draft_reorder')).toBe(true);
  });
});

describe('execute', () => {
  it('drafts suggestions for the rule\'s own shop', async () => {
    const drafter = { generateSuggestions: jest.fn(async () => [{ id: 's1' }, { id: 's2' }]) };
    const res = await new DraftReorderAction(drafter).execute(ctx());

    expect(res.ok).toBe(true);
    expect(drafter.generateSuggestions).toHaveBeenCalledWith('peanut');
    expect(drafter.generateSuggestions).toHaveBeenCalledTimes(1);
  });

  // The trigger fires for one item; by the time the action runs the reorder logic may find nothing at
  // or below threshold. That is a normal run, not a failure to report.
  it('treats "nothing to reorder" as success', async () => {
    const drafter = { generateSuggestions: jest.fn(async () => []) };
    const res = await new DraftReorderAction(drafter).execute(ctx());

    expect(res.ok).toBe(true);
  });

  // The scheduler is mid-tick across every shop when this runs.
  it('swallows an inventory failure rather than ending the tick', async () => {
    const drafter = {
      generateSuggestions: jest.fn(async () => {
        throw new Error('inventory unavailable');
      }),
    };
    const res = await new DraftReorderAction(drafter).execute(ctx());

    expect(res.ok).toBe(false);
  });

  // De-duplication belongs to createSuggestion(), which returns an existing suggestion per item rather
  // than making another. Adding a second throttle here is how you end up with duplicates or silence —
  // the same reason handleShopEvent has no dedup of its own on top of LowStockAlertService's.
  it('does not add its own de-duplication on top of the suggestion service', async () => {
    const drafter = { generateSuggestions: jest.fn(async () => [{ id: 's1' }]) };
    const action = new DraftReorderAction(drafter);

    await action.execute(ctx());
    await action.execute(ctx());

    expect(drafter.generateSuggestions).toHaveBeenCalledTimes(2);
  });
});
