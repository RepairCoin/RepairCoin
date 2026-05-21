// backend/src/domains/AIAgentDomain/services/insights/tools/rcnBalanceSummary.ts
//
// Tool: rcn_balance_summary
//
// Answers questions like:
//   - "What's my RCN treasury?"
//   - "How much RCN have I issued?"
//   - "What's my available RCN balance?"
//   - "How much RCN did I issue this month?"
//
// RepairCoin-unique. Returns current shop RCN treasury status: total
// purchased, total issued to customers, current available balance, and
// monthly burn rate (RCN issued in the last 30 rolling days).
//
// Schema:
//   shops.purchased_rcn_balance — current available RCN the shop can
//     issue. Decremented when issuing rewards, incremented on purchase.
//   shops.total_tokens_issued — lifetime issued (mint + tier_bonus).
//   transactions WHERE shop_id=$1 AND type IN ('mint','tier_bonus') —
//     issued events; sum amount within a window for burn rate.

import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "rcn_balance_summary";

export const rcnBalanceSummary: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up this shop's RCN treasury status: current available RCN " +
    "balance, total RCN issued to customers (lifetime), and monthly " +
    "burn rate (RCN issued in the last 30 days). Use this when the " +
    "user asks about their RCN balance, treasury, how much RCN they've " +
    "issued, or how fast they're burning RCN.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    // Shop snapshot — purchased + lifetime issued live on the shops row.
    const shopRow = await ctx.pool.query<{
      purchased_rcn_balance: string | null;
      total_tokens_issued: string | null;
    }>(
      `SELECT purchased_rcn_balance, total_tokens_issued
       FROM shops WHERE shop_id = $1`,
      [ctx.shopId]
    );
    const available = Number(shopRow.rows[0]?.purchased_rcn_balance ?? 0);
    const lifetimeIssued = Number(shopRow.rows[0]?.total_tokens_issued ?? 0);

    // Monthly burn — sum mint + tier_bonus amounts over the last 30
    // rolling days. Rolling (not calendar-month) because the metric is
    // "is the shop burning RCN faster than they're buying it?" which
    // is rate-of-flow, not calendar accounting.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const burnRow = await ctx.pool.query<{ burn: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS burn
       FROM transactions
       WHERE shop_id = $1
         AND type IN ('mint', 'tier_bonus')
         AND created_at >= $2`,
      [ctx.shopId, thirtyDaysAgo]
    );
    const monthlyBurn = Number(burnRow.rows[0]?.burn ?? 0);

    // Implied runway in months if the shop keeps burning at this rate
    // and never buys more. Null when burn=0 (=> infinite runway).
    const runwayMonths = monthlyBurn > 0 ? available / monthlyBurn : null;

    const display: ToolDisplay = {
      kind: "list",
      items: [
        { label: "Available balance", value: fmtRcn(available) },
        { label: "Lifetime issued", value: fmtRcn(lifetimeIssued) },
        { label: "Issued in last 30 days", value: fmtRcn(monthlyBurn) },
        {
          label: "Runway at current burn",
          value:
            runwayMonths === null
              ? "n/a (no burn)"
              : `${runwayMonths.toFixed(1)} months`,
        },
      ],
    };

    return {
      data: {
        availableRcn: available,
        lifetimeIssued,
        monthlyBurn,
        runwayMonths,
      },
      display,
    };
  },
};

function fmtRcn(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? `${rounded} RCN`
    : `${rounded.toFixed(2)} RCN`;
}
