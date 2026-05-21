// backend/src/domains/AIAgentDomain/services/insights/tools/timeOfDayPattern.ts
//
// Tool: time_of_day_pattern
//
// Answers questions like:
//   - "When are my busy hours?"
//   - "What time of day do customers book?"
//   - "Should I be open later?"
//
// Hourly booking-creation histogram (00:00–23:00) for the shop within
// the window. Counts ALL statuses — customers picking a booking time
// matters even if the booking later cancels. Display: sparkline of 24
// data points (one per hour). First v1 use of the sparkline display.
//
// Operational gold: shop owners pick coverage hours from this. If
// Sunday 7pm has 5x the booking rate of Monday 9am, the owner can
// shift staffing.

import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";
import {
  RangeKey,
  RANGE_ENUM,
  RANGE_LABEL,
  windowBoundsFor,
} from "../ranges";

const NAME = "time_of_day_pattern";

interface ParsedArgs {
  range: RangeKey;
}

export const timeOfDayPattern: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up this shop's hourly booking pattern (24-hour histogram) " +
    "within a time window. Returns 24 buckets — one per hour-of-day. " +
    "Use this when the user asks about busy hours, peak times, when " +
    "customers book, or shop coverage hours.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: [...RANGE_ENUM],
        description:
          "Time window. Rolling ('7d'/'30d'/'90d'/'all') or calendar " +
          "('this_week'/'this_month'/'last_week'/'last_month'/" +
          "'this_quarter').",
      },
    },
    required: ["range"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const bounds = windowBoundsFor(parsed.range);

    // EXTRACT(HOUR FROM booking_date) — falls back to created_at when
    // booking_date is null (legacy rows or older booking flows). Counts
    // ALL statuses — intent-to-book signal, not just completed.
    //
    // booking_date is the customer-picked slot time. created_at is when
    // they hit "book". For "when do customers book?" the relevant one
    // is booking_date — the time they're committing to.
    const conds: string[] = [`shop_id = $1`];
    const params: unknown[] = [ctx.shopId];
    if (bounds.from) {
      params.push(bounds.from);
      conds.push(`created_at >= $${params.length}`);
    }
    if (bounds.to) {
      params.push(bounds.to);
      conds.push(`created_at < $${params.length}`);
    }

    // COALESCE(booking_date, created_at) handles the NULL booking_date
     // case implicitly — no extra null-check WHERE clause needed.
    const res = await ctx.pool.query<{ hour: string; n: string }>(
      `SELECT EXTRACT(HOUR FROM COALESCE(booking_date, created_at))::text AS hour,
              COUNT(*)::text AS n
       FROM service_orders
       WHERE ${conds.join(" AND ")}
       GROUP BY EXTRACT(HOUR FROM COALESCE(booking_date, created_at))
       ORDER BY EXTRACT(HOUR FROM COALESCE(booking_date, created_at))`,
      params
    );

    // Fill the 24-bucket array — every hour appears even when zero.
    const counts: number[] = new Array(24).fill(0);
    for (const row of res.rows) {
      const h = Number(row.hour);
      if (Number.isInteger(h) && h >= 0 && h < 24) {
        counts[h] = Number(row.n);
      }
    }

    const total = counts.reduce((a, b) => a + b, 0);
    // Peak hour for the prose summary. Tie-break by earliest hour.
    let peakHour = 0;
    let peakCount = counts[0];
    for (let h = 1; h < 24; h++) {
      if (counts[h] > peakCount) {
        peakHour = h;
        peakCount = counts[h];
      }
    }

    const display: ToolDisplay = {
      kind: "sparkline",
      label: `Bookings by hour (${RANGE_LABEL[parsed.range]})`,
      series: counts,
      primary:
        total === 0
          ? "no bookings"
          : `peak ${formatHour(peakHour)} (${peakCount})`,
    };

    return {
      data: {
        range: parsed.range,
        total,
        peakHour,
        peakCount,
        // Full 24-bucket array — Claude can mention specific hours
        // in its prose ("8am has the most bookings, 2am has zero").
        countsByHour: counts,
      },
      display,
    };
  },
};

function parseArgs(args: unknown): ParsedArgs {
  if (!args || typeof args !== "object") {
    throw new Error(`${NAME}: args must be an object`);
  }
  const a = args as Record<string, unknown>;
  const range = a.range as RangeKey;
  if (!(range in RANGE_LABEL)) {
    throw new Error(`${NAME}: invalid range '${String(a.range)}'`);
  }
  return { range };
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}
