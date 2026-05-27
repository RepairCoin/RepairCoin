// backend/src/domains/AIAgentDomain/services/marketing/types.ts
//
// Shared types for the AI Marketing Assistant toolkit.
//
// Design (scope §4): Claude reaches the marketing layer via pre-defined
// tools. Each tool has a typed input schema, a description Claude reads
// to decide whether to call it, and an execute() implementation the
// dispatcher invokes.
//
// Shop-scoping invariant: ctx.shopId comes from the JWT (controller
// reads it from req.user), never from Claude's args. Tools that mutate
// (propose_campaign_draft, propose_campaign_send) hardcode the JWT-shop
// when calling MarketingService, ignoring any shopId-like value Claude
// might supply.
//
// Mirror of services/insights/types.ts shape, with marketing-specific
// ToolDisplay variants for the chat UI (campaign_draft card,
// audience_summary card, strategy_chips).

import { Pool } from "pg";
import { ClaudeTool } from "../../types";

/**
 * Context every marketing tool's execute() receives.
 */
export interface MarketingToolContext {
  /** Authenticated shop. Sourced from the JWT by the controller. */
  shopId: string;
  /** Shared PG pool (allows test injection). */
  pool: Pool;
}

/**
 * Frontend rendering hint for a marketing tool's result. The chat panel
 * branches on `kind` to render under the assistant bubble.
 */
export type MarketingToolDisplay =
  | {
      // Phase 2.2 — preview chip for an audience segment Claude resolved
      // ("top 100 by spend" → 87 customers). Renders an inline card the
      // shop can tap-through to see the recipient list before drafting.
      kind: "audience_summary";
      label: string;
      resolvedCount: number;
      audienceType: string;
      audienceFilters: Record<string, unknown>;
      sampleNames?: string[];
      /**
       * Total customers this shop has (the all_customers count). Lets the
       * frontend flag degenerate cases — e.g. shop asked for "top 50"
       * but only has 4 customers, so the answer is the whole list, not
       * a meaningful "top". Optional so older clients don't crash.
       */
      totalShopCustomers?: number;
    }
  | {
      // Phase 2.2 — a fully-drafted but unsent campaign. Renders as a
      // tap-to-open card; tapping opens the CampaignReviewModal where
      // the shop can edit subject/body and confirm send.
      //
      // `campaignId` is the persisted draft id (status='draft' in
      // marketing_campaigns) — the modal's Send button POSTs to
      // /api/marketing/campaigns/:id/send with this id.
      kind: "campaign_draft";
      campaignId: string;
      subject: string;
      bodyPreview: string;
      channel: "email";
      audienceLabel: string;
      recipientCount: number;
    }
  | {
      // Phase 2.2 — proposed send action for an existing draft (the
      // shop already saw the draft card and is asking AI to send it
      // without re-opening the modal). Inline-confirm pattern: tap
      // emits a `confirm_send` event back to the controller, which
      // calls /campaigns/:id/send.
      //
      // Modal-confirm in CampaignDraftCard is the primary destructive
      // gate (scope Q4) — this `campaign_send` variant exists for the
      // narrow case where the shop is iterating ("send it now") on a
      // draft they already reviewed.
      kind: "campaign_send";
      campaignId: string;
      recipientCount: number;
    }
  | {
      // Phase 2.2 — strategy chips for empty-panel state. Mirrors
      // suggest_followups from Insights but with campaign-specific
      // wording ("Drafts you might want to send" rather than "Things
      // you might want to ask").
      kind: "strategy_chips";
      items: string[];
    };

/**
 * Result a marketing tool's execute() must return.
 */
export interface MarketingToolResult {
  data: Record<string, unknown>;
  display?: MarketingToolDisplay;
}

/**
 * One marketing tool Claude can invoke.
 */
export interface MarketingTool extends ClaudeTool {
  execute(args: unknown, ctx: MarketingToolContext): Promise<MarketingToolResult>;
}

/**
 * Controller-facing result of one tool dispatch attempt.
 */
export interface MarketingToolDispatchResult {
  ok: boolean;
  tool: string;
  args: Record<string, unknown>;
  result?: MarketingToolResult;
  error?: string;
  latencyMs: number;
}

/**
 * Slim record stored in `ai_marketing_messages.tool_calls` JSONB.
 * Excludes `result.data` (can be large + duplicates what Claude sees
 * on the next turn). Keep enough metadata to audit which tool was
 * picked + whether it errored + how it rendered.
 */
export interface MarketingToolInvocationRecord {
  tool: string;
  args: Record<string, unknown>;
  display?: MarketingToolDisplay;
  latencyMs: number;
  error?: string;
}
