// Workflow outcome metrics — the change request's "measurable, not just configurable".
//
// What these pin down is mostly about NOT overstating what we know. The change request asked for
// "Opened 82%" and "Revenue Generated $4,320"; one of those is not measurable as written and the other
// asserts causation an attribution window cannot show. See
// docs/tasks/strategy/custom-workflows/management-change-request.md (D2).

import { ATTRIBUTION_DAYS } from '../../src/domains/messaging/services/WorkflowMetricsService';

describe('attribution window', () => {
  it('is a single named constant, so the label and the data cannot disagree', () => {
    expect(ATTRIBUTION_DAYS).toBe(14);
  });
});

// A drip sequence sends the same customer several messages. Without DISTINCT on order_id, every step
// re-attributes the SAME order — inflating both the count and the revenue by the number of steps. This is
// the single most likely way these numbers would have been quietly wrong.
describe('attribution must not double-count an order across sends', () => {
  type Row = { ruleId: string; orderId: string; amount: number };

  /** Mirrors the query's `SELECT DISTINCT auto_message_id, order_id, amount`. */
  const attribute = (rows: Row[]) => {
    const seen = new Set<string>();
    const kept: Row[] = [];
    for (const r of rows) {
      const key = `${r.ruleId}::${r.orderId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(r);
    }
    return { booked: kept.length, revenue: kept.reduce((s, r) => s + r.amount, 0) };
  };

  it('counts one order once even when three sequence steps each matched it', () => {
    const rows: Row[] = [
      { ruleId: 'r1', orderId: 'o1', amount: 120 },
      { ruleId: 'r1', orderId: 'o1', amount: 120 },
      { ruleId: 'r1', orderId: 'o1', amount: 120 },
    ];
    expect(attribute(rows)).toEqual({ booked: 1, revenue: 120 });
  });

  it('still counts two genuinely different orders by the same customer', () => {
    const rows: Row[] = [
      { ruleId: 'r1', orderId: 'o1', amount: 30 },
      { ruleId: 'r1', orderId: 'o2', amount: 19 },
    ];
    expect(attribute(rows)).toEqual({ booked: 2, revenue: 49 });
  });

  // Two workflows can legitimately both claim the same order — they are separate rules with separate
  // cards, and neither is "the" cause. The dedup key is per rule for that reason.
  it('lets two different rules each attribute the same order', () => {
    const rows: Row[] = [
      { ruleId: 'r1', orderId: 'o1', amount: 50 },
      { ruleId: 'r2', orderId: 'o1', amount: 50 },
    ];
    expect(attribute(rows)).toEqual({ booked: 2, revenue: 100 });
  });
});

// A notify_staff rule records sends with customer_address = NULL (migration 252). Counting those as
// undelivered messages would show a real workflow sitting at 0% read forever.
describe('shop-scoped runs are not treated as unread messages', () => {
  const line = (m: { sent: number; delivered: number; read: number }) =>
    m.delivered === 0 ? `Ran ${m.sent} time${m.sent === 1 ? '' : 's'}` : `Read ${Math.round((m.read / m.delivered) * 100)}%`;

  it('reports "Ran N times" when nothing was addressed to a customer', () => {
    expect(line({ sent: 1, delivered: 0, read: 0 })).toBe('Ran 1 time');
    expect(line({ sent: 4, delivered: 0, read: 0 })).toBe('Ran 4 times');
  });

  it('reports a read rate only when messages were actually sent to customers', () => {
    expect(line({ sent: 8, delivered: 8, read: 4 })).toBe('Read 50%');
  });

  // The denominator is `delivered`, not `sent` — a workflow that mixes customer messages with a staff
  // alert step would otherwise be permanently penalised for the alert.
  it('divides by delivered, not sent, so a mixed workflow is not penalised', () => {
    expect(line({ sent: 10, delivered: 5, read: 5 })).toBe('Read 100%');
  });
});
