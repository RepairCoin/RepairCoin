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
import { estimateCampaignRevenue } from "../estimateCampaignRevenue";

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
    "use '(your offer here)' as a placeholder when uncertain. To put a " +
    "banner IMAGE at the top of the email, pass `image_url` with the URL of " +
    "an image the shop generated/approved via propose_campaign_image OR an " +
    "existing shop photo from list_shop_photos (e.g. their storefront banner) " +
    "— if they want 'the banner I just made' but you don't have the URL, pass " +
    "any value and the most recent generated image is used.",
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
      image_url: {
        type: "string",
        description:
          "Optional. URL of a banner image to embed at the TOP of the email " +
          "(a previously generated/edited image from propose_campaign_image, " +
          "or an existing shop photo from list_shop_photos such as the " +
          "storefront banner). Omit for a text-only campaign. A non-shop URL " +
          "or a placeholder falls back to the shop's most recently generated " +
          "image.",
      },
      reward_rcn: {
        type: "number",
        minimum: 1,
        maximum: 10000,
        description:
          "Optional. RCN tokens to give EACH recipient (1 RCN = $0.10, drawn " +
          "from the shop's purchased RCN balance). Only set this when the shop " +
          "explicitly asks to include a reward (e.g. 'send 25 RCN to lapsed " +
          "customers'). Omit for a no-reward campaign. When set, you MAY state " +
          "the exact amount in the body. The shop confirms the cost before send.",
      },
      reward_fulfillment: {
        type: "string",
        enum: ["on_send", "on_return"],
        description:
          "When the reward lands (only with reward_rcn). 'on_send' = issued " +
          "immediately when the campaign sends (a thank-you gift). 'on_return' " +
          "= issued only when the customer next completes an order within " +
          "return_window_days (best for WIN-BACK — only spends on customers who " +
          "actually come back). Default 'on_send'. Prefer 'on_return' for " +
          "lapsed / win-back audiences.",
      },
      return_window_days: {
        type: "number",
        minimum: 1,
        maximum: 365,
        description:
          "Days an on_return reward stays claimable after send. Only used when " +
          "reward_fulfillment='on_return'. Default 30.",
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
    const providedImageUrl =
      typeof a.image_url === "string" ? a.image_url.trim() : "";
    const rewardRcn =
      typeof a.reward_rcn === "number" && a.reward_rcn > 0 ? a.reward_rcn : 0;
    const rewardFulfillment: "on_send" | "on_return" =
      a.reward_fulfillment === "on_return" ? "on_return" : "on_send";
    const returnWindowDays =
      typeof a.return_window_days === "number" && a.return_window_days > 0
        ? Math.min(365, Math.round(a.return_window_days))
        : 30;

    if (!subject || !body || !campaignName || !audienceLabel) {
      throw new Error(
        `${NAME}: subject, body, campaign_name, and audience_label are all required`
      );
    }

    // Resolve an optional banner image to embed at the top of the email. Only
    // ever embed a SHOP-OWNED image (shopId from the JWT). When the model
    // supplies a URL that isn't recognizably this shop's (cross-turn URL gap /
    // placeholder), fall back to the shop's most recent generated image —
    // same robustness pattern as proposeImageEdit.
    const bannerImageUrl = await resolveBannerImage(ctx, providedImageUrl);

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

    // Phase 2 — a rough revenue-opportunity estimate so "Do it" has a number
    // attached. Best-effort; never blocks the draft.
    const revenue = await estimateCampaignRevenue(
      ctx.pool,
      ctx.shopId,
      recipientCount
    );

    // Build the designContent shape the existing email renderer expects.
    // Headline = subject (mirrors what we tell the shop), text blocks =
    // paragraphs split on blank lines. Footer.showUnsubscribe=true so
    // SendGrid's compliance link renders.
    const blocks = bodyToBlocks(subject, body);
    if (bannerImageUrl) {
      // Banner at the very top (above the headline) — the email renderer's
      // 'image' block (MarketingService.renderBlock) draws it.
      blocks.unshift({
        type: "image",
        src: bannerImageUrl,
        style: { maxWidth: "100%" },
      });
    }
    const designContent = {
      header: { enabled: true, showLogo: true, backgroundColor: "#1a1a2e" },
      blocks,
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

    // Campaign reward (Phase 1: flat on_send RCN). Only persist it when the
    // admin has enabled rewards for this shop — otherwise the card would promise
    // a reward the send can't deliver. When unavailable we draft text-only and
    // flag it so the assistant can tell the owner.
    let reward: {
      rcnPerRecipient: number;
      totalRcn: number;
      fulfillment: "on_send" | "on_return";
      returnWindowDays: number | null;
    } | null = null;
    let rewardUnavailable = false;
    if (rewardRcn > 0) {
      if (await marketingService.isCampaignRewardsEnabled(ctx.shopId)) {
        await marketingService.setCampaignReward(campaign.id, {
          rewardType: "rcn",
          rewardMode: "flat",
          rewardRcnAmount: rewardRcn,
          fulfillmentTrigger: rewardFulfillment,
          returnWindowDays: rewardFulfillment === "on_return" ? returnWindowDays : null,
        });
        reward = {
          rcnPerRecipient: rewardRcn,
          totalRcn: rewardRcn * recipientCount,
          fulfillment: rewardFulfillment,
          returnWindowDays: rewardFulfillment === "on_return" ? returnWindowDays : null,
        };
      } else {
        rewardUnavailable = true;
      }
    }

    logger.info(`${NAME}: drafted campaign ${campaign.id} for shop ${ctx.shopId}`, {
      audienceType,
      recipientCount,
      rewardRcn: reward ? rewardRcn : 0,
    });

    return {
      data: {
        campaign_id: campaign.id,
        status: campaign.status,
        recipient_count: recipientCount,
        audience_label: audienceLabel,
        subject,
        body_preview: truncate(body, 280),
        image_embedded: Boolean(bannerImageUrl),
        estimated_revenue: {
          low_usd: revenue.lowUsd,
          high_usd: revenue.highUsd,
          avg_order_value_usd: revenue.avgOrderValueUsd,
          assumptions: revenue.assumptions,
        },
        reward: reward
          ? {
              rcn_per_recipient: reward.rcnPerRecipient,
              total_rcn: reward.totalRcn,
              fulfillment: reward.fulfillment,
              return_window_days: reward.returnWindowDays,
            }
          : null,
        // True when the shop asked for a reward but campaign rewards aren't
        // enabled for them — tell the owner it was drafted without the reward.
        reward_unavailable: rewardUnavailable,
      },
      display: {
        kind: "campaign_draft",
        campaignId: campaign.id,
        subject,
        bodyPreview: truncate(body, 280),
        channel: "email",
        audienceLabel,
        recipientCount,
        imageUrl: bannerImageUrl,
        estimatedRevenue: { lowUsd: revenue.lowUsd, highUsd: revenue.highUsd },
        reward: reward
          ? {
              rcnPerRecipient: reward.rcnPerRecipient,
              totalRcn: reward.totalRcn,
              fulfillment: reward.fulfillment,
              returnWindowDays: reward.returnWindowDays,
            }
          : undefined,
      },
    };
  },
};

/** Resolve an optional banner image to embed, shop-scoped. Returns the URL to
 *  embed or null (text-only). Only shop-owned images are embedded; an
 *  unrecognized/placeholder URL falls back to the shop's most recent generated
 *  image (mirrors proposeImageEdit's cross-turn fallback). */
async function resolveBannerImage(
  ctx: MarketingToolContext,
  provided: string
): Promise<string | null> {
  if (!provided) return null;
  if (provided.includes(`/shops/${ctx.shopId}/`)) return provided;
  const r = await ctx.pool.query<{ image_url: string }>(
    `SELECT image_url FROM ai_image_generations
      WHERE shop_id = $1 AND image_url IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [ctx.shopId]
  );
  return r.rows[0]?.image_url ?? null;
}

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
