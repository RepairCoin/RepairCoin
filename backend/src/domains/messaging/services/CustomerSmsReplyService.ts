// backend/src/domains/messaging/services/CustomerSmsReplyService.ts
import { MessageRepository } from '../../../repositories/MessageRepository';
import { ConversationChannelIdentityRepository } from '../../../repositories/ConversationChannelIdentityRepository';
import { SmsOptOutRepository } from '../../../repositories/SmsOptOutRepository';
import { SmsNumberService } from '../../../services/SmsNumberService';
import { TwilioService, twilioService } from '../../../services/TwilioService';
import { CustomerConsentService, customerConsentService } from './CustomerConsentService';
import { logger } from '../../../utils/logger';

export type SmsReplyOutcome =
  | 'sent'
  | 'disabled' // ENABLE_CUSTOMER_SMS off, or Twilio master gate off
  | 'opted_out' // recipient is on the global SMS opt-out list
  | 'no_consent' // consent enforcement is on and the recipient hasn't opted in
  | 'no_recipient' // conversation has no SMS identity / empty reply
  | 'no_from_number' // no per-shop number and no shared TWILIO_SMS_FROM
  | 'failed';

/**
 * Relays an AI (or shop) reply that landed on a `channel='sms'` conversation back out over SMS.
 *
 * This is the OUTBOUND half of Phase 1 (AI Auto-Replies SMS). It is D2-independent: the FROM
 * number comes from SmsNumberService (per-shop number when one exists, else the shared
 * TWILIO_SMS_FROM), so it works today against the number being configured and needs no change
 * when management picks Option A/B. The recipient phone comes from the Phase-0
 * conversation_channel_identities map; the global SMS opt-out list is honored BEFORE sending.
 *
 * Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
export class CustomerSmsReplyService {
  // Deps lazily built on first use, not at construction. MessageService constructs this service in
  // its own constructor and is itself imported (as a module-level singleton) into the Twilio webhook
  // controller — eager repo construction here would run at import time and trip test mocks.
  private _messageRepo?: MessageRepository;
  private _identityRepo?: ConversationChannelIdentityRepository;
  private _optOutRepo?: SmsOptOutRepository;
  private _numberService?: SmsNumberService;
  private _twilio?: TwilioService;
  private _consent?: CustomerConsentService;

  constructor(deps: {
    messageRepo?: MessageRepository;
    identityRepo?: ConversationChannelIdentityRepository;
    optOutRepo?: SmsOptOutRepository;
    numberService?: SmsNumberService;
    twilio?: TwilioService;
    consent?: CustomerConsentService;
  } = {}) {
    this._messageRepo = deps.messageRepo;
    this._identityRepo = deps.identityRepo;
    this._optOutRepo = deps.optOutRepo;
    this._numberService = deps.numberService;
    this._twilio = deps.twilio;
    this._consent = deps.consent;
  }

  private get messageRepo(): MessageRepository {
    return (this._messageRepo ??= new MessageRepository());
  }
  private get identityRepo(): ConversationChannelIdentityRepository {
    return (this._identityRepo ??= new ConversationChannelIdentityRepository());
  }
  private get optOutRepo(): SmsOptOutRepository {
    return (this._optOutRepo ??= new SmsOptOutRepository());
  }
  private get numberService(): SmsNumberService {
    return (this._numberService ??= new SmsNumberService());
  }
  private get twilio(): TwilioService {
    return (this._twilio ??= twilioService);
  }
  private get consent(): CustomerConsentService {
    return (this._consent ??= customerConsentService);
  }

  /** Master gate for relaying customer-facing replies over SMS. Distinct from the ads lead SMS
   *  flag (ADS_SMS_ENABLED) — this is the regular-customer channel. Default off. */
  private enabled(): boolean {
    return process.env.ENABLE_CUSTOMER_SMS === 'true';
  }

  /**
   * Send the message `aiMessageId` (already persisted on `conversationId`) to the conversation's
   * SMS recipient. Best-effort — never throws; returns a coarse outcome for logging/tests.
   */
  async relay(conversationId: string, shopId: string, aiMessageId: string): Promise<SmsReplyOutcome> {
    try {
      if (!this.enabled() || !this.twilio.enabled()) return 'disabled';

      const message = await this.messageRepo.getMessageById(aiMessageId);
      const body = (message?.messageText || '').trim();
      if (!body) return 'no_recipient';

      // Recipient = the SMS identity linked to this conversation (Phase 0).
      const identities = await this.identityRepo.listForConversation(conversationId);
      const smsIdentity = identities.find((i) => i.channel === 'sms');
      const to = smsIdentity?.externalId;
      if (!to) return 'no_recipient';

      // Global opt-out (STOP) — legally must suppress ALL platform SMS to this number.
      if (await this.optOutRepo.isOptedOut(to)) return 'opted_out';

      // Opt-IN consent (D6) — no-op unless ENFORCE_MESSAGING_CONSENT is on (default off).
      if (!(await this.consent.isAllowedToSend(to, 'sms'))) return 'no_consent';

      const from = await this.numberService.resolveOutboundFrom(shopId);
      if (!from) return 'no_from_number';

      const result = await this.twilio.sendSms(to, body, undefined, from);
      if (result.status === 'sent') {
        // Stamp the relayed message so history reflects the transport it left on.
        await this.messageRepo.setMessageChannel(aiMessageId, 'sms').catch(() => {});
        return 'sent';
      }
      if (result.status === 'disabled') return 'disabled';
      return 'failed';
    } catch (err) {
      logger.error('CustomerSmsReplyService.relay failed', {
        conversationId,
        aiMessageId,
        error: (err as Error)?.message,
      });
      return 'failed';
    }
  }
}
