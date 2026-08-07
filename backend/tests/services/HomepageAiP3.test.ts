// P3 — the model answering homepage questions, and the two guards that make that safe.
//
// The grounding guard and the spend ceiling are the only reasons a public, unauthenticated model call
// is acceptable at all, so they get tested harder than the happy path. Everything else on this surface
// fails open; these two fail closed, deliberately.

let mockRows: any[] = [{ today: 0, month: 0 }];
let queryShouldThrow: Error | null = null;
jest.mock('../../src/utils/database-pool', () => ({
  getSharedPool: () => ({
    query: jest.fn(async () => {
      if (queryShouldThrow) throw queryShouldThrow;
      return { rows: mockRows };
    }),
  }),
}));

import { violatesGrounding } from '../../src/domains/AIAgentDomain/services/HomepageAiAnswerer';
import {
  HomepageAiSpendGuard,
  MONTHLY_CAP_USD,
  DAILY_CAP_USD,
} from '../../src/domains/AIAgentDomain/services/HomepageAiSpendGuard';

const CORPUS = `
Starter AI $80. Growth AI $299. Business AI $599. Every paid plan starts with a 14-day free trial.
Card payments run through Stripe and land in your own Stripe account.
`;

describe('the grounding guard — what the model is not allowed to say', () => {
  it('allows a price that is in the corpus', () => {
    expect(violatesGrounding('Growth AI is $299 a month.', CORPUS)).toBeNull();
  });

  it('blocks a price that is NOT in the corpus', () => {
    // The expensive failure mode. A hallucinated price on a public page is a sales and legal problem,
    // not an accuracy one — someone will hold us to it.
    expect(violatesGrounding('It starts at $49 a month.', CORPUS)).toMatch(/invented figure/);
    expect(violatesGrounding('Plans go up to $1,200.', CORPUS)).toMatch(/invented figure/);
  });

  it('blocks an invented percentage', () => {
    // "Shops see 30% more bookings" is the kind of claim that reads as a guarantee.
    expect(violatesGrounding('Shops see 30% more repeat customers.', CORPUS)).toMatch(/invented percentage/);
  });

  it('blocks forward commitments — the assistant does not speak for the roadmap', () => {
    for (const claim of [
      'We can build that for you.',
      'We will integrate with your POS.',
      "That's coming soon.",
      'It is in the roadmap.',
    ]) {
      expect(violatesGrounding(claim, CORPUS)).toBe('forward commitment');
    }
  });

  it('does not block ordinary sentences', () => {
    // A guard that fires on normal copy would discard every good answer and quietly turn P3 back into
    // P1 — passing tests, no model, and nobody any the wiser.
    for (const fine of [
      'FixFlow takes bookings and keeps your customer list up to date.',
      'Mondays are quiet for a lot of shops — a win-back campaign is the usual fix.',
      'Rewards give a regular a reason to come back to you.',
      'You can take payment when they book, or in person on the day.',
    ]) {
      expect(violatesGrounding(fine, CORPUS)).toBeNull();
    }
  });

  it('catches a price hidden in the next step, not just the answer', () => {
    // The route checks answer + nextStep together, because the CTA is where a price is most tempting.
    expect(violatesGrounding('Sounds good. Try it for $19.', CORPUS)).toMatch(/invented figure/);
  });
});

describe('the spend ceiling — the guard with no equivalent elsewhere', () => {
  const guard = new HomepageAiSpendGuard();

  beforeEach(() => {
    mockRows = [{ today: 0, month: 0 }];
    queryShouldThrow = null;
  });

  it('allows the model when well under both caps', async () => {
    mockRows = [{ today: 0.4, month: 6 }];
    await expect(guard.check()).resolves.toMatchObject({ allowed: true });
  });

  it('stops at the DAILY cap even with monthly headroom', async () => {
    // The important one. A monthly-only ceiling can be drained in an hour, and then the homepage is
    // dark for twenty-nine days — worse than the attack it was meant to stop.
    mockRows = [{ today: DAILY_CAP_USD, month: 3 }];
    await expect(guard.check()).resolves.toMatchObject({ allowed: false, reason: 'daily' });
  });

  it('stops at the MONTHLY cap even on a quiet day', async () => {
    mockRows = [{ today: 0.1, month: MONTHLY_CAP_USD }];
    await expect(guard.check()).resolves.toMatchObject({ allowed: false, reason: 'monthly' });
  });

  it('FAILS CLOSED when the ledger cannot be read', async () => {
    // Everywhere else on this surface fails open, because being wrong costs a worse answer. Here being
    // wrong costs an unbounded bill with no shop to attribute it to.
    queryShouldThrow = new Error('connection terminated');
    await expect(guard.check()).resolves.toMatchObject({ allowed: false });
  });

  it('uses the agreed caps', () => {
    expect(MONTHLY_CAP_USD).toBe(25);
    expect(DAILY_CAP_USD).toBe(2);
  });
});
