// backend/src/domains/messaging/services/WorkflowRelevanceService.ts
//
// Per-shop numbers behind the template gallery's "this applies to you" line.
//
// WHY THIS EXISTS INSTEAD OF STATIC COPY. The change request asked for "Typically increases repeat
// bookings by 12–18%" under each template. We have never measured that: outcome attribution did not exist
// when the request was written, so the percentage would have been invented and then quoted back at us.
// A shop's OWN number is both honest and more persuasive — "you have 18 lapsed customers" beats
// "this typically works" — and it is computable from data we already hold.
//
// INTEGRITY RULE (inherited from the recommendations feed's `evidence` contract): a card may only state a
// number something actually computed. Anything absent here renders NO line rather than a zero or a guess.
// `payment-recovery` is the deliberate proof of that: service_orders has no payment_status column, so
// failed payments are not countable, so that template gets no relevance line.
//
// Everything is one round trip. This runs on gallery open, which is a UI path, not a tick.

import { getSharedPool } from '../../../utils/database-pool';
import { customerRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

/** Days without a booking before a customer counts as lapsed. Matches lapsedCustomersDetector. */
const LAPSED_DAYS = 90;

/**
 * Counts keyed by metric, NOT by template id — several templates read the same number, and the phrasing
 * belongs with the template copy on the frontend. Any key may be absent when it could not be computed.
 */
export interface WorkflowRelevance {
  lapsedCustomers?: number;
  completedOrders30d?: number;
  cancellations30d?: number;
  noShows30d?: number;
  firstVisits30d?: number;
  lowRatings30d?: number;
  goodRatings30d?: number;
  lowStockItems?: number;
  /** Slow-week signal. Present only when there is enough history to compare against. */
  bookingsLast7?: number;
  bookingsWeeklyAvg?: number;
}

export class WorkflowRelevanceService {
  async forShop(shopId: string): Promise<WorkflowRelevance> {
    const out: WorkflowRelevance = {};

    // Lapsed goes through the domain resolver, never a fresh query: findLapsedBookers is the CORRECTED
    // definition (sourced from service_orders, not transactions — an order-only customer is invisible to
    // the transactions-based version). Reusing it also guarantees this number matches what the workflow
    // will actually target. A card claiming 18 that enrols a different 18 is its own kind of lie.
    try {
      const lapsed = await customerRepository.findLapsedBookers(shopId, LAPSED_DAYS);
      out.lapsedCustomers = lapsed.length;
    } catch (err) {
      logger.warn('template relevance: lapsed lookup failed', { shopId, error: (err as Error)?.message });
    }

    const pool = getSharedPool();

    try {
      const r = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '30 days') AS completed_30d,
          COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= NOW() - INTERVAL '30 days') AS cancelled_30d,
          COUNT(*) FILTER (WHERE status = 'no_show'   AND created_at >= NOW() - INTERVAL '30 days') AS no_show_30d,
          -- Trailing comparison for the slow-week template: the last 7 days against the 28 days before
          -- them. Same windows as AutoMessageSchedulerService.processLowBookings, so the card and the
          -- trigger agree about what "slow" means.
          COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at >= NOW() - INTERVAL '7 days')  AS last7,
          COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at >= NOW() - INTERVAL '35 days'
                                                       AND created_at <  NOW() - INTERVAL '7 days')  AS prior28
        FROM service_orders
        WHERE shop_id = $1
        `,
        [shopId]
      );
      const row = r.rows[0] || {};
      out.completedOrders30d = Number(row.completed_30d) || 0;
      out.cancellations30d = Number(row.cancelled_30d) || 0;
      out.noShows30d = Number(row.no_show_30d) || 0;

      // Only offer the slow-week comparison when there is enough history for the average to mean
      // anything. Below that the card would be doing arithmetic on noise.
      const prior28 = Number(row.prior28) || 0;
      if (prior28 >= 4) {
        out.bookingsLast7 = Number(row.last7) || 0;
        out.bookingsWeeklyAvg = prior28 / 4;
      }
    } catch (err) {
      logger.warn('template relevance: order counts failed', { shopId, error: (err as Error)?.message });
    }

    // First-time customers: whoever's FIRST order at this shop landed in the last 30 days. Deliberately
    // not "orders by new customers" — the welcome workflow fires once per person, not once per order.
    try {
      const r = await pool.query(
        `
        SELECT COUNT(*) AS n FROM (
          SELECT LOWER(customer_address) AS addr, MIN(created_at) AS first_order
          FROM service_orders
          WHERE shop_id = $1
          GROUP BY LOWER(customer_address)
        ) f
        WHERE f.first_order >= NOW() - INTERVAL '30 days'
        `,
        [shopId]
      );
      out.firstVisits30d = Number(r.rows[0]?.n) || 0;
    } catch (err) {
      logger.warn('template relevance: first visits failed', { shopId, error: (err as Error)?.message });
    }

    // Review thresholds match the trigger definitions: LOW_RATING_THRESHOLD = 2 (1–2 is unhappy, 3 is
    // mixed), so "good" starts at 4 and 3 belongs to neither card.
    try {
      const r = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE rating <= 2) AS low,
          COUNT(*) FILTER (WHERE rating >= 4) AS good
        FROM service_reviews
        WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        `,
        [shopId]
      );
      out.lowRatings30d = Number(r.rows[0]?.low) || 0;
      out.goodRatings30d = Number(r.rows[0]?.good) || 0;
    } catch (err) {
      logger.warn('template relevance: review counts failed', { shopId, error: (err as Error)?.message });
    }

    // Same predicate LowStockAlertService uses to decide what to alert about, so the card cannot promise
    // a trigger that would not fire.
    try {
      const r = await pool.query(
        `
        SELECT COUNT(*) AS n FROM inventory_items
        WHERE shop_id = $1
          AND deleted_at IS NULL
          AND status IN ('low_stock', 'out_of_stock')
          AND (stock_quantity <= low_stock_threshold OR stock_quantity = 0)
        `,
        [shopId]
      );
      out.lowStockItems = Number(r.rows[0]?.n) || 0;
    } catch (err) {
      logger.warn('template relevance: low stock count failed', { shopId, error: (err as Error)?.message });
    }

    return out;
  }
}

export const workflowRelevanceService = new WorkflowRelevanceService();
