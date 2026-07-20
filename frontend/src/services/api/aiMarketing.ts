// frontend/src/services/api/aiMarketing.ts
//
// Shop-side AI Marketing Assistant. Backed by POST /api/ai/marketing-chat.
// See backend:
//   backend/src/domains/AIAgentDomain/controllers/MarketingChatController.ts
//
// The assistant drafts and proposes marketing email campaigns by natural
// language ("send a Black Friday campaign", "bring back lapsed
// customers", "tell my top 100 about our new service"). It NEVER sends
// directly — every send is shop-confirmed via the CampaignReviewModal.
//
// Multi-turn shape mirrors aiInsights. The caller holds the conversation
// in local state and passes the whole `messages` array (alternating
// user/assistant, starting with user, last message must be user).
//
// Response includes a `toolCalls` array; each entry has a `display` hint
// the panel renders inline under the assistant bubble. Branch on
// `display.kind` to pick the renderer — see MarketingToolCallCard.

import apiClient from "./client";

export type MarketingMessageRole = "user" | "assistant";

export interface MarketingMessage {
  role: MarketingMessageRole;
  content: string;
}

/**
 * Frontend rendering hint for a marketing tool's result. Mirror of the
 * backend's `MarketingToolDisplay` discriminated union.
 */
export type MarketingToolDisplay =
  | {
      // Resolved audience preview. Rendered as a compact inline card —
      // "23 customers who haven't booked in 90+ days" with a sample
      // name strip. Emitted by `lookup_audience_count`.
      kind: "audience_summary";
      label: string;
      resolvedCount: number;
      /**
       * How many resolved recipients actually have an email address — the
       * real ceiling for an email send. Surfaced for imported/Square cohorts
       * (often phone-dominant) where resolvedCount >> reachable. Optional so
       * older backend responses still type-check.
       */
      reachableByEmail?: number;
      audienceType: string;
      audienceFilters: Record<string, unknown>;
      sampleNames?: string[];
      /**
       * Total customers this shop has (all_customers count). Lets the
       * AudienceSummaryCard render a degenerate-case note — e.g. shop
       * asked for "top 50" but only has 4 customers. Optional so older
       * backend responses still type-check.
       */
      totalShopCustomers?: number;
    }
  | {
      // A persisted draft campaign. Rendered as the primary tap-to-open
      // card — tapping opens CampaignReviewModal where the shop can
      // edit subject/body and confirm send. Emitted by
      // `propose_campaign_draft`.
      kind: "campaign_draft";
      campaignId: string;
      subject: string;
      bodyPreview: string;
      /** Full body for the review modal (the card shows bodyPreview). */
      body?: string;
      channel: "email";
      audienceLabel: string;
      recipientCount: number;
      /** Optional banner image embedded at the top of the email. Shown in the
       *  draft card + the review-modal preview so the shop sees it before send. */
      imageUrl?: string | null;
      /** Phase 2 — rough revenue-opportunity range ("est. $X–$Y"). */
      estimatedRevenue?: { lowUsd: number; highUsd: number } | null;
      /** Campaign Rewards — RCN given to each recipient (+ total cost).
       *  fulfillment 'on_return' issues when the customer comes back. */
      reward?: {
        /** Human-readable summary (variable modes show a tier/spend schedule). */
        summary?: string;
        rcnPerRecipient?: number; // flat only
        totalRcn?: number; // flat only
        fulfillment?: "on_send" | "on_return";
        returnWindowDays?: number | null;
      } | null;
      /** Coupon — a bonus-RCN code redeemed on the next visit. code is null at
       *  draft (minted at send); shown as "code added when sent". */
      coupon?: { code: string | null; bonusRcn: number; expiresAt: string } | null;
      /** Welcome-on-claim RCN baked into an imported_winback draft (granted when the
       *  customer claims). Present only for win-back drafts with it active. */
      welcomeRewardRcn?: number;
      /** Label of the real CTA button block in the email (e.g. "Claim Your Account" on
       *  imported_winback drafts) — present so the preview can render it. */
      claimCtaLabel?: string;
    }
  | {
      // Inline send-confirm chip for an existing draft. Tap fires the
      // existing POST /api/marketing/campaigns/:id/send endpoint.
      // Emitted by `propose_campaign_send` — only when the shop has
      // already reviewed the draft.
      kind: "campaign_send";
      campaignId: string;
      recipientCount: number;
    }
  | {
      // Strategy chips for the empty-panel state. Rendered as a row of
      // tap-able pills below the assistant bubble; tapping submits the
      // chip text as a new user message. Emitted by
      // `suggest_campaign_strategies`.
      kind: "strategy_chips";
      items: string[];
    }
  | {
      // AI Image Generation Phase 2 — a generated, brand-applied marketing
      // image the shop reviews before using it in a campaign. The image is
      // already generated + stored (DO Spaces URL). Emitted by
      // `propose_campaign_image`.
      kind: "campaign_image_proposal";
      imageUrl: string;
      imageKey: string | null;
      altText: string;
      prompt: string;
      operationType: "generate" | "edit";
      dimensions: string;
    };

/**
 * One tool the model invoked. `display` is absent when the tool errored
 * (unknown tool name or args validation failed) — render nothing in
 * that case; Claude's prose will mention the failure.
 */
export interface MarketingToolCall {
  tool: string;
  args: Record<string, unknown>;
  display?: MarketingToolDisplay;
}

export interface MarketingResponse {
  /** Claude's prose reply, ready to display under the assistant bubble. */
  reply: string;
  /** The Sonnet model id Claude reported (e.g. `claude-sonnet-4-6`). */
  model: string;
  cached: boolean;
  latencyMs: number;
  /** Tools the model called in order. Render one card per entry. */
  toolCalls: MarketingToolCall[];
  // WS3 soft-landing — true once the shop's monthly AI allowance is spent (reply
  // still came through on a lighter model). Powers the AiLimitNotice banner.
  limitReached?: boolean;
  overageCapReached?: boolean;
  budgetUsd?: number;
  spentUsd?: number;
}

/**
 * Validation bounds the backend enforces. Mirror of
 * MarketingChatController.MAX_* constants.
 */
export const MARKETING_LIMITS = {
  maxMessages: 30,
  maxContentChars: 8000,
  maxSessionIdChars: 64,
} as const;

/**
 * Ask the AI Marketing Assistant. Reuse the same `sessionId` for every
 * call within one panel session — the backend groups audit rows by it.
 *
 * `messages` must:
 *   - alternate user → assistant → user → … (strict)
 *   - start with `user`
 *   - end with `user`
 *   - total ≤ MARKETING_LIMITS.maxMessages
 *
 * Errors the panel should be ready to render:
 *   - 401 → shop session expired; nudge re-login.
 *   - 400 → validation failure; the message will say what.
 *   - 429 → AI monthly budget exhausted OR 50-drafts/day limit hit.
 *   - 503 → AI service degraded; retry later.
 */
export const askMarketing = async (
  sessionId: string,
  messages: MarketingMessage[]
): Promise<MarketingResponse> => {
  const response = await apiClient.post(
    "/ai/marketing-chat",
    {
      sessionId,
      messages,
    },
    // The marketing assistant can call image tools — gpt-image-1 landscape gen
    // has been observed up to ~81s, plus storage + LLM round-trips. Match the
    // backend's 240s ceiling for this route, or a worst-case regenerate times out.
    { timeout: 240000 }
  );
  // Axios interceptor pre-unwraps response.data — call sites should read
  // response.data.X not response.data.data.X. The `|| response.data`
  // fallback covers any interceptor-bypass edge case.
  return response.data.data || response.data;
};
