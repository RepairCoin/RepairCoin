// The scheduler is an in-process setInterval(1h), not a cron — so a rule's whole schedule used to depend
// on a tick landing inside every single UTC hour.
//
// The failure: `scheduleHour !== currentHour` meant that if the backend was down for an entire hour (a
// crash loop, or a deploy that ran long), nothing observed that hour and every rule scheduled for it was
// skipped for the day. No error, no retry, no record of a run that didn't happen.
//
// The fix has two halves, and BOTH are load-bearing:
//   1. A rule stays due for CATCH_UP_HOURS past its slot, so a missed hour is picked up.
//   2. A rule-level "did it already run today" gate stops it repeating every tick after that.
// Without (2), (1) turns one daily run into an all-day drip — the per-customer dedup cannot stop it,
// because a rule capped at MAX_SENDS_PER_SHOP_PER_RUN leaves later customers with no send row at all.
//
// Exercised through the real private methods on a real instance, with an injected clock, so the arithmetic
// under test is the arithmetic that ships.

import { AutoMessageSchedulerService } from '../../src/services/AutoMessageSchedulerService';
import type { AutoMessage } from '../../src/repositories/AutoMessageRepository';

const svc: any = new AutoMessageSchedulerService();

const rule = (over: Partial<AutoMessage> = {}): AutoMessage =>
  ({
    id: 'r1',
    shopId: 'peanut',
    name: 'Morning promo',
    triggerType: 'schedule',
    scheduleType: 'daily',
    scheduleHour: 10,
    scheduleDayOfWeek: null,
    scheduleDayOfMonth: null,
    isActive: true,
    ...over,
  } as AutoMessage);

/** A UTC instant. Month is 0-based; 2026-08-03 is a Monday. */
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 7, day, hour, 15, 0));

describe('a daily rule catches up after a missed hour', () => {
  it('does not fire before its hour', () => {
    expect(svc.isDue(rule(), at(3, 9))).toBe(false);
  });

  it('fires in its own hour', () => {
    expect(svc.isDue(rule(), at(3, 10))).toBe(true);
  });

  // The whole point: hour 10 was never observed because the process was down.
  it('still fires an hour late', () => {
    expect(svc.isDue(rule(), at(3, 11))).toBe(true);
  });

  it('still fires at the edge of the catch-up window', () => {
    expect(svc.isDue(rule(), at(3, 13))).toBe(true);
  });

  // Lateness has a limit. An 8am promo delivered at 11pm is worse than not delivered, and the owner
  // cannot un-send it.
  it('gives up once past the window rather than sending absurdly late', () => {
    expect(svc.isDue(rule(), at(3, 14))).toBe(false);
    expect(svc.isDue(rule({ scheduleHour: 8 }), at(3, 23))).toBe(false);
  });

  // A run that didn't happen must leave a trace — silence was the actual defect.
  it('reports a rule that missed its window entirely', () => {
    expect(svc.missedItsWindow(rule(), at(3, 14))).toBe(true);
  });

  it('does not report a rule that is merely not due yet', () => {
    expect(svc.missedItsWindow(rule(), at(3, 9))).toBe(false);
  });

  it('does not report a rule still inside its window', () => {
    expect(svc.missedItsWindow(rule(), at(3, 12))).toBe(false);
  });
});

// Catch-up is same-day only. A weekly rule firing on the wrong weekday would be worse than a missed run:
// the owner picked Monday for a reason.
describe('weekly and monthly rules only catch up within the same day', () => {
  const weekly = rule({ scheduleType: 'weekly', scheduleDayOfWeek: 1, scheduleHour: 10 });

  it('catches up later on the right weekday', () => {
    expect(svc.isDue(weekly, at(3, 12))).toBe(true); // Monday
  });

  it('never fires on the wrong weekday, however late', () => {
    expect(svc.isDue(weekly, at(4, 11))).toBe(false); // Tuesday
    expect(svc.isDue(weekly, at(4, 10))).toBe(false);
  });

  const monthly = rule({ scheduleType: 'monthly', scheduleDayOfMonth: 3, scheduleHour: 10 });

  it('catches up later on the right day of the month', () => {
    expect(svc.isDue(monthly, at(3, 12))).toBe(true);
  });

  it('never fires on the wrong day of the month', () => {
    expect(svc.isDue(monthly, at(4, 11))).toBe(false);
  });
});

describe('rules with no usable schedule', () => {
  it('never fires an unknown schedule type', () => {
    expect(svc.isDue(rule({ scheduleType: 'fortnightly' as any }), at(3, 10))).toBe(false);
  });

  // scheduleHour has a DB default of 10 but is nullable in the type; treating null as 0 keeps a
  // misconfigured rule due from midnight rather than throwing on the arithmetic.
  it('treats a null hour as midnight rather than crashing', () => {
    expect(svc.isDue(rule({ scheduleHour: null as any }), at(3, 0))).toBe(true);
    expect(svc.isDue(rule({ scheduleHour: null as any }), at(3, 12))).toBe(false);
  });
});

// A midnight rule cannot be caught up across the date boundary: by the time a tick runs, the UTC day has
// changed and the day checks would no longer match. Pinned so the limitation is known, not discovered.
describe('known limitation — the window does not cross midnight', () => {
  it('an hour-23 rule is not caught up after midnight', () => {
    expect(svc.isDue(rule({ scheduleHour: 23 }), at(3, 23))).toBe(true);
    expect(svc.isDue(rule({ scheduleHour: 23 }), at(4, 0))).toBe(false);
  });
});
