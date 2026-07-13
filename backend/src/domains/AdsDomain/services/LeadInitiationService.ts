// backend/src/domains/AdsDomain/services/LeadInitiationService.ts
//
// AI-initiated first contact (Part B). On LEAD_CAPTURED, when the lead's campaign is in 'auto' outreach
// mode and the lead is fresh + contactable, the AI drafts and SENDS the first message — brand-grounded
// and spend-capped (LeadAIService.draftOutreach) — on the lead's best channel (Messenger/WhatsApp/email/
// SMS via pickChannel), so a phone-only lead gets texted first. Replies loop back to the reply engine
// (LeadAutoAnswerService) per channel. Gated by ADS_AI_INITIATE_ENABLED (off by default). Non-throwing.
// See docs/tasks/strategy/ads-system/ads-lead-conversation-and-ai-outreach-scope.md (Part B).

import { logger } from '../../../utils/logger';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { LeadMessageRepository } from '../repositories/LeadMessageRepository';
import { leadAIService, LeadAIService } from './LeadAIService';
import { LeadChannelSender } from './LeadChannelSender';

export type InitiationOutcome =
  | 'sent' | 'disabled' | 'no_campaign' | 'mode_not_auto' | 'no_lead'
  | 'no_channel' | 'already_worked' | 'already_messaged' | 'draft_failed';

export class LeadInitiationService {
  constructor(
    private readonly leads = new LeadRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly messages = new LeadMessageRepository(),
    private readonly ai: Pick<LeadAIService, 'draftOutreach'> = leadAIService,
    private readonly channel = new LeadChannelSender()
  ) {}

  enabled(): boolean { return process.env.ADS_AI_INITIATE_ENABLED === 'true'; }

  /** Auto-send a first outreach for a freshly captured lead when eligible. Never throws. */
  async onLeadCaptured(leadId: string, campaignId: string): Promise<InitiationOutcome> {
    if (!this.enabled()) return 'disabled';

    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) return 'no_campaign';
    // v1 auto-sends only in 'auto' mode; 'off'/'draft' leave first contact to the human (the manual
    // draft button still works). Distinct from ai_agent_enabled (which answers inbound replies).
    if (campaign.aiOutreachMode !== 'auto') return 'mode_not_auto';

    const lead = await this.leads.findById(leadId);
    if (!lead) return 'no_lead';
    // Channel-aware: reach the lead on their best available channel (Messenger/WhatsApp/email/SMS).
    // A phone-only lead now gets TEXTED first (Twilio) instead of being skipped; 'manual' = no
    // contactable channel at all.
    const channel = LeadChannelSender.pickChannel(lead);
    if (channel === 'manual') return 'no_channel';

    // Idempotency: only a brand-new, untouched lead. The dedupe path returns an existing lead id, so a
    // re-capture can re-enter here — the status guard + the message check prevent a double-send.
    if (lead.leadStatus !== 'new' || lead.firstResponseAt) return 'already_worked';
    if ((await this.messages.listByLead(leadId, 1)).length) return 'already_messaged';

    let draft: string;
    try {
      draft = (await this.ai.draftOutreach(leadId)).draft; // brand-grounded + spend-capped (throws 429 when over budget)
    } catch (err: any) {
      logger.warn('LeadInitiation: draft skipped', { leadId, error: err?.message || err });
      return 'draft_failed';
    }

    // Sends when ADS_LEAD_TRANSPORT_ENABLED is on; records-for-manual-relay otherwise. Either way the
    // message lands in the thread the shop sees. Replies loop back to the AI per channel — email via the
    // reply-to token, SMS via the Twilio inbound webhook (findByPhone), Messenger via the Send webhook.
    const status = await this.channel.deliver(channel, lead, draft);
    await this.messages.append({ leadId, direction: 'outbound', author: 'ai', channel, body: draft, deliveryStatus: status });
    // Record speed-to-lead, but DON'T advance the pipeline stage — an AI email isn't a human 'contacted'
    // milestone. Conversation state ('ai_engaged') expresses "AI reached out"; the funnel stays honest.
    await this.leads.stampFirstResponse(leadId);
    logger.info('LeadInitiation: AI first outreach sent', { leadId, campaignId, status });
    return 'sent';
  }
}

export const leadInitiationService = new LeadInitiationService();
