// backend/src/domains/AIAgentDomain/services/marketing/estimateCampaignRevenue.ts
//
// FixFlow AI Operator — Phase 2. A ROUGH revenue-opportunity estimate shown on a
// campaign draft so "Do it" has a number attached ("est. $1.5k–$2.3k").
//
// Heuristic: recipients × estimated-conversion × the shop's real average order
// value. Email open/click tracking isn't populated yet (see the data audit), so
// we deliberately use a CONSERVATIVE flat conversion range, not historical open
// rates. The AOV is real (from this shop's paid+completed orders). The output is
// a RANGE and is always labeled "rough estimate" — never presented as a promise.

import { Pool } from "pg";

// Cautious SMB email/in-app campaign conversion band (share of recipients who
// book). Intentionally low — refine per-segment once open-tracking lands.
const CONV_LOW = 0.03;
const CONV_HIGH = 0.08;
// Fallback AOV when a shop has no paid/completed orders yet.
const DEFAULT_AOV_USD = 100;

export interface RevenueEstimate {
  lowUsd: number;
  highUsd: number;
  recipientCount: number;
  avgOrderValueUsd: number;
  /** One-line, human-readable note on how the range was derived. */
  assumptions: string;
}

/** Estimate the revenue opportunity of a campaign to `recipientCount` people.
 *  Never throws — falls back to a default AOV if the lookup fails. */
export async function estimateCampaignRevenue(
  pool: Pool,
  shopId: string,
  recipientCount: number
): Promise<RevenueEstimate> {
  let aov = DEFAULT_AOV_USD;
  try {
    const r = await pool.query<{ aov: string | null }>(
      `SELECT AVG(COALESCE(final_amount_usd, total_amount))::float8::text AS aov
         FROM service_orders
        WHERE shop_id = $1 AND status IN ('paid', 'completed')`,
      [shopId]
    );
    const v = Number(r.rows[0]?.aov);
    if (Number.isFinite(v) && v > 0) aov = v;
  } catch {
    /* keep the default AOV */
  }

  const aovRounded = Math.round(aov * 100) / 100;
  const lowUsd = Math.round(recipientCount * CONV_LOW * aov);
  const highUsd = Math.round(recipientCount * CONV_HIGH * aov);

  return {
    lowUsd,
    highUsd,
    recipientCount,
    avgOrderValueUsd: aovRounded,
    assumptions:
      `rough estimate — ${recipientCount} recipient${recipientCount === 1 ? "" : "s"} × ` +
      `${Math.round(CONV_LOW * 100)}–${Math.round(CONV_HIGH * 100)}% est. conversion × ` +
      `$${aovRounded.toFixed(2)} avg order`,
  };
}
