// backend/src/domains/AIAgentDomain/services/insights/tools/topServices.ts
//
// Tool: top_services
//
// Answers questions like:
//   - "Which services made the most revenue last month?"
//   - "Which of my services book the most?"
//   - "Which service has the highest conversion rate?"
//
// Ranks the shop's services by one of three metrics within the
// requested window:
//
//   - revenue    → SUM(service_orders.total_amount)
//                  WHERE status IN ('paid','completed')
//   - bookings   → COUNT(service_orders.*) — ALL statuses, so this
//                  reflects intent-to-book, not just completed money.
//                  Mirrors how a shop owner thinks: "X people clicked
//                  book on this service" includes cancellations and
//                  no-shows.
//   - conversion → paid+completed bookings ÷ conversations linked to
//                  the service. Excludes services with 0 conversations
//                  (can't divide, and surfacing them alongside services
//                  with real signal would mislead — Claude will see
//                  the exclusion in the data and can ask a follow-up).
//
// Joins shop_services for the service_name display. All three queries
// hardcode `shop_id = $1` with ctx.shopId — never sourced from Claude.

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

const NAME = "top_services";

export const topServices: BusinessInsightsTool = {
  name: NAME,
  description:
    "Rank the shop's services by performance within a time window. Use " +
    "this when the user asks which services are doing best or worst, " +
    "generating the most revenue, getting the most bookings, or have " +
    "the highest/lowest conversion rate.",
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
      by: {
        type: "string",
        enum: ["revenue", "bookings", "conversion"],
        description:
          "Ranking metric. 'revenue' = total paid order amount. " +
          "'bookings' = number of bookings. 'conversion' = bookings " +
          "divided by AI conversations or views for that service.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "How many services to return (1–10).",
      },
    },
    required: ["range", "by", "limit"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const rows =
      parsed.by === "revenue"
        ? await queryRevenue(ctx.pool, ctx.shopId, parsed)
        : parsed.by === "bookings"
          ? await queryBookings(ctx.pool, ctx.shopId, parsed)
          : await queryConversion(ctx.pool, ctx.shopId, parsed);

    const ranked = rows.map((r, i) => ({
      rank: i + 1,
      serviceId: r.service_id,
      name: resolveServiceName(r.service_name, r.service_id),
      value: r.value,
      // Mode-specific extras Claude can use to phrase its reply.
      bookings: r.bookings,
      paidBookings: r.paid_bookings,
      conversations: r.conversations,
    }));

    return {
      data: {
        range: parsed.range,
        by: parsed.by,
        count: ranked.length,
        services: ranked,
      },
      display: buildDisplay(parsed, ranked),
    };
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

type ByKey = "revenue" | "bookings" | "conversion";

interface ParsedArgs {
  range: RangeKey;
  by: ByKey;
  limit: number;
}

interface RawRow {
  service_id: string;
  service_name: string | null;
  /** The metric value for the current `by` mode. */
  value: number;
  /** Always populated for `bookings` mode (= value). For other modes,
   *  represents the all-status booking count where available. */
  bookings: number | null;
  /** Paid+completed booking count. Populated for revenue + conversion. */
  paid_bookings: number | null;
  /** Conversation count for the service. Populated only for conversion. */
  conversations: number | null;
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
  if (by !== "revenue" && by !== "bookings" && by !== "conversion") {
    throw new Error(`${NAME}: invalid by '${String(a.by)}'`);
  }
  const limit = a.limit;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10
  ) {
    throw new Error(`${NAME}: limit must be an integer 1..10`);
  }
  return { range, by, limit };
}

async function queryRevenue(
  pool: Pool,
  shopId: string,
  parsed: ParsedArgs
): Promise<RawRow[]> {
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
  params.push(parsed.limit);
  const limitParam = `$${params.length}`;

  const res = await pool.query<{
    service_id: string;
    service_name: string | null;
    total: string;
    n: string;
  }>(
    `SELECT o.service_id, s.service_name,
            COALESCE(SUM(o.total_amount), 0)::text AS total,
            COUNT(*)::text AS n
     FROM service_orders o
     LEFT JOIN shop_services s ON s.service_id = o.service_id
     WHERE ${conds.join(" AND ")}
     GROUP BY o.service_id, s.service_name
     ORDER BY SUM(o.total_amount) DESC
     LIMIT ${limitParam}`,
    params
  );
  return res.rows.map((r) => ({
    service_id: r.service_id,
    service_name: r.service_name,
    value: Number(r.total),
    bookings: null,
    paid_bookings: Number(r.n),
    conversations: null,
  }));
}

async function queryBookings(
  pool: Pool,
  shopId: string,
  parsed: ParsedArgs
): Promise<RawRow[]> {
  // ALL statuses — "intent to book" view. Shop owners often want this
  // separate from the paid+completed revenue view.
  const conds: string[] = [`o.shop_id = $1`];
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
  params.push(parsed.limit);
  const limitParam = `$${params.length}`;

  const res = await pool.query<{
    service_id: string;
    service_name: string | null;
    n: string;
  }>(
    `SELECT o.service_id, s.service_name,
            COUNT(*)::text AS n
     FROM service_orders o
     LEFT JOIN shop_services s ON s.service_id = o.service_id
     WHERE ${conds.join(" AND ")}
     GROUP BY o.service_id, s.service_name
     ORDER BY COUNT(*) DESC
     LIMIT ${limitParam}`,
    params
  );
  return res.rows.map((r) => ({
    service_id: r.service_id,
    service_name: r.service_name,
    value: Number(r.n),
    bookings: Number(r.n),
    paid_bookings: null,
    conversations: null,
  }));
}

async function queryConversion(
  pool: Pool,
  shopId: string,
  parsed: ParsedArgs
): Promise<RawRow[]> {
  // Two CTEs: paid+completed booking counts per service, and
  // conversation counts per service. Outer query joins by service_id,
  // filters to services with at least one conversation (the
  // denominator), and ranks by ratio. Both CTEs filter by shop and the
  // same time window — the outer `shop_services` filter is the
  // belt-and-suspenders shop guard.
  const params: unknown[] = [shopId];
  const bounds = windowBoundsFor(parsed.range);
  // Push window params first so they're $2 (from) and optionally $3 (to);
  // limit gets whatever comes after. Both CTEs reference the same param
  // indices so we build the predicate strings once.
  let fromIdx = -1;
  let toIdx = -1;
  if (bounds.from) {
    params.push(bounds.from);
    fromIdx = params.length;
  }
  if (bounds.to) {
    params.push(bounds.to);
    toIdx = params.length;
  }
  const orderWindow = [
    bounds.from ? `AND o.created_at >= $${fromIdx}` : "",
    bounds.to ? `AND o.created_at < $${toIdx}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const convosWindow = [
    bounds.from ? `AND c.created_at >= $${fromIdx}` : "",
    bounds.to ? `AND c.created_at < $${toIdx}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const windowCondOrders = orderWindow;
  const windowCondConvos = convosWindow;
  params.push(parsed.limit);
  const limitParam = `$${params.length}`;

  const sql = `
    WITH orders AS (
      SELECT o.service_id, COUNT(*) AS paid_n
      FROM service_orders o
      WHERE o.shop_id = $1
        AND o.status IN ('paid', 'completed')
        ${windowCondOrders}
      GROUP BY o.service_id
    ),
    convos AS (
      SELECT c.service_id, COUNT(*) AS conv_n
      FROM conversations c
      WHERE c.shop_id = $1
        AND c.service_id IS NOT NULL
        ${windowCondConvos}
      GROUP BY c.service_id
    )
    SELECT s.service_id, s.service_name,
           COALESCE(orders.paid_n, 0)::text AS paid_n,
           convos.conv_n::text AS conv_n
    FROM shop_services s
    LEFT JOIN orders ON orders.service_id = s.service_id
    INNER JOIN convos ON convos.service_id = s.service_id
    WHERE s.shop_id = $1
    ORDER BY (COALESCE(orders.paid_n, 0)::numeric / convos.conv_n) DESC
    LIMIT ${limitParam}
  `;

  const res = await pool.query<{
    service_id: string;
    service_name: string | null;
    paid_n: string;
    conv_n: string;
  }>(sql, params);

  return res.rows.map((r) => {
    const paid = Number(r.paid_n);
    const conv = Number(r.conv_n);
    return {
      service_id: r.service_id,
      service_name: r.service_name,
      value: conv === 0 ? 0 : paid / conv,
      bookings: null,
      paid_bookings: paid,
      conversations: conv,
    };
  });
}

function resolveServiceName(name: string | null, serviceId: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  // Service was deleted but its orders persist (LEFT JOIN). Show the
  // ID so the shop owner can still recognize / look it up.
  return `(deleted service ${serviceId.slice(0, 12)}…)`;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtConversion(ratio: number, paid: number | null, conv: number | null): string {
  const pct = (ratio * 100).toFixed(1);
  if (paid !== null && conv !== null) {
    return `${pct}% (${paid}/${conv})`;
  }
  return `${pct}%`;
}

function fmtValue(by: ByKey, row: { value: number; paidBookings: number | null; conversations: number | null }): string {
  if (by === "revenue") return fmtUsd(row.value);
  if (by === "bookings") return String(row.value);
  return fmtConversion(row.value, row.paidBookings, row.conversations);
}

function buildDisplay(
  parsed: ParsedArgs,
  ranked: Array<{
    rank: number;
    name: string;
    value: number;
    paidBookings: number | null;
    conversations: number | null;
  }>
): ToolDisplay {
  const valueColumn =
    parsed.by === "revenue"
      ? "Revenue"
      : parsed.by === "bookings"
        ? "Bookings"
        : "Conversion";
  return {
    kind: "table",
    columns: ["#", "Service", valueColumn],
    rows: ranked.map((s) => [s.rank, s.name, fmtValue(parsed.by, s)]),
  };
}
