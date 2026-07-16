// backend/src/domains/messaging/services/SmsCustomerResolver.ts
import crypto from 'crypto';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { MessageRepository } from '../../../repositories/MessageRepository';
import { ConversationChannelIdentityRepository, ExternalChannel } from '../../../repositories/ConversationChannelIdentityRepository';
import { normalizePhone } from '../../../utils/phone';
import { logger } from '../../../utils/logger';

export interface SmsResolution {
  /** The customer (real or synthetic guest) the conversation belongs to. */
  customerAddress: string;
  conversationId: string;
  /** True when we minted a synthetic guest (no existing customer matched the phone). */
  isGuest: boolean;
  /** Normalized E.164 phone the identity was linked under. */
  phone: string;
}

/**
 * Resolves an inbound SMS (from-phone + owning shop) to a customer + conversation, so the
 * message can enter the same messaging pipeline as in-app chat (Phase 1 SMS inbound, D1).
 *
 *  - KNOWN customer (phone matches customers.phone) → reuse their (customer, shop) thread.
 *    We do NOT flip that conversation's stored channel — their in-app behavior is untouched; the
 *    reply is routed over SMS by the inbound message's own channel (handled at send time).
 *  - UNKNOWN phone → mint a synthetic guest customer (address = 0x + first 40 hex of
 *    sha256(phone)) so it satisfies conversations' FK + UNIQUE(customer_address, shop_id), then
 *    open a channel='sms' conversation (guests are SMS-only).
 *
 * Either way the phone is linked to the conversation via conversation_channel_identities (Phase 0)
 * so a returning texter maps back to the same thread, and the outbound relay knows where to send.
 *
 * Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
export class SmsCustomerResolver {
  private customerRepo: CustomerRepository;
  private messageRepo: MessageRepository;
  private identityRepo: ConversationChannelIdentityRepository;

  constructor(deps: {
    customerRepo?: CustomerRepository;
    messageRepo?: MessageRepository;
    identityRepo?: ConversationChannelIdentityRepository;
  } = {}) {
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.identityRepo = deps.identityRepo ?? new ConversationChannelIdentityRepository();
  }

  /** Deterministic synthetic wallet-shaped address for a phone: 0x + 40 hex of sha256(phone). */
  static guestAddressForPhone(normalizedPhone: string): string {
    const hex = crypto.createHash('sha256').update(normalizedPhone).digest('hex').slice(0, 40);
    return `0x${hex}`;
  }

  /**
   * Resolve (or create) the customer + conversation for an inbound message on a phone-based channel
   * (SMS or WhatsApp — a WhatsApp id IS an E.164 phone). `channel` defaults to 'sms'. Returns null
   * only when the phone can't be normalized (nothing to attach to).
   */
  async resolve(
    fromPhone: string,
    shopId: string,
    channel: ExternalChannel = 'sms'
  ): Promise<SmsResolution | null> {
    const phone = normalizePhone(fromPhone);
    if (!phone) {
      logger.warn('SmsCustomerResolver: unparseable from-phone, dropping', { fromPhone, channel });
      return null;
    }

    const existingConversationId = await this.identityRepo.findConversationId(channel, phone);

    // Match an existing customer by phone; otherwise mint a deterministic synthetic guest. Note a
    // returning guest matches itself here (its own phone is stored) — so "guest" is derived from
    // the address SHAPE (does it equal this phone's synthetic hash?), which stays true across
    // repeat texts, rather than "did we just mint one".
    const guestAddress = SmsCustomerResolver.guestAddressForPhone(phone);
    const known = await this.customerRepo.findAddressByPhone(phone);
    const customerAddress = known ?? await this.customerRepo.getOrCreateSmsGuest(guestAddress, phone);
    const isGuest = customerAddress.toLowerCase() === guestAddress.toLowerCase();

    const conversation = await this.messageRepo.getOrCreateConversation(customerAddress, shopId);

    // Guests are off-app only → mark the conversation's channel. Known customers keep their existing
    // channel (their thread may also be used in-app); reply routing keys off the message channel.
    if (isGuest && conversation.channel !== channel) {
      await this.messageRepo.setConversationChannel(conversation.conversationId, channel);
    }

    // Link the phone → conversation (idempotent). If a prior link pointed elsewhere it stays put;
    // for a known customer this binds their phone to their existing thread.
    await this.identityRepo.link(conversation.conversationId, channel, phone);

    if (existingConversationId && existingConversationId !== conversation.conversationId) {
      logger.info('SmsCustomerResolver: phone re-linked to a different conversation', {
        phone, from: existingConversationId, to: conversation.conversationId,
      });
    }

    return { customerAddress, conversationId: conversation.conversationId, isGuest, phone };
  }
}
