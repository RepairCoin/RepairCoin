// backend/src/domains/messaging/services/WorkflowMetricsService.ts
//
// Per-workflow outcome metrics — "now the workflow becomes measurable, not just configurable".
//
// WHAT THE CHANGE REQUEST ASKED FOR vs WHAT IS TRUE:
//   Sent 423             -> a fact. auto_message_sends.
//   Opened 82%           -> NOT MEASURABLE AS ASKED. Workflows write in-app conversation messages, not
//                           email; there is no open pixel. But messages.is_read/read_at exist and
//                           auto_message_sends.message_id links to them, so we report READ — an actual
//                           receipt, and a stronger signal than an email open estimate. Renamed, not faked.
//   Booked 57            -> ATTRIBUTED, not caused. An order by that customer within ATTRIBUTION_DAYS.
//   Revenue Generated    -> same attribution. Deliberately NOT called "generated": a shop that ran a
//                           win-back and had a good month will read the figure as caused, and we cannot
//                           defend that. The window is named in the label and the rule is shown in the UI.
//
// The risk here was never feasibility, it was labelling. See
// docs/tasks/strategy/custom-workflows/management-change-request.md (D2).

import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

/**
 * How long after a workflow message an order still counts as attributed.
 *
 * The shortest window that covers a normal "I'll book it next payday" delay without sweeping in a
 * customer's ordinary next visit. It is a product judgement, not a discovered constant — which is exactly
 * why it lives in one named place and is stated on screen.
 */
export const ATTRIBUTION_DAYS = 14;

/**
 * Orders that do NOT count as the customer having booked.
 *
 * Only a cancellation retracts the booking. An order the customer later missed (`no_show`) or let lapse
 * (`expired`) still means the message produced a booking, which is what this metric claims.
 */
export const NON_BOOKING_STATUSES = ['cancelled'];

/**
 * Orders where money was actually taken. Deliberately an ALLOW-list, not a deny-list.
 *
 * `booked` and `revenue` used to share one filter — `status <> 'cancelled'` — so every `expired` and
 * `no_show` order was summed into revenue. On staging that was 242 expired ($38.1k) and 37 no-show
 * ($3.4k) against 275 completed ($49.5k): roughly 45% of any revenue figure was orders that never
 * happened. dc_shopu's headline "$49" was $5 completed plus a $44 expired order.
 *
 * The two metrics answer different questions, so they get different filters. An allow-list also fails
 * SAFE: a status added to the schema later is excluded until someone decides it represents money,
 * whereas a deny-list would silently start counting it.
 */
export const REVENUE_STATUSES = ['completed', 'paid'];

export interface WorkflowMetrics {
  /** Sends recorded for this rule. For a shop-scoped rule (notify_staff) this is "times it ran". */
  sent: number;
  /** Sends addressed to a customer — the denominator for `read`. Excludes shop-scoped runs. */
  delivered: number;
  /** Customer messages actually opened in-app. */
  read: number;
  /** DISTINCT non-cancelled orders attributed within the window — did the message produce a booking? */
  booked: number;
  /**
   * Money actually taken on those orders (`REVENUE_STATUSES` only).
   *
   * So `revenue` can be lower than `booked` implies, and that gap is meaningful rather than a bug:
   * "Booked 2 · $5" means two bookings followed the message and one of them never paid.
   */
  revenue: number;
}

export class WorkflowMetricsService {
  /** Metrics for every rule belonging to a shop, keyed by rule id. One round trip. */
  async forShop(shopId: string): Promise<Record<string, WorkflowMetrics>> {
    const out: Record<string, WorkflowMetrics> = {};

    try {
      const result = await getSharedPool().query(
        `
        WITH sends AS (
          SELECT auto_message_id, LOWER(customer_address) AS addr, sent_at, message_id
          FROM auto_message_sends
          WHERE shop_id = $1 AND status = 'sent'
        ),
        -- DISTINCT is load-bearing: a drip sequence sends the same customer several messages, and every
        -- one of them would otherwise attribute the SAME order again — inflating both the count and the
        -- revenue by the number of steps.
        attributed AS (
          SELECT DISTINCT s.auto_message_id,
                          o.order_id,
                          o.status,
                          COALESCE(o.final_amount_usd, o.total_amount, 0) AS amount
          FROM sends s
          JOIN service_orders o
            ON o.shop_id = $1
           AND LOWER(o.customer_address) = s.addr
           AND o.created_at >  s.sent_at
           AND o.created_at <= s.sent_at + INTERVAL '${ATTRIBUTION_DAYS} days'
           AND o.status <> ALL($2::text[])
          WHERE s.addr IS NOT NULL
        )
        SELECT
          s.auto_message_id                                        AS rule_id,
          COUNT(*)                                                 AS sent,
          COUNT(*) FILTER (WHERE s.addr IS NOT NULL)               AS delivered,
          COUNT(*) FILTER (WHERE m.is_read)                        AS read,
          -- Two questions, two filters. 'Did the message produce a booking?' counts every order the
          -- customer did not cancel; 'how much money came in?' counts only orders that were paid.
          COALESCE((SELECT COUNT(*)      FROM attributed a
                     WHERE a.auto_message_id = s.auto_message_id), 0) AS booked,
          COALESCE((SELECT SUM(a.amount) FROM attributed a
                     WHERE a.auto_message_id = s.auto_message_id
                       AND a.status = ANY($3::text[])), 0)            AS revenue
        FROM sends s
        LEFT JOIN messages m ON m.message_id = s.message_id
        GROUP BY s.auto_message_id
        `,
        [shopId, NON_BOOKING_STATUSES, REVENUE_STATUSES]
      );

      for (const row of result.rows) {
        out[row.rule_id] = {
          sent: Number(row.sent) || 0,
          delivered: Number(row.delivered) || 0,
          read: Number(row.read) || 0,
          booked: Number(row.booked) || 0,
          revenue: Number(row.revenue) || 0,
        };
      }
    } catch (err) {
      // Metrics decorate the list; they must never stop it loading.
      logger.error('WorkflowMetricsService.forShop failed', {
        shopId,
        error: (err as Error)?.message,
      });
    }

    return out;
  }
}

export const workflowMetricsService = new WorkflowMetricsService();
