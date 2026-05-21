// backend/src/domains/AIAgentDomain/services/insights/tools/cancellationBreakdown.ts
//
// Tool: cancellation_breakdown
//
// Answers questions like:
//   - "Why are bookings cancelling?"
//   - "How many no-shows did I have last month?"
//   - "What does my cancellation mix look like?"
//
// Counts service_orders with status IN ('cancelled', 'no_show',
// 'expired') broken down by status + cancellation_reason (where
// populated). Shop owners obsess over this — separates "customer
// cancelled" from "no-show" from "auto-expired" so the owner knows
// where to intervene.

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

const NAME = "cancellation_breakdown";

const FAILURE_STATUSES = ["cancelled", "no_show", "expired"] as const;

const STATUS_LABEL: Record<string, string> = {
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};

interface ParsedArgs {
  range: RangeKey;
}

export const cancellationBreakdown: BusinessInsightsTool = {
  name: NAME,
  description:
    "Break down the shop's lost bookings — cancelled, no-show, and " +
    "expired — in a time window. Use this when the user asks about " +
    "cancellations, no-shows, lost bookings, or why bookings aren't " +
    "completing. Includes cancellation_reason where the customer or " +
    "shop logged one, so the assistant can phrase the most common " +
    "reasons.",
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

    const conds: string[] = [
      `shop_id = $1`,
      `status IN ('cancelled', 'no_show', 'expired')`,
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
      status: string;
      cancellation_reason: string | null;
      n: string;
    }>(
      `SELECT status, cancellation_reason, COUNT(*)::text AS n
       FROM service_orders
       WHERE ${conds.join(" AND ")}
       GROUP BY status, cancellation_reason
       ORDER BY status, COUNT(*) DESC`,
      params
    );

    // Roll up by status. Also track top-3 reasons across all 3
    // statuses so Claude can mention them in prose.
    const byStatus: Record<string, number> = {};
    for (const s of FAILURE_STATUSES) byStatus[s] = 0;
    const reasonCounts: Record<string, number> = {};
    let total = 0;
    for (const row of res.rows) {
      const n = Number(row.n);
      byStatus[row.status] = (byStatus[row.status] ?? 0) + n;
      total += n;
      const reason = (row.cancellation_reason ?? "").trim();
      if (reason) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + n;
    }
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));

    const items: Array<{ label: string; value: string | number }> = [
      { label: "Total lost", value: String(total) },
    ];
    for (const s of FAILURE_STATUSES) {
      const count = byStatus[s];
      items.push({
        label: STATUS_LABEL[s],
        value: formatValue(count, total),
      });
    }
    if (topReasons.length > 0) {
      for (const r of topReasons) {
        items.push({
          label: `↳ ${r.reason}`,
          value: String(r.count),
        });
      }
    }

    return {
      data: {
        range: parsed.range,
        total,
        byStatus,
        topReasons,
      },
      display: { kind: "list", items },
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

function formatValue(count: number, total: number): string {
  if (total === 0 || count === 0) return "0";
  const pct = (count / total) * 100;
  return `${count} (${pct.toFixed(1)}%)`;
}
