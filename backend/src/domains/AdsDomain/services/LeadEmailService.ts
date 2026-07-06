// backend/src/domains/AdsDomain/services/LeadEmailService.ts
//
// Ads lead follow-up — Phase 2. Sends a one-off email to an ad lead via Resend, then records it
// on BOTH surfaces the rest of the system reads: the lead activity timeline (an `email` activity)
// and the lead conversation thread (an outbound `admin`/`email` message). Reply-to is the shop's
// own inbox, so the customer's reply goes straight to the shop, not the FixFlow sending domain.
// Gracefully reports "not configured" when Resend isn't set up — the UI falls back to mailto:.
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import { logger } from '../../../utils/logger';
import { resendEmailService } from '../../../services/ResendEmailService';
import { shopRepository } from '../../../repositories';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { AdLeadActivityRepository } from '../repositories/AdLeadActivityRepository';
import { LeadMessageRepository } from '../repositories/LeadMessageRepository';
import { isInboundEmailEnabled, replyAddressFor } from './inboundEmailConfig';

export interface SendLeadEmailInput {
  leadId: string;
  subject: string;
  html: string;
  actorAddress?: string | null;
}

export interface SendLeadEmailResult {
  success: boolean;
  messageId?: string;
}

export class LeadEmailService {
  constructor(
    private readonly leads = new LeadRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly activities = new AdLeadActivityRepository(),
    private readonly messages = new LeadMessageRepository()
  ) {}

  async send(input: SendLeadEmailInput): Promise<SendLeadEmailResult> {
    const subject = (input.subject || '').trim();
    const html = (input.html || '').trim();
    if (!subject) throw Object.assign(new Error('Subject is required'), { status: 400 });
    if (!html) throw Object.assign(new Error('Message body is required'), { status: 400 });

    const lead = await this.leads.findById(input.leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    if (!lead.email) throw Object.assign(new Error('This lead has no email address'), { status: 400 });

    // Email goes out under the shop's name from the FixFlow sending domain. Reply-to is normally the
    // shop's own inbox — but when inbound email is on AND the campaign's AI agent is on, route replies
    // to a per-lead address WE receive (so the AI can answer them). See inboundEmailConfig.
    const campaign = await this.campaigns.findById(lead.campaignId).catch(() => null);
    const shopId = campaign?.shopId ?? null;
    const shop = shopId ? await shopRepository.getShop(shopId).catch(() => null) : null;
    const shopName = (shop as any)?.name || 'FixFlow';
    let replyTo = (shop as any)?.email || undefined;
    if (isInboundEmailEnabled() && campaign?.aiAgentEnabled) {
      const token = await this.leads.getOrCreateReplyToken(lead.id).catch(() => null);
      if (token) replyTo = replyAddressFor(token);
    }

    if (!resendEmailService.isReady()) {
      // Surface a clear, typed error so the UI can fall back to mailto: instead of failing hard.
      throw Object.assign(new Error('Email sending is not configured yet.'), { status: 503, code: 'email_not_configured' });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'leads@send.fixflow.ai';
    const result = await resendEmailService.sendEmail({
      to: lead.email,
      subject,
      html,
      from: { email: fromEmail, name: `${shopName} via FixFlow` },
      replyTo,
    });

    if (!result.success) {
      throw Object.assign(new Error(result.error || 'Failed to send email'), { status: 502 });
    }

    // Record on both surfaces (best-effort — a logging failure must not turn a sent email into an
    // error response; the customer already received it).
    void this.activities
      .log({
        leadId: lead.id,
        type: 'email',
        channel: 'email',
        subject,
        body: html,
        actorAddress: input.actorAddress ?? null,
        meta: result.messageId ? { messageId: result.messageId } : {},
      })
      .catch((e) => logger.warn(`lead email activity log failed for ${lead.id}: ${e?.message || e}`));

    void this.messages
      .append({
        leadId: lead.id,
        direction: 'outbound',
        author: 'admin',
        channel: 'email',
        body: `Subject: ${subject}\n\n${html}`,
        deliveryStatus: 'sent',
      })
      .catch((e) => logger.warn(`lead email thread post failed for ${lead.id}: ${e?.message || e}`));

    // First real outbound touch → stamp first_response_at + advance new->contacted. Awaited (so it's
    // committed before the UI reloads the board), but non-fatal — the email already went out.
    await this.leads
      .markContacted(lead.id)
      .catch((e) => logger.warn(`lead email markContacted failed for ${lead.id}: ${e?.message || e}`));

    return { success: true, messageId: result.messageId };
  }
}

export const leadEmailService = new LeadEmailService();
