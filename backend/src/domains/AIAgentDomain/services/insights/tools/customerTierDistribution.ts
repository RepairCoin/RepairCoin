// backend/src/domains/AIAgentDomain/services/insights/tools/customerTierDistribution.ts
//
// Tool: customer_tier_distribution
//
// Answers questions like:
//   - "How many of my customers are Gold tier?"
//   - "What's my tier distribution?"
//   - "How many Silver+ customers do I have?"
//
// Current snapshot — no range arg. Counts DISTINCT customers who have
// at least one service_order with this shop, grouped by their current
// `customers.tier`. Bronze / Silver / Gold are the canonical values;
// any non-canonical tier value gets appended after the canonical block
// (forward-compat if RepairCoin ever adds a Platinum tier).
//
// Shop-scoping: the JOIN's WHERE clause restricts to customers who
// have transacted with THIS shop (via service_orders.shop_id = $1).
// A customer's tier is shop-agnostic (it's RCN-lifetime-based), but
// we only surface customers in this shop's customer base.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "customer_tier_distribution";

const CANONICAL_TIERS = ["BRONZE", "SILVER", "GOLD"] as const;
const CANONICAL_SET = new Set<string>(CANONICAL_TIERS);

const TIER_LABEL: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

export const customerTierDistribution: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up how many of this shop's customers fall into each loyalty " +
    "tier (Bronze / Silver / Gold). Use this when the user asks about " +
    "tier distribution, how many Gold customers they have, or what " +
    "fraction of customers are at each tier.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    // Shop-scope via the JOIN to service_orders. customers.tier is
    // global (lifetime RCN driven), but we restrict to customers who
    // have actually transacted with this shop.
    const res = await ctx.pool.query<{ tier: string | null; n: string }>(
      `SELECT c.tier, COUNT(DISTINCT c.address)::text AS n
       FROM customers c
       JOIN service_orders o ON o.customer_address = c.address
       WHERE o.shop_id = $1
       GROUP BY c.tier`,
      [ctx.shopId]
    );

    // Start with canonical zeros so every tier appears even when empty.
    const counts: Record<string, number> = {};
    for (const t of CANONICAL_TIERS) counts[t] = 0;
    for (const row of res.rows) {
      const key = row.tier ?? "UNKNOWN";
      counts[key] = (counts[key] ?? 0) + Number(row.n);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // Stable order: canonical first, then any extras alphabetized.
    const extras = Object.keys(counts)
      .filter((k) => !CANONICAL_SET.has(k))
      .sort();
    const ordered = [...CANONICAL_TIERS, ...extras];

    const items = ordered.map((tier) => ({
      label: TIER_LABEL[tier] ?? defaultTierLabel(tier),
      value: formatTierValue(counts[tier], total),
    }));

    const display: ToolDisplay = {
      kind: "list",
      items: [
        { label: "Total customers", value: String(total) },
        ...items,
      ],
    };

    return {
      data: {
        total,
        // Raw counts keyed by tier — what Claude reads to phrase its
        // reply ("you have 3 Gold, 7 Silver, 24 Bronze customers").
        // Includes the 3 canonical tiers with 0 when absent.
        byTier: counts,
      },
      display,
    };
  },
};

function defaultTierLabel(raw: string): string {
  // NULL → "Unknown"; weird values → titlecased.
  if (raw === "UNKNOWN") return "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function formatTierValue(count: number, total: number): string {
  if (total === 0) return "0";
  if (count === 0) return "0";
  const pct = (count / total) * 100;
  return `${count} (${pct.toFixed(1)}%)`;
}
