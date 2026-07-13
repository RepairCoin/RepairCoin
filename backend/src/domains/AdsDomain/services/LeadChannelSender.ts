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
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { messengerService } from './MessengerService';
import { twilioService } from '../../../services/TwilioService';
import { smsOptOutRepository } from '../../../repositories/SmsOptOutRepository';
import { normalizePhone } from '../../../utils/phone';
import { decryptToken } from '../../../utils/tokenCrypto';
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
    private readonly leads = new LeadRepository(),
    private readonly metaConnections = new MetaConnectionRepository(),
    private readonly messenger = messengerService,
    private readonly sms = twilioService,
    private readonly optOuts = smsOptOutRepository
  ) {}

  /** PURE — best channel for a lead from its contact fields. Messenger/WhatsApp (the chat moat)
   *  win when present. Email is preferred over SMS even though both are wired now (Twilio) — email is
   *  free per message and carries no opt-out/TCPA cost — so SMS is the fallback for a phone-only lead. */
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
    // Email (Resend), Messenger (Send API) and SMS (Twilio) are wired. WhatsApp still needs a provider,
    // so it queues (visibly pending) rather than silently "delivered".
    if (channel === 'email') {
      return this.deliverEmail(to, body);
    }
    if (channel === 'messenger') {
      return this.deliverMessenger(to, body);
    }
    if (channel === 'sms') {
      return this.deliverSms(to, body);
    }
    logger.warn(`LeadChannelSender: transport enabled but ${channel} provider not wired — queued`);
    return 'queued';
  }

  private smsEnabled(): boolean {
    return process.env.ADS_SMS_ENABLED === 'true';
  }

  /** Send an SMS to the lead's phone via Twilio. Gated by ADS_SMS_ENABLED AND the shared
   *  TWILIO_SMS_ENABLED master — queues when either is off or there's no phone. Checks the GLOBAL
   *  opt-out list first (a STOP suppresses ALL platform SMS) → 'recorded' (captured, not sent) when
   *  opted out. Otherwise returns Twilio's 'sent'/'failed'. */
  private async deliverSms(to: LeadContact, body: string): Promise<DeliveryStatus> {
    if (!this.smsEnabled() || !this.sms.enabled()) {
      logger.warn('SMS transport off (ADS_SMS_ENABLED / TWILIO_SMS_ENABLED) — queued');
      return 'queued';
    }
    const phone = normalizePhone(to.phone);
    if (!phone) return 'queued';
    if (await this.optOuts.isOptedOut(phone).catch(() => false)) {
      logger.info('LeadChannelSender: recipient has opted out of SMS — suppressed (recorded)');
      return 'recorded';
    }
    // Delivery updates (sent→delivered/failed) POST back to the shared Twilio webhook when we know our URL.
    const statusCallback = process.env.TWILIO_WEBHOOK_URL
      || (process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/api/ads/webhooks/twilio` : undefined);
    const result = await this.sms.sendSms(phone, body, statusCallback);
    if (result.status === 'sent') return 'sent';
    if (result.status === 'failed') return 'failed';
    return 'queued'; // 'disabled' safety net (shouldn't reach here — enabled() checked above)
  }

  /** Send to a lead's Messenger PSID via the shop's connected Page (Send API). Gated by
   *  ADS_MESSENGER_ENABLED; queues (records) when off, no PSID, or the shop has no connected Page. */
  private async deliverMessenger(to: LeadContact, body: string): Promise<DeliveryStatus> {
    if (!this.messenger.enabled()) { logger.warn('Messenger transport off (ADS_MESSENGER_ENABLED) — queued'); return 'queued'; }
    if (!to.messengerId) return 'queued';
    const campaign = to.campaignId ? await this.campaigns.findById(to.campaignId) : null;
    if (!campaign) return 'queued';
    const conn = await this.metaConnections.getConnection(campaign.shopId);
    if (!conn?.pageId || !conn.pageTokenEnc) { logger.warn('Messenger: shop has no connected Page — queued'); return 'queued'; }
    return this.messenger.send(conn.pageId, decryptToken(conn.pageTokenEnc), to.messengerId, body);
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
