// backend/src/domains/AIAgentDomain/services/insights/tools/repeatCustomerAnalysis.ts
//
// Tool: repeat_customer_analysis
//
// Answers questions like:
//   - "How many of my customers are returning?"
//   - "What's my repeat-customer rate?"
//   - "How loyal are my customers?"
//
// Counts customers who paid+completed N bookings in the window;
// classifies them as "new" (n=1) or "repeat" (n≥2). Display: number
// (% repeat) + supporting counts in data.
//
// `data` also includes `avgRepeatOrders` so Claude can phrase
// strength of loyalty ("returning customers average 3.4 bookings each").

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

const NAME = "repeat_customer_analysis";

interface ParsedArgs {
  range: RangeKey;
}

export const repeatCustomerAnalysis: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up this shop's repeat-customer rate within a time window. " +
    "Returns the count of new (1-booking) vs repeat (2+-booking) " +
    "customers + the % repeat. Use this when the user asks about " +
    "returning customers, repeat rate, customer loyalty, or new vs " +
    "existing customer mix.",
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

    // CTE: count paid+completed orders per customer in the window.
    // Outer: roll up into new (n=1) / repeat (n≥2) buckets +
    // avg-orders-per-repeat-customer so the prose can describe
    // depth of loyalty.
    const conds: string[] = [
      `shop_id = $1`,
      `status IN ('paid', 'completed')`,
    ];
    const params: unknown[] = [ctx.shopId];
    if (bounds.from) {
      params.push(bounds.from);
      conds.push(`created_at >= $${params.length}`);
    }
    if (bounds.to) {
      params.push(bounds.to);
      conds.push(`created_at < $${params.length}`);
    }

    const res = await ctx.pool.query<{
      new_count: string;
      repeat_count: string;
      avg_repeat_orders: string | null;
    }>(
      `WITH customer_orders AS (
         SELECT customer_address, COUNT(*) AS n
         FROM service_orders
         WHERE ${conds.join(" AND ")}
         GROUP BY customer_address
       )
       SELECT
         COUNT(*) FILTER (WHERE n = 1)::text AS new_count,
         COUNT(*) FILTER (WHERE n >= 2)::text AS repeat_count,
         AVG(n) FILTER (WHERE n >= 2)::text AS avg_repeat_orders
       FROM customer_orders`,
      params
    );

    const newCount = Number(res.rows[0]?.new_count ?? 0);
    const repeatCount = Number(res.rows[0]?.repeat_count ?? 0);
    const total = newCount + repeatCount;
    const avgRepeatOrders =
      res.rows[0]?.avg_repeat_orders === null ||
      res.rows[0]?.avg_repeat_orders === undefined
        ? null
        : Number(res.rows[0].avg_repeat_orders);
    const pctRepeat = total === 0 ? null : (repeatCount / total) * 100;

    const display: ToolDisplay = {
      kind: "number",
      primary: pctRepeat === null ? "n/a" : `${pctRepeat.toFixed(1)}%`,
      label: `Repeat-customer rate (${RANGE_LABEL[parsed.range]})`,
      sub:
        total === 0
          ? "No paid+completed bookings in this window"
          : `${repeatCount} repeat / ${newCount} new — ${total} customers total` +
            (avgRepeatOrders
              ? `, returning customers avg ${avgRepeatOrders.toFixed(1)} bookings`
              : ""),
    };

    return {
      data: {
        range: parsed.range,
        total,
        newCount,
        repeatCount,
        pctRepeat,
        avgRepeatOrders,
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
