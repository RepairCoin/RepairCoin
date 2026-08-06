// `create_task` — the action that files a to-do item.
//
// What separates it from `notify_staff` is that the thing it produces OUTLIVES being read. So the
// assertions are about the row: that one gets written, that a recurring trigger cannot stack copies of
// it, and that closing one lets the next occurrence through. A test that only checked "the repository
// was called" would pass for an action that files a blank task every hour forever.

const mockDispatch = jest.fn(async () => undefined);
jest.mock('../../src/domains/notification/services/NotificationGateway', () => ({
  getNotificationGateway: () => ({ dispatch: mockDispatch }),
}));

let rows: any[] = [];
jest.mock('../../src/repositories/ShopTaskRepository', () => ({
  getShopTaskRepository: () => ({
    create: jest.fn(async (p: any) => {
      const t = { id: `task-${rows.length + 1}`, status: 'open', ...p };
      rows.push(t);
      return t;
    }),
    // Behaves like the real query rather than a constant: only OPEN tasks from the same rule about the
    // same subject count. With a broken dedup nothing lands here and it keeps answering false.
    hasOpenTaskFromRule: jest.fn(async (ruleId: string, subject: any) =>
      rows.some(
        (r) =>
          r.sourceRuleId === ruleId &&
          r.status === 'open' &&
          (r.customerAddress ?? null) === (subject.customerAddress ?? null)
      )
    ),
  }),
}));

import { CreateTaskAction } from '../../src/services/autoMessageActions/createTaskAction';
import { ACTION_NEEDS, SHOP_SCOPED_ACTIONS, NO_TEMPLATE_ACTIONS, AUTO_MESSAGE_ACTION_TYPES } from '../../src/services/autoMessageActions/registry';

const ctx = (over: any = {}) => ({
  rule: { id: 'rule-t1', name: 'Chase the supplier', shopId: 'peanut' },
  shopId: 'peanut',
  customerAddress: '',
  shopName: 'Peanut Repairs',
  actionType: 'create_task',
  actionPayload: { title: 'Call the customer back' },
  ...over,
}) as any;

describe('create_task files a task', () => {
  beforeEach(() => { rows = []; mockDispatch.mockClear(); });

  it('writes one open task with the configured title', async () => {
    const r = await new CreateTaskAction().execute(ctx());
    expect(r.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Call the customer back');
    expect(rows[0].source).toBe('workflow');
    expect(rows[0].sourceRuleId).toBe('rule-t1');
  });

  it('falls back to the workflow name rather than filing a blank task', async () => {
    // A task with no title is unreadable in a list, which is the only place it will ever be seen.
    await new CreateTaskAction().execute(ctx({ actionPayload: {} }));
    expect(rows[0].title).toBe('Chase the supplier');
  });

  it('prefers live trigger detail over nothing for the body', async () => {
    // "3 items below threshold" beats repeating what the owner typed when they built the workflow.
    await new CreateTaskAction().execute(ctx({ actionPayload: { title: 'Restock' }, triggerDetail: '3 items low' }));
    expect(rows[0].body).toBe('3 items low');
  });

  it('records no customer when the trigger had none', async () => {
    // The shop-scoped path passes '' for "nobody". Storing that verbatim would produce a task that
    // counts as attached to a customer whose address is the empty string.
    await new CreateTaskAction().execute(ctx());
    expect(rows[0].customerAddress).toBeNull();
  });

  it('attaches the customer when the trigger provided one — this is the "flag" case', async () => {
    await new CreateTaskAction().execute(ctx({ customerAddress: '0xabc' }));
    expect(rows[0].customerAddress).toBe('0xabc');
  });

  it('notifies, so the task is not only found by someone who opens the card', async () => {
    await new CreateTaskAction().execute(ctx());
    expect(mockDispatch).toHaveBeenCalledWith('workflow_task_created', 'peanut', expect.anything());
  });

  it('keeps the task when the notification fails', async () => {
    // The task is the deliverable and it already exists. Failing here would make the scheduler retry
    // and file a duplicate — trading a missed notification for a corrupted list.
    mockDispatch.mockRejectedValueOnce(new Error('push down') as never);
    const r = await new CreateTaskAction().execute(ctx());
    expect(r.ok).toBe(true);
    expect(rows).toHaveLength(1);
  });
});

describe('a recurring trigger cannot stack copies', () => {
  beforeEach(() => { rows = []; mockDispatch.mockClear(); });

  it('does not file a second task while the first is still open', async () => {
    await new CreateTaskAction().execute(ctx());
    await new CreateTaskAction().execute(ctx());
    expect(rows).toHaveLength(1);
  });

  it('DOES file again once the first is closed', async () => {
    // The dedup is scoped to open tasks deliberately. A monthly "chase the supplier" that could only
    // ever be created once would be useless after the first month.
    await new CreateTaskAction().execute(ctx());
    rows[0].status = 'done';
    await new CreateTaskAction().execute(ctx());
    expect(rows).toHaveLength(2);
  });

  it('files separately for different customers', async () => {
    // Without this the first customer's task would suppress everyone else's, and the workflow would
    // look like it was working.
    await new CreateTaskAction().execute(ctx({ customerAddress: '0xabc' }));
    await new CreateTaskAction().execute(ctx({ customerAddress: '0xdef' }));
    expect(rows).toHaveLength(2);
  });
});

describe('it is registered as shop-scoped', () => {
  it('is a known action type', () => {
    expect(AUTO_MESSAGE_ACTION_TYPES).toContain('create_task');
  });

  it('needs nobody, so any trigger can drive it', () => {
    expect(ACTION_NEEDS.create_task).toBe('nobody');
  });

  it('fires ONCE per run, not once per customer in the audience', () => {
    // The task belongs to the shop. Fanning out across a 200-person audience would bury them under
    // identical tasks and turn Target Audience into a multiplier — the bug notify_staff already had.
    expect(SHOP_SCOPED_ACTIONS.has('create_task')).toBe(true);
  });

  it('carries no message template', () => {
    expect(NO_TEMPLATE_ACTIONS.has('create_task')).toBe(true);
  });
});
