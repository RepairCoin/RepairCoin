// backend/src/domains/AIAgentDomain/services/marketing/tools/proposeCampaignDraft.ts
//
// Tool: propose_campaign_draft
//
// Mutating. Persists a draft campaign (status='draft',
// created_by_source='ai_agent') and emits a proposal the frontend
// renders as a tap-to-open card. Tapping opens the
// CampaignReviewModal where the shop can edit subject/body and
// confirm send via the existing
//   POST /api/marketing/campaigns/:id/send
// endpoint. This tool never sends — only drafts.
//
// Why persist instead of holding the draft in memory: the shop may
// switch to the manual MarketingTab to edit, or close and reopen the
// AI panel. Persisting means the campaign id outlives the chat
// session and the existing builder UI can pick it up.
//
// Shop-scoping invariant: ctx.shopId is the JWT shop. The tool never
// reads a shopId from args.
//
// Scope §7 risk — "AI hallucinating discounts": the prompt-rule
// enforces that any offer value Claude writes into the body must echo
// a value the shop typed in the current message. This tool doesn't
// re-parse the body to validate (too brittle) — it trusts the prompt
// rule + the shop's chance to edit in the review modal before send.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { MarketingService } from "../../../../../services/MarketingService";
import { logger } from "../../../../../utils/logger";

const NAME = "propose_campaign_draft";
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 8000;

type ResolvedAudienceType =
  | "all_customers"
  | "top_spenders"
  | "frequent_visitors"
  | "active_customers"
  | "custom";

export const proposeCampaignDraft: MarketingTool = {
  name: NAME,
  description:
    "Persist a draft campaign and propose it to the shop as a tap-to-" +
    "open card. Call this AFTER you've confirmed the audience via " +
    "lookup_audience_count and you have subject + body ready. The shop " +
    "reviews, optionally edits, and taps Send in the modal — this tool " +
    "does NOT send. v1 supports email channel only. Subject ≤200 chars, " +
    "body ≤8000 chars. The body should include paragraph breaks (use " +
    "blank lines between paragraphs). NEVER include a discount value " +
    "or offer the shop didn't explicitly state in the current message — " +
    "use '(your offer here)' as a placeholder when uncertain.",
  inputSchema: {
    type: "object",
    properties: {
      audience_type: {
        type: "string",
        enum: [
          "all_customers",
          "top_spenders",
          "frequent_visitors",
          "active_customers",
          "custom",
        ],
        description:
          "Resolved audience type from a previous lookup_audience_count " +
          "call. Use exactly the audience_type returned there.",
      },
      audience_filters: {
        type: "object",
        description:
          "Resolved filters object from lookup_audience_count. Pass " +
          "through unchanged. Empty object {} when the audience type " +
          "doesn't need filters.",
      },
      audience_label: {
        type: "string",
        minLength: 1,
        maxLength: 120,
        description:
          "Human-readable label for the segment (echo the " +
          "resolved_label from lookup_audience_count). Shown to the " +
          "shop on the draft card.",
      },
      subject: {
        type: "string",
        minLength: 1,
        maxLength: MAX_SUBJECT_LENGTH,
        description:
          "Email subject line. Keep concise — emails are scanned in " +
          "previews. ≤200 chars.",
      },
      body: {
        type: "string",
        minLength: 1,
        maxLength: MAX_BODY_LENGTH,
        description:
          "Email body. Plain text with blank lines between paragraphs. " +
          "DO NOT include an unsubscribe footer — the email template " +
          "adds it automatically. NEVER include a discount value the " +
          "shop didn't explicitly state in their current message.",
      },
      campaign_name: {
        type: "string",
        minLength: 1,
        maxLength: 120,
        description:
          "Short internal name for the campaign (\"Black Friday 2026\", " +
          "\"Win-back Q2\"). Shown in the shop's campaign list. Distinct " +
          "from the subject — this is for the shop's filing, not for " +
          "customers.",
      },
    },
    required: [
      "audience_type",
      "audience_filters",
      "audience_label",
      "subject",
      "body",
      "campaign_name",
    ],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const a = args as Record<string, unknown>;
    const audienceType = a.audience_type as ResolvedAudienceType;
    const audienceFilters = (a.audience_filters as Record<string, unknown>) ?? {};
    const audienceLabel = String(a.audience_label ?? "").trim();
    const subject = String(a.subject ?? "").trim();
    const body = String(a.body ?? "").trim();
    const campaignName = String(a.campaign_name ?? "").trim();

    if (!subject || !body || !campaignName || !audienceLabel) {
      throw new Error(
        `${NAME}: subject, body, campaign_name, and audience_label are all required`
      );
    }

    const marketingService = new MarketingService();

    // Confirm the audience isn't empty before persisting — otherwise the
    // shop sees a draft card that errors at send time.
    const recipientCount = await marketingService.getAudienceCount(
      ctx.shopId,
      audienceType as any,
      audienceFilters
    );
    if (recipientCount === 0) {
      throw new Error(
        `${NAME}: resolved audience is empty (${audienceLabel}). Pick a different segment.`
      );
    }

    // Build the designContent shape the existing email renderer expects.
    // Headline = subject (mirrors what we tell the shop), text blocks =
    // paragraphs split on blank lines. Footer.showUnsubscribe=true so
    // SendGrid's compliance link renders.
    const designContent = {
      header: { enabled: true, showLogo: true, backgroundColor: "#1a1a2e" },
      blocks: bodyToBlocks(subject, body),
      footer: { showSocial: false, showUnsubscribe: true },
    };

    const campaign = await marketingService.createCampaign({
      shopId: ctx.shopId,
      name: campaignName,
      campaignType: "custom",
      subject,
      previewText: truncate(body.replace(/\s+/g, " "), 150),
      designContent,
      audienceType: audienceType as any,
      audienceFilters,
      deliveryMethod: "email",
      createdBySource: "ai_agent",
    });

    logger.info(`${NAME}: drafted campaign ${campaign.id} for shop ${ctx.shopId}`, {
      audienceType,
      recipientCount,
    });

    return {
      data: {
        campaign_id: campaign.id,
        status: campaign.status,
        recipient_count: recipientCount,
        audience_label: audienceLabel,
        subject,
        body_preview: truncate(body, 280),
      },
      display: {
        kind: "campaign_draft",
        campaignId: campaign.id,
        subject,
        bodyPreview: truncate(body, 280),
        channel: "email",
        audienceLabel,
        recipientCount,
      },
    };
  },
};

function bodyToBlocks(subject: string, body: string): Array<Record<string, unknown>> {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "headline",
      content: subject,
      style: { fontSize: "24px", fontWeight: "bold", textAlign: "center" },
    },
  ];
  for (const para of paragraphs) {
    blocks.push({
      type: "text",
      content: para,
      style: { fontSize: "14px", textAlign: "left", color: "#444" },
    });
  }
  return blocks;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}
