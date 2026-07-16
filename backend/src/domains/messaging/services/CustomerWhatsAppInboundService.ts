// backend/src/domains/messaging/services/CustomerWhatsAppInboundService.ts
import { MessageService } from './MessageService';
import { SmsCustomerResolver } from './SmsCustomerResolver';
import { WhatsAppNumberService } from '../../../services/WhatsAppNumberService';
import { CustomerConsentService, customerConsentService } from './CustomerConsentService';
import { logger } from '../../../utils/logger';

export type CustomerWhatsAppInboundOutcome =
  | 'routed'
  | 'disabled' // ENABLE_CUSTOMER_WHATSAPP off
  | 'no_shop' // the business phone_number_id isn't mapped to a shop (per-shop WhatsApp not provisioned)
  | 'unresolved' // empty body / couldn't resolve the sender
  | 'error';

/**
 * Turns an inbound WhatsApp customer message into a regular conversation message (Phase 2 Slice B).
 * The WhatsApp analog of CustomerSmsInboundService: phone_number_id→shop → resolve/mint the customer +
 * conversation (channel 'whatsapp') → MessageService.sendMessage({channel:'whatsapp'}), which persists
 * the inbound turn and fires the AI auto-reply hook → serviceless shop-level reply (2B) → WhatsApp relay
 * (Slice A). Gated by ENABLE_CUSTOMER_WHATSAPP.
 *
 * A wa_id is E.164 digits WITHOUT '+', so we prefix it before resolving (normalizePhone keeps a
 * correctly-prefixed international number as-is rather than guessing a country code).
 */
export class CustomerWhatsAppInboundService {
  private _messageService?: MessageService;
  private _resolver?: SmsCustomerResolver;
  private _numberService?: WhatsAppNumberService;
  private _consent?: CustomerConsentService;

  constructor(deps: {
    messageService?: MessageService;
    resolver?: SmsCustomerResolver;
    numberService?: WhatsAppNumberService;
    consent?: CustomerConsentService;
  } = {}) {
    this._messageService = deps.messageService;
    this._resolver = deps.resolver;
    this._numberService = deps.numberService;
    this._consent = deps.consent;
  }

  private get messageService(): MessageService {
    return (this._messageService ??= new MessageService());
  }
  private get resolver(): SmsCustomerResolver {
    return (this._resolver ??= new SmsCustomerResolver());
  }
  private get numberService(): WhatsAppNumberService {
    return (this._numberService ??= new WhatsAppNumberService());
  }
  private get consent(): CustomerConsentService {
    return (this._consent ??= customerConsentService);
  }

  private enabled(): boolean {
    return process.env.ENABLE_CUSTOMER_WHATSAPP === 'true';
  }

  async handleInbound(
    phoneNumberId: string,
    fromWaId: string,
    body: string
  ): Promise<CustomerWhatsAppInboundOutcome> {
    if (!this.enabled()) return 'disabled';
    if (!body?.trim()) return 'unresolved';
    try {
      const shopId = await this.numberService.findShopIdByPhoneNumberId(phoneNumberId);
      if (!shopId) return 'no_shop';

      // wa_id has no '+'; prefix it so normalizePhone treats it as a full international number.
      const resolution = await this.resolver.resolve(`+${fromWaId}`, shopId, 'whatsapp');
      if (!resolution) return 'unresolved';

      // Customer messaged us first → implied opt-in. Record it for the D6 audit trail.
      await this.consent.grantOnInbound(resolution.phone, 'whatsapp');

      await this.messageService.sendMessage({
        conversationId: resolution.conversationId,
        senderIdentifier: resolution.customerAddress,
        senderType: 'customer',
        messageText: body.trim(),
        channel: 'whatsapp',
      });

      logger.info('CustomerWhatsAppInboundService: inbound WhatsApp routed into conversation', {
        shopId,
        conversationId: resolution.conversationId,
        isGuest: resolution.isGuest,
      });
      return 'routed';
    } catch (err) {
      logger.error('CustomerWhatsAppInboundService.handleInbound failed', {
        error: (err as Error)?.message,
      });
      return 'error';
    }
  }
}

export const customerWhatsAppInboundService = new CustomerWhatsAppInboundService();
