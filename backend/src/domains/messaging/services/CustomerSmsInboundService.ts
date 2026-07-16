// backend/src/domains/messaging/services/CustomerSmsInboundService.ts
import { MessageService } from './MessageService';
import { SmsCustomerResolver } from './SmsCustomerResolver';
import { SmsNumberService } from '../../../services/SmsNumberService';
import { CustomerConsentService, customerConsentService } from './CustomerConsentService';
import { logger } from '../../../utils/logger';

export type CustomerSmsInboundOutcome =
  | 'routed' // turned into a conversation message; AI auto-reply hook fired
  | 'disabled' // ENABLE_CUSTOMER_SMS off
  | 'no_shop' // the To number isn't claimed by any shop (needs a per-shop number, D2)
  | 'unresolved' // couldn't resolve the from-phone to a customer/conversation
  | 'error';

/**
 * Turns an inbound customer SMS into a regular conversation message (Phase 1 Slice 2C).
 *
 * The Twilio webhook calls this AFTER the ads-lead lookup misses — i.e. the text is from a regular
 * customer, not an ad lead. Flow: To→shop (per-shop number, D2) → resolve/mint the customer +
 * conversation → MessageService.sendMessage({channel:'sms'}). sendMessage persists the inbound turn
 * (so the shop sees it in their inbox) and fires the AI auto-reply hook, which — because the message
 * channel is 'sms' — runs the serviceless shop-level reply (2B) and relays it back over SMS (Slice 1).
 *
 * Gated by ENABLE_CUSTOMER_SMS (default off). Scope:
 * docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
export class CustomerSmsInboundService {
  // Deps are lazily constructed on first use, not at import. The module-level singleton below is
  // imported by the Twilio webhook controller; eager construction would build the whole
  // MessageService → CustomerSmsReplyService → repository chain at import time (heavy, and it trips
  // test mocks). Tests inject fakes, so the real ones are never built there.
  private _messageService?: MessageService;
  private _resolver?: SmsCustomerResolver;
  private _numberService?: SmsNumberService;
  private _consent?: CustomerConsentService;

  constructor(deps: {
    messageService?: MessageService;
    resolver?: SmsCustomerResolver;
    numberService?: SmsNumberService;
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
  private get numberService(): SmsNumberService {
    return (this._numberService ??= new SmsNumberService());
  }
  private get consent(): CustomerConsentService {
    return (this._consent ??= customerConsentService);
  }

  private enabled(): boolean {
    return process.env.ENABLE_CUSTOMER_SMS === 'true';
  }

  async handleInbound(
    toNumber: string,
    fromPhone: string,
    body: string
  ): Promise<CustomerSmsInboundOutcome> {
    if (!this.enabled()) return 'disabled';
    if (!body?.trim()) return 'unresolved';
    try {
      // To→shop. Until a shop has its own dedicated number (D2), an unclaimed number returns null
      // — a shared number can't attribute inbound to a specific shop, so we don't guess.
      const shopId = await this.numberService.findShopIdByInboundNumber(toNumber);
      if (!shopId) {
        logger.info('CustomerSmsInboundService: no shop owns the To number, skipping', { toNumber });
        return 'no_shop';
      }

      const resolution = await this.resolver.resolve(fromPhone, shopId);
      if (!resolution) {
        logger.warn('CustomerSmsInboundService: could not resolve customer for inbound SMS', { shopId });
        return 'unresolved';
      }

      // The customer messaged us first → implied opt-in. Record it for the D6 audit trail.
      await this.consent.grantOnInbound(resolution.phone, 'sms');

      await this.messageService.sendMessage({
        conversationId: resolution.conversationId,
        senderIdentifier: resolution.customerAddress, // customers key on address; matches the conversation
        senderType: 'customer',
        messageText: body.trim(),
        channel: 'sms',
      });

      logger.info('CustomerSmsInboundService: inbound SMS routed into conversation', {
        shopId,
        conversationId: resolution.conversationId,
        isGuest: resolution.isGuest,
      });
      return 'routed';
    } catch (err) {
      logger.error('CustomerSmsInboundService.handleInbound failed', {
        error: (err as Error)?.message,
      });
      return 'error';
    }
  }
}

export const customerSmsInboundService = new CustomerSmsInboundService();
