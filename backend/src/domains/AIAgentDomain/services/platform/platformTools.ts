// backend/src/domains/AIAgentDomain/services/platform/platformTools.ts
//
// Platform Health Copilot — tool set (Admin AI #2).
// Platform-WIDE read-only tools for the admin "ask the platform" assistant.
// These implement the same BusinessInsightsTool interface as the shop insights
// tools (so the existing dispatchTool validates + runs them), but their queries
// aggregate across ALL shops and they ignore ctx.shopId.
//
// Columns used here are all verified against the live schema (shops,
// transactions). Keep new tools to verified columns.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolResult,
} from "../insights/types";

// ---- platform_overview -----------------------------------------------------
const platformOverview: BusinessInsightsTool = {
  name: "platform_overview",
  description:
    "Top-level platform snapshot: total + active shops, customers with activity, " +
    "and total RCN issued vs redeemed (all time). Use for 'how is the platform " +
    "doing', 'how many shops/customers do we have', or a general health check.",
  inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { rows } = await ctx.pool.query<{
      active_shops: string;
      total_shops: string;
      customers: string;
      issued: string;
      redeemed: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM shops WHERE active = true)                              AS active_shops,
         (SELECT COUNT(*) FROM shops)                                                  AS total_shops,
         (SELECT COUNT(DISTINCT customer_address) FROM transactions
            WHERE customer_address IS NOT NULL)                                        AS customers,
         (SELECT COALESCE(SUM(amount),0) FROM transactions
            WHERE type='mint' AND status='confirmed')                                  AS issued,
         (SELECT COALESCE(SUM(amount),0) FROM transactions
            WHERE type='redeem' AND status='confirmed')                                AS redeemed`
    );
    const r = rows[0];
    const data = {
      activeShops: parseInt(r.active_shops, 10),
      totalShops: parseInt(r.total_shops, 10),
      customers: parseInt(r.customers, 10),
      totalRcnIssued: parseFloat(r.issued),
      totalRcnRedeemed: parseFloat(r.redeemed),
    };
    return {
      data,
      display: {
        kind: "list",
        items: [
          { label: "Active shops", value: data.activeShops },
          { label: "Total shops", value: data.totalShops },
          { label: "Customers (with activity)", value: data.customers },
          { label: "RCN issued (all time)", value: Math.round(data.totalRcnIssued) },
          { label: "RCN redeemed (all time)", value: Math.round(data.totalRcnRedeemed) },
        ],
      },
    };
  },
};

// ---- token_economy ---------------------------------------------------------
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

const tokenEconomy: BusinessInsightsTool = {
  name: "token_economy",
  description:
    "Platform RCN flow (issued vs redeemed) over a window, plus the RCG shop-tier " +
    "distribution. Use for 'RCN issued vs redeemed', 'token economy health', or " +
    "'how many shops are premium/elite'.",
  inputSchema: {
    type: "object",
    properties: {
      range: { type: "string", enum: ["7d", "30d", "90d"], description: "Window. Defaults to 30d." },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const a = (args ?? {}) as { range?: string };
    const range = a.range && RANGE_DAYS[a.range] ? a.range : "30d";
    const days = RANGE_DAYS[range];

    const flow = await ctx.pool.query<{ issued: string; redeemed: string }>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type='mint'),0)   AS issued,
         COALESCE(SUM(amount) FILTER (WHERE type='redeem'),0) AS redeemed
       FROM transactions
       WHERE status='confirmed' AND created_at >= NOW() - ($1::int || ' days')::interval`,
      [days]
    );
    const tiers = await ctx.pool.query<{ rcg_tier: string; count: string }>(
      `SELECT COALESCE(rcg_tier,'none') AS rcg_tier, COUNT(*) AS count
       FROM shops GROUP BY COALESCE(rcg_tier,'none')`
    );

    const issued = parseFloat(flow.rows[0].issued);
    const redeemed = parseFloat(flow.rows[0].redeemed);
    const tierDist: Record<string, number> = {};
    for (const t of tiers.rows) tierDist[t.rcg_tier] = parseInt(t.count, 10);

    return {
      data: { range, issued, redeemed, net: issued - redeemed, tierDistribution: tierDist },
      display: {
        kind: "comparison",
        label: `RCN issued vs redeemed (last ${days} days)`,
        current: { value: String(Math.round(issued)), sublabel: "issued" },
        prior: { value: String(Math.round(redeemed)), sublabel: "redeemed" },
        delta: {
          value: String(Math.round(issued - redeemed)),
          direction: issued > redeemed ? "up" : issued < redeemed ? "down" : "flat",
          sentiment: "neutral",
          magnitude: "medium",
        },
      },
    };
  },
};

// ---- subscription_health ---------------------------------------------------
const subscriptionHealth: BusinessInsightsTool = {
  name: "subscription_health",
  description:
    "Breakdown of shops by operational status (rcg_qualified / subscription_qualified / " +
    "not_qualified / pending / paused) and how many have an active subscription. Use for " +
    "'how many shops are subscribed', 'shop subscription health', or churn-risk questions.",
  inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { rows } = await ctx.pool.query<{ operational_status: string; count: string }>(
      `SELECT COALESCE(operational_status,'unknown') AS operational_status, COUNT(*) AS count
       FROM shops GROUP BY COALESCE(operational_status,'unknown') ORDER BY COUNT(*) DESC`
    );
    const sub = await ctx.pool.query<{ active_subs: string }>(
      `SELECT COUNT(*) AS active_subs FROM shops WHERE subscription_active = true`
    );
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.operational_status] = parseInt(r.count, 10);

    return {
      data: { byOperationalStatus: byStatus, activeSubscriptions: parseInt(sub.rows[0].active_subs, 10) },
      display: {
        kind: "table",
        columns: ["Operational status", "Shops"],
        rows: rows.map((r) => [r.operational_status, parseInt(r.count, 10)]),
      },
    };
  },
};

// ---- registry --------------------------------------------------------------
const PLATFORM_TOOLS: readonly BusinessInsightsTool[] = Object.freeze([
  platformOverview,
  tokenEconomy,
  subscriptionHealth,
]);

const BY_NAME = new Map(PLATFORM_TOOLS.map((t) => [t.name, t]));

export function getPlatformTools(): BusinessInsightsTool[] {
  return [...PLATFORM_TOOLS];
}
export function getPlatformToolByName(name: string): BusinessInsightsTool | undefined {
  return BY_NAME.get(name);
}
