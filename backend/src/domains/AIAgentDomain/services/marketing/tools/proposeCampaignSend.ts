// backend/src/domains/AIAgentDomain/services/marketing/tools/proposeCampaignSend.ts
//
// Tool: propose_campaign_send
//
// Mutating-adjacent. Validates that a draft campaign exists, is owned
// by the JWT shop, and is in 'draft' status — then emits a
// campaign_send proposal the frontend renders as an inline "send it
// now" chip. Tapping fires the existing
//   POST /api/marketing/campaigns/:id/send
// endpoint from the client, which actually performs the SendGrid send.
//
// This tool exists for the iteration loop where the shop has already
// reviewed a draft via the CampaignDraftCard modal and is asking AI to
// fire it from chat ("looks good, send it"). In that case opening the
// modal again would be friction; an inline confirm is enough.
//
// Modal-confirm via CampaignDraftCard remains the primary destructive
// gate (scope §5 Q4). This propose_campaign_send tool only kicks in
// when the shop already reviewed the draft. The frontend may choose to
// route this back through the same modal anyway for safety — the chip
// is a UX option, not a bypass.
//
// Shop-scoping invariant: ctx.shopId is the JWT shop. Validate that
// the draft belongs to this shop; reject otherwise.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";
import { MarketingCampaignRepository } from "../../../../../repositories/MarketingCampaignRepository";

const NAME = "propose_campaign_send";

export const proposeCampaignSend: MarketingTool = {
  name: NAME,
  description:
    "Propose sending an existing draft campaign to its audience. Call " +
    "this when the shop has already reviewed the draft (you proposed " +
    "it via propose_campaign_draft) and is now asking you to fire it " +
    "from chat (\"send it\", \"go ahead\", \"looks good, ship it\"). The " +
    "shop still gets a final inline confirm chip before the send fires. " +
    "Only valid for campaigns in 'draft' status. Use the campaign_id " +
    "from the previous propose_campaign_draft call.",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description:
          "Id of the draft campaign to send. Must be the id returned by " +
          "a previous propose_campaign_draft call in this session.",
      },
    },
    required: ["campaign_id"],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const campaignId = String(
      (args as { campaign_id?: unknown }).campaign_id ?? ""
    ).trim();
    if (!campaignId) {
      throw new Error(`${NAME}: campaign_id is required`);
    }

    const campaignRepo = new MarketingCampaignRepository();
    const campaign = await campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new Error(`${NAME}: campaign not found (${campaignId})`);
    }
    if (campaign.shopId !== ctx.shopId) {
      // Hide the existence — never confirm/deny ownership across shops.
      throw new Error(`${NAME}: campaign not found (${campaignId})`);
    }
    if (campaign.status !== "draft") {
      throw new Error(
        `${NAME}: campaign is in '${campaign.status}' status; only 'draft' campaigns can be proposed for send`
      );
    }

    // We don't pre-compute recipient count here — it was already
    // resolved when the draft was created. Trust the persisted
    // total_recipients (set on send) or fall back to 0 if not yet sent.
    // For the chip render the shop already saw the count in the draft
    // card; this is just a confirmation handle.

    return {
      data: {
        campaign_id: campaign.id,
        subject: campaign.subject,
        audience_type: campaign.audienceType,
        status: campaign.status,
        recipient_count: campaign.totalRecipients,
      },
      display: {
        kind: "campaign_send",
        campaignId: campaign.id,
        recipientCount: campaign.totalRecipients,
      },
    };
  },
};
