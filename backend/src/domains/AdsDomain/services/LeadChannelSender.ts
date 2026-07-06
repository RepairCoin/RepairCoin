// backend/src/domains/AdsDomain/services/LeadChannelSender.ts
//
// Stage 3.5 — message TRANSPORT for lead conversations. Picking the channel from a
// lead's contact fields is pure and always available. Actually SENDING (SMS via a
// carrier, WhatsApp/Messenger via Meta) needs provider credentials, so real delivery
// is gated behind ADS_LEAD_TRANSPORT_ENABLED. With it off (default), messages are
// 'recorded' — the conversation + AI replies are fully captured and an admin relays
// them by hand. Flip the flag (and wire a provider) to go fully hands-off.

import { logger } from '../../../utils/logger';
import { DeliveryStatus, MsgChannel } from '../repositories/LeadMessageRepository';
import { resendEmailService } from '../../../services/ResendEmailService';
import { shopRepository } from '../../../repositories';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { LeadRepository } from '../repositories/LeadRepository';
import { isInboundEmailEnabled, replyAddressFor } from './inboundEmailConfig';

export interface LeadContact {
  /** Lead id — used by the email channel to mint the per-lead inbound reply token. */
  id?: string | null;
  phone: string | null;
  email: string | null;
  messengerId?: string | null;
  whatsappId?: string | null;
  /** Used by the email channel to resolve the shop's from-name + reply-to (campaign → shop). */
  campaignId?: string | null;
}

/** Minimal, safe HTML from a plain-text reply body (escape + newline→<br/>). */
function bodyToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${esc.replace(/\n/g, '<br/>')}</div>`;
}

export class LeadChannelSender {
  constructor(
    private readonly campaigns = new CampaignRepository(),
    private readonly leads = new LeadRepository()
  ) {}

  /** PURE — best channel for a lead from its contact fields. Messenger/WhatsApp (the chat moat)
   *  win when present. Email is preferred over SMS because email is the only WIRED transport today
   *  (Resend); a phone-only lead still picks SMS (queued until a carrier is wired). Revisit the
   *  email-vs-SMS order once SMS transport (Twilio) lands. */
  static pickChannel(lead: LeadContact): MsgChannel {
    if (lead.messengerId) return 'messenger';
    if (lead.whatsappId) return 'whatsapp';
    if (lead.email) return 'email';
    if (lead.phone) return 'sms';
    return 'manual';
  }

  isTransportEnabled(): boolean {
    return process.env.ADS_LEAD_TRANSPORT_ENABLED === 'true';
  }

  /** Deliver a message. Returns the resulting delivery_status. When transport is off
   *  (or the channel is 'manual'), records without sending so the admin can relay. */
  async deliver(channel: MsgChannel, to: LeadContact, body: string): Promise<DeliveryStatus> {
    if (channel === 'manual' || !this.isTransportEnabled()) {
      return 'recorded';
    }
    // Email is a wired provider (Resend). SMS/Messenger/WhatsApp still need a provider, so they
    // queue (visibly pending) rather than silently "delivered".
    if (channel === 'email') {
      return this.deliverEmail(to, body);
    }
    logger.warn(`LeadChannelSender: transport enabled but ${channel} provider not wired — queued`);
    return 'queued';
  }

  /** Send a conversation reply to the lead by email via Resend. Sent under the shop's name from the
   *  FixFlow domain, reply-to = the shop's inbox (so the customer's reply reaches the shop). Returns
   *  'sent' on success, 'failed' on a send error, and 'recorded' when Resend isn't configured (so the
   *  message is still captured for manual relay rather than lost). Best-effort shop resolution. */
  private async deliverEmail(to: LeadContact, body: string): Promise<DeliveryStatus> {
    if (!to.email) return 'failed';
    if (!resendEmailService.isReady()) {
      logger.warn('LeadChannelSender: email transport on but Resend not configured — recorded for manual relay');
      return 'recorded';
    }
    let shopName = 'FixFlow';
    let replyTo: string | undefined;
    try {
      const campaign = to.campaignId ? await this.campaigns.findById(to.campaignId).catch(() => null) : null;
      const shopId = campaign?.shopId ?? null;
      const shop = shopId ? await shopRepository.getShop(shopId).catch(() => null) : null;
      shopName = (shop as any)?.name || 'FixFlow';
      replyTo = (shop as any)?.email || undefined;
      // Model B: when inbound email is on AND the AI agent is on, route replies to a per-lead address
      // WE receive (so the AI can answer) instead of the shop inbox.
      if (isInboundEmailEnabled() && campaign?.aiAgentEnabled && to.id) {
        const token = await this.leads.getOrCreateReplyToken(to.id).catch(() => null);
        if (token) replyTo = replyAddressFor(token);
      }
    } catch (e) {
      logger.warn(`LeadChannelSender: shop resolve failed for email reply: ${(e as Error)?.message || e}`);
    }
    const result = await resendEmailService.sendEmail({
      to: to.email,
      subject: `Re: your enquiry with ${shopName}`,
      html: bodyToHtml(body),
      from: { email: process.env.RESEND_FROM_EMAIL || 'leads@send.fixflow.ai', name: `${shopName} via FixFlow` },
      replyTo,
    });
    if (!result.success) {
      logger.error(`LeadChannelSender: Resend send failed for lead email: ${result.error}`);
      return 'failed';
    }
    return 'sent';
  }
}

export const leadChannelSender = new LeadChannelSender();
