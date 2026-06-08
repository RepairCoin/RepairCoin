// backend/src/domains/AIAgentDomain/services/marketing/tools/lookupAudienceCount.ts
//
// Tool: lookup_audience_count
//
// Read-only. Resolves a natural-language audience hint ("top 100 by
// spend", "lapsed 90+ days", "everyone") into a structured segment +
// returns the resolved count and a sample of customer names. Claude
// calls this BEFORE drafting a campaign so it can:
//   1. Confirm the segment exists and isn't empty
//   2. Confirm the count matches the shop's intent ("did you mean 100?
//      it's actually 87")
//   3. Get sample names for the AudienceSummaryCard render
//
// The shop-scoping invariant: ctx.shopId comes from the JWT. The tool
// never reads a shopId from args.
//
// The audience-resolution logic mirrors the existing
// MarketingService.getTargetAudience switch cases (top_spenders,
// frequent_visitors, active_customers, custom) plus the new
// `minDaysSinceLastVisit` filter shipped in Phase 1.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { MarketingService } from "../../../../../services/MarketingService";
import { CustomerRepository } from "../../../../../repositories/CustomerRepository";

const NAME = "lookup_audience_count";

type ResolvedAudienceType =
  | "all_customers"
  | "top_spenders"
  | "frequent_visitors"
  | "active_customers"
  | "custom";

interface ResolvedSegment {
  audienceType: ResolvedAudienceType;
  audienceFilters: Record<string, unknown>;
  label: string;
}

export const lookupAudienceCount: MarketingTool = {
  name: NAME,
  description:
    "Look up how many customers match a target segment for this shop. " +
    "Call this BEFORE drafting a campaign so you know if the segment is " +
    "non-empty and so you can show the shop the resolved size. The hint " +
    "can be free-form (\"top 100 by spend\", \"haven't booked in 90 " +
    "days\", \"all customers\", \"frequent visitors\"). Returns the " +
    "resolved segment, total count, and a few sample customer names. " +
    "Read-only — never mutates anything.",
  inputSchema: {
    type: "object",
    properties: {
      segment_hint: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description:
          "Natural-language description of who to target. Examples: " +
          "\"top 100 by spend\", \"lapsed 90+ days\", \"customers who " +
          "haven't booked in 6 months\", \"all customers\", \"frequent " +
          "visitors\".",
      },
    },
    required: ["segment_hint"],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const hint = (args as { segment_hint?: unknown }).segment_hint;
    if (typeof hint !== "string" || hint.trim().length === 0) {
      throw new Error(`${NAME}: segment_hint must be a non-empty string`);
    }

    const segment = resolveSegment(hint);

    const marketingService = new MarketingService();
    const customerRepo = new CustomerRepository();

    // Resolve the ACTUAL recipients for this segment once. Both the count and
    // the sample-name preview must come from this same filtered list — pulling
    // sample names from the unfiltered shop list (the old bug) showed customers
    // who weren't in the segment, contradicting the count (e.g. "1 match" but
    // 4 names listed).
    const recipients = await marketingService.getAudienceRecipients(
      ctx.shopId,
      segment.audienceType as any,
      segment.audienceFilters
    );
    const count = recipients.length;
    const sampleNames = recipients
      .slice(0, 5)
      .map((c) => (c.name && c.name.trim()) || shortAddress(c.walletAddress))
      .filter((s) => s.length > 0);

    // totalShopCustomers needs the UNFILTERED total — it lets the card + Claude
    // flag degenerate cases ("top 50" against a 4-customer shop should say
    // "you have 4 in total — let's send to all 4" instead of a meaningless
    // 1-customer "top spender"). Kept as a separate query on purpose.
    let totalShopCustomers = 0;
    try {
      const shopCustomers = await customerRepo.findByShopInteraction(ctx.shopId);
      totalShopCustomers = shopCustomers.length;
    } catch {
      totalShopCustomers = 0;
    }

    return {
      data: {
        audience_type: segment.audienceType,
        audience_filters: segment.audienceFilters,
        resolved_label: segment.label,
        resolved_count: count,
        total_shop_customers: totalShopCustomers,
        sample_names: sampleNames,
      },
      display: {
        kind: "audience_summary",
        label: segment.label,
        resolvedCount: count,
        audienceType: segment.audienceType,
        audienceFilters: segment.audienceFilters,
        sampleNames,
        totalShopCustomers,
      },
    };
  },
};

/**
 * Map a free-form hint to one of the existing audience-type branches.
 * Keep deterministic — easier to audit than handing the mapping to
 * Claude. Hint phrasing is small, the keyword set is bounded.
 *
 * Order of checks matters: "top N" must beat "active" because both
 * could trigger on phrases like "top active customers". The most
 * specific phrasing wins.
 */
function resolveSegment(hint: string): ResolvedSegment {
  const normalized = hint.toLowerCase().trim();

  // Lapsed — "haven't booked", "lapsed", "old customers", "win back"
  const daysMatch = normalized.match(/(\d+)\s*(?:\+\s*)?days?/);
  const monthsMatch = normalized.match(/(\d+)\s*months?/);
  const lapsedKeywords =
    /lapse|haven['’]?t (booked|visited|been)|old customer|inactive|stopped (coming|booking)|win[- ]back|bring (back|them back)/;
  if (lapsedKeywords.test(normalized)) {
    let days = 90; // default lapsed window
    if (daysMatch) {
      days = parseInt(daysMatch[1], 10);
    } else if (monthsMatch) {
      days = parseInt(monthsMatch[1], 10) * 30;
    }
    return {
      audienceType: "custom",
      audienceFilters: { minDaysSinceLastVisit: days },
      label: `Customers who haven't booked in ${days}+ days`,
    };
  }

  // Top spenders — "top N", "best customers", "highest spend"
  const topMatch = normalized.match(/top\s*(\d+)/);
  if (topMatch || /best customer|highest spend|biggest customer|top spender/.test(normalized)) {
    if (topMatch) {
      const n = parseInt(topMatch[1], 10);
      return {
        audienceType: "top_spenders",
        audienceFilters: { limit: n },
        label: `Top ${n} customers by spend`,
      };
    }
    return {
      audienceType: "top_spenders",
      audienceFilters: {},
      label: "Top spenders",
    };
  }

  // Frequent visitors
  if (/frequent visitor|regular customer|loyal customer|repeat customer/.test(normalized)) {
    return {
      audienceType: "frequent_visitors",
      audienceFilters: {},
      label: "Frequent visitors",
    };
  }

  // Active (last 30 days)
  if (/active|recent customer|last 30 days|this month/.test(normalized)) {
    return {
      audienceType: "active_customers",
      audienceFilters: {},
      label: "Active customers (last 30 days)",
    };
  }

  // Default — all customers. Covers "everyone", "all customers", "my
  // customers", anything generic.
  return {
    audienceType: "all_customers",
    audienceFilters: {},
    label: "All customers",
  };
}

function shortAddress(addr: string | undefined): string {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
