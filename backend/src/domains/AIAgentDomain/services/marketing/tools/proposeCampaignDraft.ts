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
import { isWelcomeRcnEnabled, resolveWelcomeRcnAmount } from "../../../../../config/welcomeRcn";

const NAME = "propose_campaign_draft";
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 8000;

type ResolvedAudienceType =
  | "all_customers"
  | "top_spenders"
  | "frequent_visitors"
  | "active_customers"
  | "custom"
  | "imported_winback";

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
          "imported_winback",
        ],
        description:
          "Resolved audience type from a previous lookup_audience_count " +
          "call. Use exactly the audience_type returned there. " +
          "'imported_winback' = migrated/Square customers — draft migration " +
          "copy (claim your account, history preserved), not lapsed copy.",
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
      reward_mode: {
        type: "string",
        enum: ["flat", "by_tier", "by_spend"],
        description:
          "How the RCN amount is decided (only with a reward). 'flat' (default) " +
          "= the same reward_rcn for everyone. 'by_tier' = different amounts per " +
          "loyalty tier (set reward_rcn_by_tier). 'by_spend' = amounts by how much " +
          "the customer has spent at the shop (set reward_spend_bands). Use a " +
          "variable mode only when the owner asks to reward customers differently.",
      },
      reward_rcn_by_tier: {
        type: "object",
        description:
          "RCN per loyalty tier for reward_mode='by_tier', e.g. " +
          '{"GOLD": 50, "SILVER": 25, "BRONZE": 10}. Keys are BRONZE/SILVER/GOLD; ' +
          "omit a tier to give it nothing.",
      },
      reward_spend_bands: {
        type: "array",
        description:
          "RCN by spend for reward_mode='by_spend'. A customer gets the rcn of " +
          "the HIGHEST band whose minSpend they've reached, e.g. " +
          '[{"minSpend":0,"rcn":10},{"minSpend":500,"rcn":25},{"minSpend":1000,"rcn":50}].',
        items: {
          type: "object",
          properties: {
            minSpend: { type: "number", minimum: 0 },
            rcn: { type: "number", minimum: 0 },
          },
          required: ["minSpend", "rcn"],
        },
      },
      coupon_rcn: {
        type: "number",
        minimum: 1,
        maximum: 10000,
        description:
          "Optional, ALTERNATIVE to reward_rcn. Issues a one-per-customer COUPON " +
          "CODE that grants this many BONUS RCN when the customer redeems it on " +
          "their next visit (the shop enters the code when issuing their repair " +
          "reward). Unlike reward_rcn (issued automatically), a coupon is claimed " +
          "by returning. Only set when the owner asks for a redeemable code. The " +
          "code is generated and added to the email automatically — don't invent one.",
      },
      coupon_expires_days: {
        type: "number",
        minimum: 1,
        maximum: 365,
        description: "Days the coupon code stays valid. Only with coupon_rcn. Default 60.",
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
    // `let` because the welcome-RCN guard below may rewrite the figures (see normalizeWelcomeRcnFigures).
    let subject = String(a.subject ?? "").trim();
    let body = String(a.body ?? "").trim();
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
    const rewardMode: "flat" | "by_tier" | "by_spend" =
      a.reward_mode === "by_tier" ? "by_tier" : a.reward_mode === "by_spend" ? "by_spend" : "flat";
    const rewardByTier =
      rewardMode === "by_tier" && a.reward_rcn_by_tier && typeof a.reward_rcn_by_tier === "object"
        ? (a.reward_rcn_by_tier as Record<string, number>)
        : null;
    const rewardSpendBands =
      rewardMode === "by_spend" && Array.isArray(a.reward_spend_bands)
        ? (a.reward_spend_bands as Array<{ minSpend: number; rcn: number }>)
        : null;
    const couponRcn =
      typeof a.coupon_rcn === "number" && a.coupon_rcn > 0 ? a.coupon_rcn : 0;
    const couponExpiresDays =
      typeof a.coupon_expires_days === "number" && a.coupon_expires_days > 0
        ? Math.min(365, Math.round(a.coupon_expires_days))
        : 60;

    if (!subject || !body || !campaignName || !audienceLabel) {
      throw new Error(
        `${NAME}: subject, body, campaign_name, and audience_label are all required`
      );
    }

    // Welcome-RCN guard — the single deterministic chokepoint that makes the welcome reward
    // appear correctly in EVERY imported_winback draft, regardless of which panel/prompt produced
    // it. This tool is shared by both the Marketing panel (which has the welcome context) and the
    // unified assistant (which does NOT), and the model sometimes rounds the amount or omits it
    // entirely — so we don't rely on the prompt here. For imported_winback drafts with an ACTIVE
    // welcome reward we: (1) rewrite any RCN/dollar figures to the real numbers, then (2) inject a
    // reward line if the body doesn't mention RCN at all. Scoped to imported_winback so other
    // campaign types' numbers are never touched.
    // Welcome-RCN amount actually in play for this draft (0 = none). Surfaced in the tool result
    // (so the assistant's prose can state it) and the display (so the card shows a reward chip).
    let welcomeRewardRcn = 0;
    if (audienceType === "imported_winback") {
      const welcomeAmount = await resolveActiveWelcomeAmount(ctx.pool, ctx.shopId);
      if (welcomeAmount && welcomeAmount > 0) {
        welcomeRewardRcn = welcomeAmount;
        subject = normalizeWelcomeRcnFigures(subject, welcomeAmount);
        let fixedBody = normalizeWelcomeRcnFigures(body, welcomeAmount);
        // Inject unless the body already states a NUMERIC RCN amount. Checking for the bare word
        // "RCN" isn't enough — the model often writes "earn RCN rewards" with no number, which
        // would leave the email advertising a reward with no value. Require "<number> RCN".
        if (!/\d[\d,]*(?:\.\d+)?\s*RCN\b/i.test(fixedBody)) {
          // No concrete amount in the copy — inject the real one so the email always states it.
          fixedBody = injectWelcomeRcnLine(fixedBody, welcomeAmount);
          logger.info("propose_campaign_draft: injected missing welcome-RCN line", {
            shopId: ctx.shopId,
            welcomeAmount,
          });
        } else if (fixedBody !== body) {
          logger.info("propose_campaign_draft: corrected welcome-RCN figures to the real amount", {
            shopId: ctx.shopId,
            welcomeAmount,
          });
        }
        body = fixedBody;
      }
      // Strip the model's fake bracketed CTA (e.g. "[Claim Your Account]") — it renders as dead
      // literal text. A real claim button block is appended to the email below.
      body = stripBracketCtas(body);
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
      audienceFilters,
      'email'
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
    // Imported-customer win-back: append a REAL claim CTA button. The model only writes text, so
    // its "[Claim Your Account]" is dead literal text (already stripped from the body above) — here
    // we add an actual button block linking to the customer dashboard, where the account-claim
    // banner prompts after the customer logs in / signs up with the matching email/phone. Without
    // this the receiver has no way to act on "claim your account".
    if (audienceType === "imported_winback") {
      blocks.push({
        type: "button",
        content: "Claim Your Account",
        url: "/customer",
        style: { backgroundColor: "#eab308", textColor: "#000" },
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
    const hasReward =
      (rewardMode === "flat" && rewardRcn > 0) ||
      (rewardMode === "by_tier" && !!rewardByTier && Object.values(rewardByTier).some((v) => Number(v) > 0)) ||
      (rewardMode === "by_spend" && !!rewardSpendBands && rewardSpendBands.some((b) => Number(b.rcn) > 0));

    let reward: {
      summary: string;
      rcnPerRecipient?: number;
      totalRcn?: number;
      fulfillment: "on_send" | "on_return";
      returnWindowDays: number | null;
    } | null = null;
    let rewardUnavailable = false;

    if (hasReward) {
      if (await marketingService.isCampaignRewardsEnabled(ctx.shopId)) {
        await marketingService.setCampaignReward(campaign.id, {
          rewardType: "rcn",
          rewardMode,
          rewardRcnAmount: rewardMode === "flat" ? rewardRcn : null,
          rewardRcnByTier: rewardMode === "by_tier" ? rewardByTier : null,
          rewardSpendBands: rewardMode === "by_spend" ? rewardSpendBands : null,
          fulfillmentTrigger: rewardFulfillment,
          returnWindowDays: rewardFulfillment === "on_return" ? returnWindowDays : null,
        });
        const flat = rewardMode === "flat";
        reward = {
          summary: buildRewardSummary(rewardMode, rewardRcn, rewardByTier, rewardSpendBands, recipientCount),
          rcnPerRecipient: flat ? rewardRcn : undefined,
          totalRcn: flat ? rewardRcn * recipientCount : undefined,
          fulfillment: rewardFulfillment,
          returnWindowDays: rewardFulfillment === "on_return" ? returnWindowDays : null,
        };
      } else {
        rewardUnavailable = true;
      }
    }

    // Campaign coupon (Phase 4) — a one-per-customer RCN-bonus code. The actual
    // CODE is minted at SEND time (MarketingService.sendCampaign), NOT here, so
    // re-drafting (e.g. adding a banner) doesn't spawn extra orphaned codes. Here
    // we only persist the coupon CONFIG; the send injects the code into the email
    // and links the promo code to the campaign. Mutually exclusive with an RCN
    // reward; only when the owner asked for a code.
    let coupon: { code: string | null; bonusRcn: number; expiresAt: string } | null = null;
    if (!hasReward && couponRcn > 0) {
      if (await marketingService.isCampaignRewardsEnabled(ctx.shopId)) {
        const expiresAt = new Date(Date.now() + couponExpiresDays * 86400000);
        await marketingService.updateCampaign(campaign.id, {
          couponValue: couponRcn,
          couponType: "fixed",
          couponExpiresAt: expiresAt,
        });
        await marketingService.setCampaignReward(campaign.id, { rewardType: "coupon" });
        coupon = { code: null, bonusRcn: couponRcn, expiresAt: expiresAt.toISOString() };
      } else {
        rewardUnavailable = true;
      }
    }

    logger.info(`${NAME}: drafted campaign ${campaign.id} for shop ${ctx.shopId}`, {
      audienceType,
      recipientCount,
      rewardRcn: reward ? rewardRcn : 0,
      coupon: coupon ? coupon.code : null,
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
              summary: reward.summary,
              mode: rewardMode,
              rcn_per_recipient: reward.rcnPerRecipient ?? null,
              total_rcn: reward.totalRcn ?? null,
              fulfillment: reward.fulfillment,
              return_window_days: reward.returnWindowDays,
            }
          : null,
        coupon: coupon
          ? { code: coupon.code, bonus_rcn: coupon.bonusRcn, expires_at: coupon.expiresAt }
          : null,
        // True when the shop asked for a reward/coupon but campaign rewards aren't
        // enabled for them — tell the owner it was drafted without it.
        reward_unavailable: rewardUnavailable,
        // Welcome-on-claim RCN baked into this win-back draft (0 = none). When >0, TELL THE OWNER
        // in your reply that the campaign offers this welcome reward (e.g. "it offers a 30 RCN
        // welcome reward when they claim"). This is the migration incentive, separate from any
        // campaign send-reward above.
        welcome_reward_rcn: welcomeRewardRcn || null,
      },
      display: {
        kind: "campaign_draft",
        campaignId: campaign.id,
        subject,
        bodyPreview: truncate(body, 280),
        // Full body for the review modal (the card uses bodyPreview).
        body,
        channel: "email",
        audienceLabel,
        recipientCount,
        imageUrl: bannerImageUrl,
        estimatedRevenue: { lowUsd: revenue.lowUsd, highUsd: revenue.highUsd },
        reward: reward
          ? {
              summary: reward.summary,
              rcnPerRecipient: reward.rcnPerRecipient,
              totalRcn: reward.totalRcn,
              fulfillment: reward.fulfillment,
              returnWindowDays: reward.returnWindowDays,
            }
          : undefined,
        coupon: coupon
          ? { code: coupon.code, bonusRcn: coupon.bonusRcn, expiresAt: coupon.expiresAt }
          : undefined,
        // Welcome-on-claim reward baked into this win-back draft (omitted when none) — the card
        // renders a chip so the owner sees the incentive without reading the full body.
        welcomeRewardRcn: welcomeRewardRcn > 0 ? welcomeRewardRcn : undefined,
        // Label of the real CTA button appended to imported_winback emails — so the preview shows
        // it (the preview renders text only, not the designContent button block).
        claimCtaLabel: audienceType === "imported_winback" ? "Claim Your Account" : undefined,
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

/**
 * Resolve the active welcome-RCN amount for a shop (or null when the feature/flag/opt-in is off).
 * Mirrors the claim-time resolution: platform flag → shop opt-in → per-shop override or default.
 */
async function resolveActiveWelcomeAmount(
  pool: { query: (text: string, params: unknown[]) => Promise<{ rows: any[] }> },
  shopId: string
): Promise<number | null> {
  if (!isWelcomeRcnEnabled()) return null;
  try {
    const r = await pool.query(
      `SELECT welcome_rcn_enabled, welcome_rcn_amount FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    const row = r.rows[0];
    if (!row || row.welcome_rcn_enabled !== true) return null;
    const override = row.welcome_rcn_amount != null ? parseFloat(row.welcome_rcn_amount) : null;
    return resolveWelcomeRcnAmount(override);
  } catch {
    return null;
  }
}

/**
 * Strip the model's fake call-to-action — a line that's just a bracketed label like
 * "[Claim Your Account]" or a markdown link "[Claim](...)" — since the email renderer shows it as
 * dead literal text. A real button block is added separately. Only removes lines that are ENTIRELY
 * such a token (optionally with surrounding whitespace), so prose with incidental brackets is safe.
 * Collapses any blank-line gap the removal leaves behind.
 */
function stripBracketCtas(body: string): string {
  return body
    .split("\n")
    .filter((line) => !/^\s*\[[^\]]+\](?:\([^)]*\))?\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Inject a welcome-reward sentence when the model omitted it entirely. Placed right after the
 * first paragraph (the greeting) so it's prominent, or appended if the body is a single block.
 * Used only for imported_winback drafts with an active welcome reward.
 */
function injectWelcomeRcnLine(body: string, rcn: number): string {
  const usd = (rcn * 0.1).toFixed(2);
  const line = `As a welcome, claim your account and get ${rcn} RCN (≈ $${usd}) added to your balance — yours to use on your next visit.`;
  const paras = body.split(/\n\s*\n/);
  if (paras.length <= 1) return `${body}\n\n${line}`;
  paras.splice(1, 0, line);
  return paras.join("\n\n");
}

/**
 * Force the exact welcome-RCN figure into AI copy. The model sometimes rounds the amount it was
 * told ("25 RCN" → "50 RCN ($5)"); this rewrites RCN counts and adjacent dollar-credit figures to
 * the real numbers (1 RCN = $0.10). Deliberately conservative on dollars — only rewrites amounts
 * that are tagged as a credit/value/reward or sit in a bare parenthetical — to avoid clobbering an
 * unrelated price. Run only for imported_winback drafts with an active welcome reward.
 */
function normalizeWelcomeRcnFigures(text: string, rcn: number): string {
  const usd = (rcn * 0.1).toFixed(2);
  return text
    // "<number> RCN" → "<rcn> RCN"
    .replace(/\d[\d,]*(?:\.\d+)?\s*RCN\b/gi, `${rcn} RCN`)
    // "$<number> credit|value|reward|in RCN" → "$<usd> <word>"
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?(\s*(?:credit|value|reward|in RCN))/gi, `$${usd}$1`)
    // bare parenthetical "($<number>)" → "($<usd>)"
    .replace(/\(\s*\$\s?\d[\d,]*(?:\.\d+)?\s*\)/g, `($${usd})`);
}

/** Human-readable one-liner for the reward shown on the draft card. */
function buildRewardSummary(
  mode: "flat" | "by_tier" | "by_spend",
  flatRcn: number,
  byTier: Record<string, number> | null,
  bands: Array<{ minSpend: number; rcn: number }> | null,
  recipientCount: number
): string {
  if (mode === "by_tier" && byTier) {
    const order = ["GOLD", "SILVER", "BRONZE"];
    const parts = order
      .filter((t) => Number(byTier[t]) > 0)
      .map((t) => `${t[0]}${t.slice(1).toLowerCase()} ${byTier[t]}`);
    return `${parts.join(" / ")} RCN each`;
  }
  if (mode === "by_spend" && bands && bands.length) {
    const rcns = bands.map((b) => Number(b.rcn)).filter((n) => n > 0);
    const lo = Math.min(...rcns);
    const hi = Math.max(...rcns);
    return lo === hi ? `${lo} RCN by spend` : `${lo}–${hi} RCN by spend`;
  }
  return `${flatRcn} RCN each · ${(flatRcn * recipientCount).toLocaleString()} RCN total`;
}
