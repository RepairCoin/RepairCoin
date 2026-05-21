// backend/src/domains/AIAgentDomain/services/insights/tools/bookingsBreakdown.ts
//
// Tool: bookings_breakdown
//
// Answers questions like:
//   - "How many bookings did I have this week, broken down by status?"
//   - "How many no-shows did I have last month?"
//   - "What does my pipeline look like right now?"
//
// Returns counts per service_orders.status for ctx.shopId in the
// requested window. The canonical status list (completed, paid,
// pending, cancelled, no_show, expired, refunded) is always returned
// even when a status has zero rows — that way the shop owner sees
// "0 no-shows" explicitly instead of having to infer absence. Any
// non-canonical status appearing in the data is appended after the
// canonical block (forward-compat for new statuses).

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

const NAME = "bookings_breakdown";

export const bookingsBreakdown: BusinessInsightsTool = {
  name: NAME,
  description:
    "Break down the shop's bookings by status (pending, paid, " +
    "completed, cancelled, no_show, expired, refunded) within a time " +
    "window. Use this when the user asks how many bookings they had, " +
    "the booking status mix, how many cancellations or no-shows they " +
    "had, or how their pipeline is moving.",
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

    const res = await ctx.pool.query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text AS n
       FROM service_orders
       WHERE ${conds.join(" AND ")}
       GROUP BY status`,
      params
    );

    // Start with canonical zeros so every expected status appears.
    const counts: Record<string, number> = {};
    for (const s of CANONICAL_STATUSES) counts[s] = 0;
    for (const row of res.rows) counts[row.status] = Number(row.n);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // Stable order: canonical first, then any extras alphabetized.
    const extras = Object.keys(counts)
      .filter((k) => !CANONICAL_SET.has(k))
      .sort();
    const ordered = [...CANONICAL_STATUSES, ...extras];

    const items = ordered.map((status) => ({
      label: STATUS_LABEL[status] ?? defaultLabel(status),
      value: formatValue(counts[status], total),
    }));

    const display: ToolDisplay = {
      kind: "list",
      items: [
        { label: "Total bookings", value: String(total) },
        ...items,
      ],
    };

    return {
      data: {
        range: parsed.range,
        total,
        // Raw integer counts keyed by status — what Claude reads to
        // phrase its reply. Includes every canonical status (0 when
        // absent) so the model can confidently say "no no-shows" etc.
        byStatus: counts,
      },
      display,
    };
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

interface ParsedArgs {
  range: RangeKey;
}

const CANONICAL_STATUSES = [
  "completed",
  "paid",
  "pending",
  "cancelled",
  "no_show",
  "expired",
  "refunded",
] as const;

const CANONICAL_SET = new Set<string>(CANONICAL_STATUSES);

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  paid: "Paid (awaiting completion)",
  pending: "Pending",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
  refunded: "Refunded",
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

function defaultLabel(raw: string): string {
  // Title-case unknown statuses for the display row label.
  return raw
    .split(/[_-]/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function formatValue(count: number, total: number): string {
  if (total === 0) return "0";
  const pct = (count / total) * 100;
  // 0.0% is awkward; show plain "0" when count is 0, otherwise one decimal.
  if (count === 0) return "0";
  return `${count} (${pct.toFixed(1)}%)`;
}
