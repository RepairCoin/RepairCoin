// backend/src/domains/messaging/services/CustomerWhatsAppReplyService.ts
import { MessageRepository } from '../../../repositories/MessageRepository';
import { ConversationChannelIdentityRepository } from '../../../repositories/ConversationChannelIdentityRepository';
import whatsappService from '../../../services/WhatsAppService';
import { CustomerConsentService, customerConsentService } from './CustomerConsentService';
import { logger } from '../../../utils/logger';

export type WhatsAppReplyOutcome =
  | 'sent'
  | 'disabled' // ENABLE_CUSTOMER_WHATSAPP off, or WhatsApp not configured
  | 'no_consent' // consent enforcement is on and the recipient hasn't opted in
  | 'no_recipient' // conversation has no WhatsApp identity / empty reply
  | 'failed';

/**
 * Relays an AI (or shop) reply that landed on a `channel='whatsapp'` conversation back out over
 * WhatsApp. The WhatsApp analog of CustomerSmsReplyService (Phase 2).
 *
 * Differences from SMS: WhatsApp sends from the platform WhatsApp Business number (WhatsAppService's
 * global config — per-shop WhatsApp senders are a later provisioning slice, the WhatsApp "D2"), and
 * opt-out is managed by Meta / the user blocking the business (no local opt-out list to check). The
 * reply is free-form text, valid because our flow is reactive (inside WhatsApp's 24-hour window).
 *
 * Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
export class CustomerWhatsAppReplyService {
  // Lazy deps — MessageService constructs this in its constructor and is imported as a module-level
  // singleton; eager repo construction would run at import time (see CustomerSmsReplyService).
  private _messageRepo?: MessageRepository;
  private _identityRepo?: ConversationChannelIdentityRepository;
  private _whatsapp?: typeof whatsappService;
  private _consent?: CustomerConsentService;

  constructor(deps: {
    messageRepo?: MessageRepository;
    identityRepo?: ConversationChannelIdentityRepository;
    whatsapp?: typeof whatsappService;
    consent?: CustomerConsentService;
  } = {}) {
    this._messageRepo = deps.messageRepo;
    this._identityRepo = deps.identityRepo;
    this._whatsapp = deps.whatsapp;
    this._consent = deps.consent;
  }

  private get messageRepo(): MessageRepository {
    return (this._messageRepo ??= new MessageRepository());
  }
  private get identityRepo(): ConversationChannelIdentityRepository {
    return (this._identityRepo ??= new ConversationChannelIdentityRepository());
  }
  private get whatsapp(): typeof whatsappService {
    return (this._whatsapp ??= whatsappService);
  }
  private get consent(): CustomerConsentService {
    return (this._consent ??= customerConsentService);
  }

  private enabled(): boolean {
    return process.env.ENABLE_CUSTOMER_WHATSAPP === 'true';
  }

  async relay(conversationId: string, _shopId: string, aiMessageId: string): Promise<WhatsAppReplyOutcome> {
    try {
      if (!this.enabled() || !this.whatsapp.isEnabled()) return 'disabled';

      const message = await this.messageRepo.getMessageById(aiMessageId);
      const body = (message?.messageText || '').trim();
      if (!body) return 'no_recipient';

      const identities = await this.identityRepo.listForConversation(conversationId);
      const waIdentity = identities.find((i) => i.channel === 'whatsapp');
      const to = waIdentity?.externalId;
      if (!to) return 'no_recipient';

      // Opt-IN consent (D6) — no-op unless ENFORCE_MESSAGING_CONSENT is on (default off).
      if (!(await this.consent.isAllowedToSend(to, 'whatsapp'))) return 'no_consent';

      const result = await this.whatsapp.sendText(to, body);
      if (result.status === 'sent') {
        await this.messageRepo.setMessageChannel(aiMessageId, 'whatsapp').catch(() => {});
        return 'sent';
      }
      if (result.status === 'disabled') return 'disabled';
      return 'failed';
    } catch (err) {
      logger.error('CustomerWhatsAppReplyService.relay failed', {
        conversationId,
        aiMessageId,
        error: (err as Error)?.message,
      });
      return 'failed';
    }
  }
}
