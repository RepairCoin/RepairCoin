import { describe, it, expect } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { warrantyExpiry, warrantyLabel, daysRemaining } from '../../src/utils/warranty';

const COMPLETED = '2026-08-06T10:00:00.000Z';

describe('warrantyExpiry', () => {
  it('runs the clock from delivery, not from the sale', () => {
    expect(warrantyExpiry(COMPLETED, 90)?.toISOString()).toBe('2026-11-04T10:00:00.000Z');
  });

  it('treats no term, zero and negative as the same absence of cover', () => {
    expect(warrantyExpiry(COMPLETED, null)).toBeNull();
    expect(warrantyExpiry(COMPLETED, 0)).toBeNull();
    expect(warrantyExpiry(COMPLETED, -30)).toBeNull();
  });

  it('has no expiry for work that was never completed', () => {
    // An open sale has no completed_at, and cover cannot start before the work is delivered.
    expect(warrantyExpiry(null, 90)).toBeNull();
    expect(warrantyExpiry(undefined, 90)).toBeNull();
  });

  it('refuses to invent an expiry from an unparseable date', () => {
    expect(warrantyExpiry('not a date', 90)).toBeNull();
  });
});

describe('daysRemaining', () => {
  const now = new Date('2026-08-06T10:00:00.000Z');

  it('rounds up, so the last day of cover still reads as a day', () => {
    // 6 hours left is not "0 days left" — the customer is covered until it actually lapses.
    expect(daysRemaining('2026-08-06T16:00:00.000Z', now)).toBe(1);
  });

  it('counts a whole term exactly', () => {
    expect(daysRemaining('2026-11-04T10:00:00.000Z', now)).toBe(90);
  });

  it('floors at zero rather than reporting negative days', () => {
    expect(daysRemaining('2026-07-01T10:00:00.000Z', now)).toBe(0);
  });
});

describe('warrantyLabel', () => {
  it('states the term and the date cover ends', () => {
    expect(warrantyLabel(COMPLETED, 90)).toBe('90-day warranty — covered to Nov 4, 2026');
  });

  it('says nothing at all when nothing was promised', () => {
    // Not "0-day warranty" — an uncovered line should print no warranty row, and a caller that
    // renders whatever it gets would otherwise announce a broken promise.
    expect(warrantyLabel(COMPLETED, 0)).toBeNull();
    expect(warrantyLabel(COMPLETED, null)).toBeNull();
    expect(warrantyLabel(null, 90)).toBeNull();
  });
});
