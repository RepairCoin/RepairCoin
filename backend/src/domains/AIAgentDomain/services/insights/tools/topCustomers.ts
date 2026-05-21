// backend/src/domains/AIAgentDomain/services/insights/tools/topCustomers.ts
//
// Tool: top_customers
//
// Answers questions like:
//   - "Who are my top 5 customers by RCN earned this month?"
//   - "Who are my biggest spenders?"
//   - "Who came in the most this quarter?"
//
// Ranks customers within ctx.shopId by one of three metrics in the
// requested window.
//
// Metric → data source:
//   - rcn_earned   → transactions WHERE type IN ('mint', 'tier_bonus')
//                    (sum of amount = total RCN issued to the customer
//                    at this shop, including tier bonuses)
//   - spend        → service_orders WHERE status IN ('paid','completed')
//   - order_count  → service_orders WHERE status IN ('paid','completed')
//
// Customer name resolution: COALESCE the customers table's `name`,
// trimmed `first_name + last_name`, `email`, and finally a truncated
// wallet address (so the display never crashes on missing customer
// data). Resolution happens in JS, not SQL — keeps the SQL portable
// and lets us tune the privacy/truncation logic in one place.

import { Pool } from "pg";
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

const NAME = "top_customers";

export const topCustomers: BusinessInsightsTool = {
  name: NAME,
  description:
    "Rank the shop's customers by activity within a time window. Use " +
    "this when the user asks for top customers, best customers, most " +
    "active customers, biggest spenders, or who earned the most RCN.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: [...RANGE_ENUM],
        description:
          "Time window. Rolling ('7d'/'30d'/'90d'/'all') or calendar " +
          "('this_week'/'this_month'/'last_week'/'last_month'/" +
          "'this_quarter'). Pick whichever phrasing the user used.",
      },
      by: {
        type: "string",
        enum: ["rcn_earned", "spend", "order_count"],
        description:
          "Ranking metric. 'rcn_earned' = total RCN issued to the " +
          "customer in the window. 'spend' = total paid order amount. " +
          "'order_count' = number of completed orders.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "How many customers to return (1–10).",
      },
    },
    required: ["range", "by", "limit"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const rows =
      parsed.by === "rcn_earned"
        ? await queryRcnEarned(ctx.pool, ctx.shopId, parsed)
        : await querySpendOrCount(ctx.pool, ctx.shopId, parsed);

    const ranked = rows.map((r, i) => ({
      rank: i + 1,
      address: r.customer_address,
      displayName: resolveName(r),
      value: r.value,
      orderCount: r.order_count,
    }));

    const display = buildDisplay(parsed, ranked);
    return {
      data: {
        range: parsed.range,
        by: parsed.by,
        count: ranked.length,
        customers: ranked.map((c) => ({
          rank: c.rank,
          name: c.displayName,
          value: c.value,
          orderCount: c.orderCount,
        })),
      },
      display,
    };
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

type ByKey = "rcn_earned" | "spend" | "order_count";

interface ParsedArgs {
  range: RangeKey;
  by: ByKey;
  limit: number;
}

interface RawRow {
  customer_address: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  /** Numeric value for the chosen `by` metric. */
  value: number;
  /** Order count — always populated for spend/order_count; null-ish for rcn_earned. */
  order_count: number;
}

function parseArgs(args: unknown): ParsedArgs {
  if (!args || typeof args !== "object") {
    throw new Error(`${NAME}: args must be an object`);
  }
  const a = args as Record<string, unknown>;
  const range = a.range as RangeKey;
  if (!(range in RANGE_LABEL)) {
    throw new Error(`${NAME}: invalid range '${String(a.range)}'`);
  }
  const by = a.by as ByKey;
  if (by !== "rcn_earned" && by !== "spend" && by !== "order_count") {
    throw new Error(`${NAME}: invalid by '${String(a.by)}'`);
  }
  const limit = a.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new Error(`${NAME}: limit must be an integer 1..10`);
  }
  return { range, by, limit };
}

async function querySpendOrCount(
  pool: Pool,
  shopId: string,
  parsed: ParsedArgs
): Promise<RawRow[]> {
  // Shop-scoping hardcoded — $1 always = ctx.shopId, never from Claude.
  const conds: string[] = [
    `o.shop_id = $1`,
    `o.status IN ('paid', 'completed')`,
  ];
  const params: unknown[] = [shopId];
  const bounds = windowBoundsFor(parsed.range);
  if (bounds.from) {
    params.push(bounds.from);
    conds.push(`o.created_at >= $${params.length}`);
  }
  if (bounds.to) {
    params.push(bounds.to);
    conds.push(`o.created_at < $${params.length}`);
  }
  const orderBy =
    parsed.by === "spend"
      ? "SUM(o.total_amount) DESC"
      : "COUNT(*) DESC, SUM(o.total_amount) DESC";
  params.push(parsed.limit);
  const limitParam = `$${params.length}`;

  const res = await pool.query<{
    customer_address: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    n: string;
    total: string;
  }>(
    `SELECT o.customer_address,
            c.name, c.first_name, c.last_name, c.email,
            COUNT(*)::text AS n,
            COALESCE(SUM(o.total_amount), 0)::text AS total
     FROM service_orders o
     LEFT JOIN customers c ON c.address = o.customer_address
     WHERE ${conds.join(" AND ")}
     GROUP BY o.customer_address, c.name, c.first_name, c.last_name, c.email
     ORDER BY ${orderBy}
     LIMIT ${limitParam}`,
    params
  );

  return res.rows.map((r) => ({
    customer_address: r.customer_address,
    name: r.name,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    value: parsed.by === "spend" ? Number(r.total) : Number(r.n),
    order_count: Number(r.n),
  }));
}

async function queryRcnEarned(
  pool: Pool,
  shopId: string,
  parsed: ParsedArgs
): Promise<RawRow[]> {
  const conds: string[] = [
    `t.shop_id = $1`,
    `t.type IN ('mint', 'tier_bonus')`,
  ];
  const params: unknown[] = [shopId];
  const bounds = windowBoundsFor(parsed.range);
  if (bounds.from) {
    params.push(bounds.from);
    conds.push(`t.created_at >= $${params.length}`);
  }
  if (bounds.to) {
    params.push(bounds.to);
    conds.push(`t.created_at < $${params.length}`);
  }
  params.push(parsed.limit);
  const limitParam = `$${params.length}`;

  const res = await pool.query<{
    customer_address: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    rcn: string;
  }>(
    `SELECT t.customer_address,
            c.name, c.first_name, c.last_name, c.email,
            COALESCE(SUM(t.amount), 0)::text AS rcn
     FROM transactions t
     LEFT JOIN customers c ON c.address = t.customer_address
     WHERE ${conds.join(" AND ")}
     GROUP BY t.customer_address, c.name, c.first_name, c.last_name, c.email
     ORDER BY SUM(t.amount) DESC
     LIMIT ${limitParam}`,
    params
  );

  return res.rows.map((r) => ({
    customer_address: r.customer_address,
    name: r.name,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    value: Number(r.rcn),
    // order_count isn't meaningful for rcn_earned ranking — synthesize
    // 0 so the row shape stays uniform; Claude can ignore it via the
    // tool description.
    order_count: 0,
  }));
}

/**
 * COALESCE chain for display. Trims first/last fragments and falls
 * back to email then a `0xabcd…wxyz` short address.
 */
function resolveName(r: Pick<RawRow, "name" | "first_name" | "last_name" | "email" | "customer_address">): string {
  const direct = (r.name ?? "").trim();
  if (direct) return direct;
  const composed = `${(r.first_name ?? "").trim()} ${(r.last_name ?? "").trim()}`.trim();
  if (composed) return composed;
  const email = (r.email ?? "").trim();
  if (email) return email;
  const addr = r.customer_address ?? "";
  if (addr.length >= 10) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr || "unknown";
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtRcn(n: number): string {
  // RCN is a whole-number-ish token; drop fractional digits when whole.
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded} RCN` : `${rounded.toFixed(2)} RCN`;
}

function fmtValue(by: ByKey, n: number): string {
  if (by === "spend") return fmtUsd(n);
  if (by === "rcn_earned") return fmtRcn(n);
  return String(n);
}

function buildDisplay(
  parsed: ParsedArgs,
  ranked: Array<{ rank: number; displayName: string; value: number; orderCount: number }>
): ToolDisplay {
  const valueColumn =
    parsed.by === "spend"
      ? "Spend"
      : parsed.by === "rcn_earned"
        ? "RCN Earned"
        : "Orders";
  return {
    kind: "table",
    columns: ["#", "Customer", valueColumn],
    rows: ranked.map((c) => [
      c.rank,
      c.displayName,
      fmtValue(parsed.by, c.value),
    ]),
  };
}
