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

export interface LeadContact {
  phone: string | null;
  email: string | null;
  messengerId?: string | null;
  whatsappId?: string | null;
}

export class LeadChannelSender {
  /** PURE — best channel for a lead from its contact fields. */
  static pickChannel(lead: LeadContact): MsgChannel {
    if (lead.messengerId) return 'messenger';
    if (lead.whatsappId) return 'whatsapp';
    if (lead.phone) return 'sms';
    if (lead.email) return 'email';
    return 'manual';
  }

  isTransportEnabled(): boolean {
    return process.env.ADS_LEAD_TRANSPORT_ENABLED === 'true';
  }

  /** Deliver a message. Returns the resulting delivery_status. When transport is off
   *  (or the channel is 'manual'), records without sending so the admin can relay. */
  async deliver(channel: MsgChannel, _to: LeadContact, _body: string): Promise<DeliveryStatus> {
    if (channel === 'manual' || !this.isTransportEnabled()) {
      return 'recorded';
    }
    // A real provider (Twilio for sms, Meta for messenger/whatsapp, an email service
    // for email) plugs in here. Left unwired to avoid sending untested live messages;
    // queue it so it's visibly pending rather than silently delivered.
    logger.warn(`LeadChannelSender: transport enabled but ${channel} provider not wired — queued`);
    return 'queued';
  }
}

export const leadChannelSender = new LeadChannelSender();
