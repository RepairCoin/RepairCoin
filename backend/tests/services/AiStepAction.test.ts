// Custom Workflows §9.2 item 4 — the `ai_step` action.
//
// The property that matters most is not "it calls the model", it is HOW OFTEN. The engine runs an
// action once per customer in the target audience, so generating per customer would be one Claude call
// per recipient per run — up to MAX_SENDS_PER_SHOP_PER_RUN (50) a tick, ~1,500 a month for a daily
// rule, against a $10 monthly AI allowance on Growth. The body is therefore generated once per rule
// per run and reused, with {{variables}} carrying the per-customer parts.

import {
  AiStepAction,
  parseAiStepPayload,
  type AiStepGenerator,
} from '../../src/services/autoMessageActions/aiStepAction';
import {
  AUTO_MESSAGE_ACTION_TYPES,
  NO_TEMPLATE_ACTIONS,
  SHOP_SCOPED_ACTIONS,
} from '../../src/services/autoMessageActions/registry';

const ctx = (over: Record<string, unknown> = {}) =>
  ({
    rule: {
      id: 'rule-1',
      name: 'Win back',
      triggerType: 'event',
      eventType: 'inactive_30_days',
      scheduleType: null,
      targetAudience: 'inactive_30d',
    },
    shopId: 'peanut',
    customerAddress: '0xabc',
    customerName: 'Ada',
    shopName: 'Peanut Repairs',
    actionType: 'ai_step',
    actionPayload: {},
    ...over,
  }) as any;

const makeSend = () => {
  const sent: string[] = [];
  return {
    sent,
    action: { execute: jest.fn(async (c: any) => { sent.push(c.messageText); return { ok: true }; }) } as any,
  };
};

const makeGen = (text = 'Hi {{customerName}}, we miss you at {{shopName}}!'): AiStepGenerator & { calls: number } => {
  const g: any = {
    calls: 0,
    generate: jest.fn(async () => {
      g.calls += 1;
      return { messageTemplate: text };
    }),
  };
  return g;
};

describe('ai_step registration', () => {
  it('is offered as an action', () => {
    expect(AUTO_MESSAGE_ACTION_TYPES).toContain('ai_step');
  });

  // It writes the body at run time, so there is no stored template for the engine to resolve.
  it('carries no message template', () => {
    expect(NO_TEMPLATE_ACTIONS.has('ai_step')).toBe(true);
  });

  // The distinction the renamed set exists to protect: no template, but very much a customer message.
  it('is NOT shop-scoped — it messages the customer', () => {
    expect(SHOP_SCOPED_ACTIONS.has('ai_step')).toBe(false);
  });
});

describe('brief parsing', () => {
  it('keeps a brief and trims it', () => {
    expect(parseAiStepPayload({ prompt: '  be warm  ' })).toEqual({ prompt: 'be warm' });
  });

  it('treats blank as absent — the generator still has trigger and audience to work from', () => {
    expect(parseAiStepPayload({ prompt: '   ' })).toEqual({});
    expect(parseAiStepPayload(null)).toEqual({});
  });

  it('caps a runaway brief', () => {
    expect(parseAiStepPayload({ prompt: 'x'.repeat(900) }).prompt).toHaveLength(500);
  });
});

describe('generation cost', () => {
  it('generates ONCE for a whole run, not once per customer', async () => {
    const gen = makeGen();
    const { action: send, sent } = makeSend();
    const ai = new AiStepAction(send, gen);

    for (const name of ['Ada', 'Grace', 'Alan']) {
      await ai.execute(ctx({ customerName: name }));
    }

    expect(gen.calls).toBe(1);
    expect(sent).toHaveLength(3);
  });

  // The whole point of reusing one body: per-customer detail still has to land.
  it('still personalises each send through {{variables}}', async () => {
    const gen = makeGen();
    const { action: send, sent } = makeSend();
    const ai = new AiStepAction(send, gen);

    await ai.execute(ctx({ customerName: 'Ada' }));
    await ai.execute(ctx({ customerName: 'Grace' }));

    expect(sent[0]).toContain('Ada');
    expect(sent[1]).toContain('Grace');
    expect(sent[0]).toContain('Peanut Repairs');
    expect(sent[0]).not.toContain('{{');
  });

  // An ordinary event trigger is handed ONE customer (handleEventTrigger takes a single
  // customerAddress), so per-customer generation costs one call per event either way. Pooling there
  // would save nothing and hand the second customer a message written about somebody else's booking.
  it('generates fresh for each customer on a one-customer event trigger', async () => {
    const gen = makeGen();
    const { action: send, sent } = makeSend();
    const ai = new AiStepAction(send, gen);

    const bookingCompleted = { ...ctx().rule, eventType: 'booking_completed' };
    await ai.execute(ctx({ rule: bookingCompleted, customerName: 'Ada' }));
    await ai.execute(ctx({ rule: bookingCompleted, customerName: 'Grace' }));

    expect(gen.calls).toBe(2);
    expect(sent).toHaveLength(2);
  });

  // The protection has to survive on the paths that actually fan out.
  it('still pools for a scheduled rule, which resolves a whole audience', async () => {
    const gen = makeGen();
    const { action: send } = makeSend();
    const ai = new AiStepAction(send, gen);

    const scheduled = { ...ctx().rule, triggerType: 'schedule', eventType: null };
    await ai.execute(ctx({ rule: scheduled, customerName: 'Ada' }));
    await ai.execute(ctx({ rule: scheduled, customerName: 'Grace' }));

    expect(gen.calls).toBe(1);
  });

  it('generates separately for a different rule', async () => {
    const gen = makeGen();
    const { action: send } = makeSend();
    const ai = new AiStepAction(send, gen);

    await ai.execute(ctx());
    await ai.execute(ctx({ rule: { ...ctx().rule, id: 'rule-2' } }));

    expect(gen.calls).toBe(2);
  });
});

// An automated message is the one place a model's invention reaches a customer with nobody reading it
// first. The risk is not an imperfect sentence — it is a claim the shop is then bound by.
describe('what it refuses to send', () => {
  const send = async (text: string, brief?: string) => {
    const gen = makeGen(text);
    const { action, sent } = makeSend();
    const res = await new AiStepAction(action, gen).execute(
      ctx({ actionPayload: brief ? { prompt: brief } : {} })
    );
    return { res, sent };
  };

  it('refuses a discount the owner never asked for', async () => {
    const { res, sent } = await send('Hi {{customerName}}, come back for 20% off your next service!');
    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('refuses an invented price', async () => {
    const { res, sent } = await send('Hi {{customerName}}, brake checks are just $29 this month.');
    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  // If the owner asked for it, the model is doing as it was told.
  it('allows an offer the brief actually asked for', async () => {
    const { res, sent } = await send(
      'Hi {{customerName}}, here is 20% off your next visit at {{shopName}}.',
      'offer them 20% off'
    );
    expect(res.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  // "feel free to call" is ordinary friendly copy. A guard that fired on it would silence workflows,
  // which is the worse failure — so the offer rules are deliberately narrow.
  it('does not trip over ordinary friendly wording', async () => {
    const { res, sent } = await send(
      'Hi {{customerName}}, feel free to call {{shopName}} any time — happy to help.'
    );
    expect(res.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  // The generator is told it MAY use five variables; this action can only fill two. Braces reaching a
  // customer are worse than no message.
  it('refuses a message with a placeholder it cannot fill', async () => {
    const { res, sent } = await send('Hi {{customerName}}, you have {{rcnBalance}} RCN waiting.');
    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('refuses an external link', async () => {
    const { res, sent } = await send('Hi {{customerName}}, see https://not-our-domain.test/offer');
    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('refuses a fragment too short to be a message', async () => {
    const { res, sent } = await send('Hi!');
    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe('failure handling', () => {
  // Expected once a shop exhausts its monthly allowance: SpendCapEnforcer refuses rather than
  // overspending. Sending nothing is right; sending something the shop never wrote would be worse.
  it('sends nothing when generation fails', async () => {
    const gen: any = { generate: jest.fn(async () => { throw new Error('spend cap reached'); }) };
    const { action: send, sent } = makeSend();

    const res = await new AiStepAction(send, gen).execute(ctx());

    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('sends nothing when the model returns an empty body', async () => {
    const gen = makeGen('   ');
    const { action: send, sent } = makeSend();

    const res = await new AiStepAction(send, gen).execute(ctx());

    expect(res.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  // A failure must not be cached as if it were a body, or the rule stays silent for the rest of the run.
  it('retries generation after a failure rather than memoizing it', async () => {
    let fail = true;
    const gen: any = {
      calls: 0,
      generate: jest.fn(async () => {
        gen.calls += 1;
        if (fail) throw new Error('transient');
        // A realistic body: anything shorter than MIN_BODY is now refused as a fragment.
        return { messageTemplate: 'Hello, hope everything is running smoothly since your visit.' };
      }),
    };
    const { action: send, sent } = makeSend();
    const ai = new AiStepAction(send, gen);

    await ai.execute(ctx());
    fail = false;
    await ai.execute(ctx());

    expect(gen.calls).toBe(2);
    expect(sent).toEqual(['Hello, hope everything is running smoothly since your visit.']);
  });
});
