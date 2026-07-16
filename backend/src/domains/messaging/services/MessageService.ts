// backend/src/domains/messaging/services/MessageService.ts
import { MessageRepository, Conversation, Message, CreateMessageParams, ConversationChannel } from '../../../repositories/MessageRepository';
import { NotificationService } from '../../notification/services/NotificationService';
import { WebSocketManager } from '../../../services/WebSocketManager';
import { conversationPresenceService } from '../../../services/ConversationPresenceService';
import { emailCooldownService } from '../../../services/EmailCooldownService';
import { AgentOrchestrator } from '../../AIAgentDomain/services/AgentOrchestrator';
import { CustomerSmsReplyService } from './CustomerSmsReplyService';
import { CustomerWhatsAppReplyService } from './CustomerWhatsAppReplyService';
import { CustomerMessagingCostService } from './CustomerMessagingCostService';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SendMessageRequest {
  conversationId?: string;
  customerAddress?: string;
  shopId?: string;
  /** Phase 3 Task 8 — when set, the AI auto-reply hook fires using this
      service's per-service config. Captured on conversation creation and
      updated on subsequent sends if the customer is asking about a different
      service from what's currently bound to the thread. */
  serviceId?: string;
  senderIdentifier: string; // For customers: wallet address, For shops: shopId
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system' | 'encrypted';
  metadata?: Record<string, any>;
  attachments?: any[];
  isEncrypted?: boolean;
  clientMessageId?: string;
  /**
   * Transport for this message. Omitted → inherits the conversation's channel
   * (Phase 0 multi-channel foundation). In-app sends leave this unset → 'app'.
   */
  channel?: ConversationChannel;
}

// Lazy module-level AgentOrchestrator. Construction requires ANTHROPIC_API_KEY
// (via AnthropicClient), which dev/test environments may not have. We don't
// want messaging tests to break when the AI domain isn't configured.
//
// Behavior: first call attempts construction; if it throws, AI auto-replies
// are silently disabled for the rest of the process lifetime. Logs a warning
// once so an operator can spot it.
let _orchestrator: AgentOrchestrator | null = null;
let _orchestratorAvailable: boolean | null = null;
function getOrchestrator(): AgentOrchestrator | null {
  if (_orchestratorAvailable === false) return null;
  if (!_orchestrator) {
    try {
      _orchestrator = new AgentOrchestrator();
      _orchestratorAvailable = true;
    } catch (err) {
      logger.warn('AgentOrchestrator unavailable; AI auto-replies disabled', {
        error: (err as Error)?.message,
      });
      _orchestratorAvailable = false;
      return null;
    }
  }
  return _orchestrator;
}

/** Test-only: reset the lazy orchestrator. Production code does not call this. */
export function _resetOrchestratorForTests(): void {
  _orchestrator = null;
  _orchestratorAvailable = null;
}

export class MessageService {
  private messageRepo: MessageRepository;
  private notificationService: NotificationService;
  private wsManager?: WebSocketManager;
  private smsReplyService: CustomerSmsReplyService;
  private whatsappReplyService: CustomerWhatsAppReplyService;
  private messagingCostService: CustomerMessagingCostService;

  constructor() {
    this.messageRepo = new MessageRepository();
    this.notificationService = new NotificationService();
    this.smsReplyService = new CustomerSmsReplyService();
    this.whatsappReplyService = new CustomerWhatsAppReplyService();
    this.messagingCostService = new CustomerMessagingCostService();
  }

  public setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Get a single conversation by ID with authorization check
   */
  async getConversationById(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<Conversation> {
    try {
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify user has access to this conversation
      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      return conversation;
    } catch (error) {
      logger.error('Error in getConversationById:', error);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    try {
      let conversation: Conversation;

      // Get or create conversation
      if (request.conversationId) {
        const existing = await this.messageRepo.getConversationById(request.conversationId);
        if (!existing) {
          throw new Error('Conversation not found');
        }
        conversation = existing;
      } else if (request.customerAddress && request.shopId) {
        conversation = await this.messageRepo.getOrCreateConversation(
          request.customerAddress,
          request.shopId,
          request.serviceId
        );
      } else {
        throw new Error('Either conversationId or (customerAddress + shopId) is required');
      }

      // Validate sender is part of conversation
      // For customers: senderIdentifier is wallet address
      if (request.senderType === 'customer' && request.senderIdentifier !== conversation.customerAddress) {
        throw new Error('Sender does not match conversation customer');
      }
      // For shops: senderIdentifier is shopId
      if (request.senderType === 'shop' && request.senderIdentifier !== conversation.shopId) {
        throw new Error('Sender does not match conversation shop');
      }

      // Check if conversation is blocked
      if (conversation.isBlocked) {
        throw new Error('Cannot send message: conversation is blocked');
      }

      // Validate message content (text or attachments required)
      const hasText = request.messageText && request.messageText.trim().length > 0;
      const hasAttachments = request.attachments && request.attachments.length > 0;
      if (!hasText && !hasAttachments) {
        throw new Error('Message text or attachments required');
      }

      if (request.messageText.length > 2000) {
        throw new Error('Message text exceeds 2000 character limit');
      }

      // Create message
      const messageId = `msg_${uuidv4()}`;
      const messageParams: CreateMessageParams = {
        messageId,
        conversationId: conversation.conversationId,
        senderAddress: request.senderIdentifier, // This stores the identifier (wallet or shopId)
        senderType: request.senderType,
        messageText: (request.messageText || '').trim(),
        messageType: request.messageType || 'text',
        metadata: request.metadata || {},
        attachments: request.attachments || [],
        isEncrypted: request.isEncrypted || false,
        clientMessageId: request.clientMessageId,
        // A message inherits the conversation's channel unless the caller
        // overrides it. Legacy in-app sends pass neither → 'app'.
        channel: request.channel ?? conversation.channel
      };

      const { message, created } = await this.messageRepo.createMessage(messageParams);

      // Duplicate retry: return the existing row without re-running side effects
      // (unread increment, email, WS push) that already ran for the original send.
      if (!created) {
        return message;
      }

      // Preview text shared by unread-count update and the web push payload.
      // Encryption + attachment aware so we never leak ciphertext into
      // conversation rows or push notifications.
      const preview = request.isEncrypted
        ? '🔒 Locked message'
        : hasText
          ? request.messageText.trim()
          : `Sent ${request.attachments!.length} attachment(s)`;

      // Increment unread count for the receiver and update last message preview
      try {
        await this.messageRepo.incrementUnreadCount(
          conversation.conversationId,
          request.senderType === 'customer' ? 'shop' : 'customer',
          preview
        );
      } catch (unreadError) {
        logger.error('Failed to increment unread count:', unreadError);
        // Don't fail the message send if unread count update fails
      }

      // NOTE: Notification creation removed - messages are now accessed via the Message icon in the header
      // Users will see unread message counts on the Message icon instead of notifications
      // Keeping the code commented for reference:
      /*
      try {
        const receiverAddress = request.senderType === 'customer'
          ? conversation.shopId
          : conversation.customerAddress;

        const receiverType = request.senderType === 'customer' ? 'shop' : 'customer';
        const senderName = request.senderType === 'customer'
          ? (conversation.customerName || 'Customer')
          : (conversation.shopName || 'Shop');

        await this.notificationService.createNotification({
          senderAddress: request.senderIdentifier,
          receiverAddress,
          notificationType: 'new_message',
          message: `New message from ${senderName}: ${request.messageText.substring(0, 50)}${request.messageText.length > 50 ? '...' : ''}`,
          metadata: {
            conversationId: conversation.conversationId,
            messageId,
            senderType: request.senderType,
            receiverType
          }
        });
      } catch (notifError) {
        logger.error('Failed to send message notification:', notifError);
      }
      */

      // Resolve receiver wallet once — used for both the email-gate presence check
      // and the WS emit below. For customer→shop we need shop.walletAddress + shop.email;
      // for shop→customer we only need conversation.customerAddress.
      let receiverAddress: string | undefined;
      let shopForEmail: { email?: string; name: string; shopId: string } | undefined;

      try {
        if (request.senderType === 'customer') {
          const { shopRepository } = await import('../../../repositories');
          const shop = await shopRepository.getShop(conversation.shopId);
          receiverAddress = shop?.walletAddress?.toLowerCase();
          if (shop) {
            shopForEmail = { email: shop.email, name: shop.name, shopId: shop.shopId };
          }
        } else {
          receiverAddress = conversation.customerAddress?.toLowerCase();
        }
      } catch (lookupError) {
        logger.error('Failed to resolve receiver for post-send notifications:', lookupError);
      }

      // Email notification (customer → shop only). Skipped when the shop is actively
      // viewing this conversation, or when we've already emailed this (shop, convo)
      // pair within the cooldown window. Non-blocking — fire and forget so the HTTP
      // response doesn't wait on SendGrid.
      if (request.senderType === 'customer' && shopForEmail?.email) {
        const isShopViewing = receiverAddress
          ? conversationPresenceService.isViewing(receiverAddress, conversation.conversationId)
          : false;

        if (!isShopViewing && emailCooldownService.shouldSend(shopForEmail.shopId, conversation.conversationId)) {
          (async () => {
            try {
              const { EmailService } = await import('../../../services/EmailService');
              const emailService = new EmailService();
              await emailService.sendCustomerMessageNotification(shopForEmail!.email!, shopForEmail!.shopId, {
                shopName: shopForEmail!.name,
                customerName: conversation.customerName || 'Customer',
                messagePreview: request.isEncrypted ? '🔒 Locked message' : request.messageText,
              });
            } catch (emailError) {
              logger.error('Failed to send customer message email to shop:', emailError);
            }
          })();
        }
      }

      // Web Push notification to the receiver. Skipped when the receiver is
      // actively viewing this conversation (same presence gate as email).
      // Fire-and-forget so the HTTP response doesn't wait on push delivery.
      if (receiverAddress) {
        const isReceiverViewing = conversationPresenceService.isViewing(
          receiverAddress,
          conversation.conversationId
        );

        if (!isReceiverViewing) {
          const receiverType: 'customer' | 'shop' =
            request.senderType === 'customer' ? 'shop' : 'customer';
          const senderName = request.senderType === 'customer'
            ? (conversation.customerName || 'Customer')
            : (conversation.shopName || 'Shop');
          // Sender avatar — shop logo for shop senders, customer profile image
          // for customer senders. Both are joined into the conversation row.
          const senderImageUrl = request.senderType === 'shop'
            ? conversation.shopImageUrl
            : conversation.customerImageUrl;

          (async () => {
            try {
              // Dispatcher fans out to BOTH Expo (mobile) and Web push, so the
              // receiver gets the message notification on every registered device.
              const { getPushNotificationDispatcher } = await import('../../../services/PushNotificationDispatcher');
              await getPushNotificationDispatcher().sendNewMessageNotification(receiverAddress!, {
                conversationId: conversation.conversationId,
                senderName,
                preview,
                receiverType,
                senderImageUrl,
              });
            } catch (pushError) {
              logger.error('Failed to send push for new message:', pushError);
            }
          })();
        }
      }

      // Push lightweight WS signal so the receiver's MessageIcon refetches unread count
      try {
        if (receiverAddress && this.wsManager) {
          this.wsManager.sendToAddresses([receiverAddress], {
            type: 'message:new',
            payload: { conversationId: conversation.conversationId }
          });
        }
      } catch (wsError) {
        logger.error('Failed to send message:new WS event:', wsError);
      }

      // Phase 3 Task 8 — AI auto-reply hook.
      // Fires async (after the HTTP response returns to the customer) when:
      //   - sender is customer (shop replies don't trigger)
      //   - message is not encrypted (encrypted threads are explicitly customer-to-human, per migration 097)
      //   - conversation has a service_id (no service context = no AI)
      // The orchestrator handles its own kill-switches (per-service AI toggle,
      // per-shop ai_global_enabled, spend cap, escalation phrases) and is
      // entirely silent if any of those say "skip" — the customer message just
      // goes through normally with no AI reply.
      if (
        request.senderType === 'customer' &&
        !request.isEncrypted &&
        // In-app: needs a service_id (unchanged). Off-app (SMS/WhatsApp): no service context, so the
        // serviceless shop-level path fires instead (Phase 1/2). Only off-app messages enter the
        // second clause, so in-app behavior is untouched.
        (conversation.serviceId || messageParams.channel === 'sms' || messageParams.channel === 'whatsapp')
      ) {
        this.fireAiAutoReply({
          messageId,
          conversationId: conversation.conversationId,
          customerAddress: conversation.customerAddress,
          shopId: conversation.shopId,
          serviceId: conversation.serviceId,
          customerMessageText: request.messageText.trim(),
          // Route the reply over the channel the customer just used — NOT the conversation's
          // stored channel. A known customer's thread stays 'app' even when they text (so in-app
          // is untouched); the inbound message's channel is what says "reply over SMS".
          inboundChannel: messageParams.channel ?? 'app',
        });
      }

      logger.info('Message sent successfully', {
        messageId,
        conversationId: conversation.conversationId,
        senderType: request.senderType
      });

      return message;
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Get or create a conversation between a customer and shop
   */
  async getOrCreateConversation(
    customerAddress: string,
    shopId: string,
    serviceId?: string
  ): Promise<Conversation> {
    return this.messageRepo.getOrCreateConversation(customerAddress, shopId, serviceId);
  }

  /**
   * Fire-and-forget AI auto-reply (Phase 3 Task 8).
   *
   * Runs the AgentOrchestrator pipeline in a separate microtask so the
   * customer's HTTP response returns immediately. The AI's reply lands in the
   * messages table via the orchestrator's own messageRepo.createMessage call,
   * then we broadcast a `message:new` WS event so the customer's chat UI
   * picks it up through the same channel as a human shop reply.
   *
   * Errors are swallowed: orchestrator failures must never affect the
   * original message-send. Audit-log writes within the orchestrator capture
   * the error for diagnostics.
   */
  private fireAiAutoReply(input: {
    messageId: string;
    conversationId: string;
    customerAddress: string;
    shopId: string;
    serviceId?: string;
    customerMessageText: string;
    inboundChannel: ConversationChannel;
  }): void {
    setImmediate(async () => {
      try {
        const orchestrator = getOrchestrator();
        if (!orchestrator) return; // ANTHROPIC_API_KEY missing — silently skip

        const { inboundChannel, serviceId, ...rest } = input;
        // Service-anchored (in-app) → the full booking-capable pipeline. Serviceless (SMS/WhatsApp
        // with no service context) → the shop-level catalog-grounded reply (Slice 2B).
        // handleCustomerMessage is untouched — the branch just picks which entry point runs.
        const result = serviceId
          ? await orchestrator.handleCustomerMessage({ ...rest, serviceId })
          : await orchestrator.handleShopLevelMessage({
              ...rest,
              channel: inboundChannel === 'whatsapp' ? 'whatsapp' : 'sms',
            });

        // Phase 1 (AI Auto-Replies SMS) — when the conversation lives on SMS, the AI reply the
        // orchestrator just persisted must ALSO go back out over SMS (the orchestrator only wrote
        // it to the messages table). D2-independent: the FROM number is resolved per-shop with a
        // shared-number fallback. In-app ('app') conversations never enter this branch, so the
        // existing behavior is untouched. Gated further by ENABLE_CUSTOMER_SMS inside the service.
        if (
          result.outcome === 'ai_replied' &&
          (inboundChannel === 'sms' || inboundChannel === 'whatsapp')
        ) {
          const relayOutcome =
            inboundChannel === 'sms'
              ? await this.smsReplyService.relay(input.conversationId, input.shopId, result.aiMessageId)
              : await this.whatsappReplyService.relay(input.conversationId, input.shopId, result.aiMessageId);
          logger.info(`AI reply ${inboundChannel} relay`, {
            conversationId: input.conversationId,
            outcome: relayOutcome,
          });
          // Phase 3 (D5) — ledger the reply's cost: AI inference always (it was spent regardless of
          // send), carrier cost only when the message actually left. Best-effort, never blocks.
          await this.messagingCostService.recordReply({
            shopId: input.shopId,
            conversationId: input.conversationId,
            customerAddress: input.customerAddress,
            channel: inboundChannel,
            aiCostUsd: result.costUsd,
            sent: relayOutcome === 'sent',
          });
        }

        // On successful AI reply, broadcast WS to BOTH the customer AND the
        // shop so they each see the reply land in real-time (the orchestrator
        // persisted the message but did not broadcast — that's
        // MessageService's responsibility).
        //
        // Bug found 2026-05-08: previously this broadcast only to the
        // customer's wallet. Shop's chat tab — even with a healthy WS —
        // never received message:new for AI replies on conversations they
        // own, so AI replies appeared "missing" until the shop refreshed.
        // Fix: resolve shop.walletAddress (same source MessageService.sendMessage
        // uses at line 240 for human customer→shop broadcasts) and include
        // it in the target list.
        if (result.outcome === 'ai_replied' && this.wsManager) {
          const targets: string[] = [input.customerAddress.toLowerCase()];
          try {
            const { shopRepository } = await import('../../../repositories');
            const shop = await shopRepository.getShop(input.shopId);
            if (shop?.walletAddress) {
              targets.push(shop.walletAddress.toLowerCase());
            }
          } catch (lookupErr) {
            // Don't let a shop-lookup failure suppress the customer
            // broadcast — degrade to customer-only rather than silent.
            logger.error('AI reply WS broadcast: shop wallet lookup failed', {
              shopId: input.shopId,
              error: (lookupErr as Error)?.message,
            });
          }
          try {
            this.wsManager.sendToAddresses(targets, {
              type: 'message:new',
              payload: { conversationId: input.conversationId },
            });
          } catch (wsErr) {
            logger.error('AI reply WS broadcast failed', {
              messageId: input.messageId,
              error: (wsErr as Error)?.message,
            });
          }
        }
      } catch (err) {
        logger.error('AI auto-reply hook failed', {
          messageId: input.messageId,
          conversationId: input.conversationId,
          error: (err as Error)?.message,
        });
      }
    });
  }

  /**
   * Get conversations for a user
   * @param userIdentifier - For customers: wallet address, For shops: shopId
   * @param userType - 'customer' or 'shop'
   * @param options - Pagination and filter options
   */
  async getConversations(
    userIdentifier: string,
    userType: 'customer' | 'shop',
    options: { page?: number; limit?: number; archived?: boolean; status?: 'open' | 'resolved'; search?: string } = {}
  ): Promise<any> {
    try {
      if (userType === 'customer') {
        return await this.messageRepo.getCustomerConversations(userIdentifier, options);
      } else {
        // For shops, userIdentifier is shopId
        return await this.messageRepo.getShopConversations(userIdentifier, options);
      }
    } catch (error) {
      logger.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   * @param conversationId - The conversation ID
   * @param userIdentifier - For customers: wallet address, For shops: shopId
   * @param userType - 'customer' or 'shop'
   * @param options - Pagination options
   */
  async getMessages(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop',
    options: { page?: number; limit?: number; sort?: 'asc' | 'desc' } = {}
  ): Promise<any> {
    try {
      // Verify user has access to conversation
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized: Not part of this conversation');
      }

      // For shops, userIdentifier is shopId
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized: Not part of this conversation');
      }

      // Get messages
      return await this.messageRepo.getConversationMessages(conversationId, options);
    } catch (error) {
      logger.error('Error in getMessages:', error);
      throw error;
    }
  }

  /**
   * Mark conversation as read
   * @param conversationId - The conversation ID
   * @param userIdentifier - For customers: wallet address, For shops: shopId
   * @param userType - 'customer' or 'shop'
   */
  async markConversationAsRead(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }

      // For shops, userIdentifier is shopId
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      // Mark as read
      await this.messageRepo.markConversationAsRead(conversationId, userType);

      logger.info('Conversation marked as read', { conversationId, userType });
    } catch (error) {
      logger.error('Error in markConversationAsRead:', error);
      throw error;
    }
  }

  /**
   * Get total unread message count for a user
   */
  async getTotalUnreadCount(
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<number> {
    try {
      return await this.messageRepo.getTotalUnreadCount(userIdentifier, userType);
    } catch (error) {
      logger.error('Error in getTotalUnreadCount:', error);
      throw error;
    }
  }

  /**
   * Archive or reopen a conversation
   */
  async setConversationArchived(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop',
    archived: boolean
  ): Promise<void> {
    try {
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      await this.messageRepo.setConversationArchived(conversationId, userType, archived);
      logger.info(`Conversation ${archived ? 'archived' : 'reopened'}`, { conversationId, userType });
    } catch (error) {
      logger.error('Error in setConversationArchived:', error);
      throw error;
    }
  }

  /**
   * Set typing indicator
   */
  async setTypingIndicator(
    conversationId: string,
    userAddress: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      await this.messageRepo.setTypingIndicator(conversationId, userAddress, userType);
    } catch (error) {
      logger.error('Error in setTypingIndicator:', error);
      throw error;
    }
  }

  /**
   * Get typing indicators
   */
  async getTypingIndicators(conversationId: string): Promise<any[]> {
    try {
      return await this.messageRepo.getTypingIndicators(conversationId);
    } catch (error) {
      logger.error('Error in getTypingIndicators:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired typing indicators (should be called periodically)
   */
  async cleanupExpiredTypingIndicators(): Promise<void> {
    await this.messageRepo.cleanupExpiredTypingIndicators();
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      await this.messageRepo.archiveConversation(conversationId, userType);
      logger.info('Conversation archived', { conversationId, userType });
    } catch (error) {
      logger.error('Error in archiveConversation:', error);
      throw error;
    }
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      await this.messageRepo.unarchiveConversation(conversationId, userType);
      logger.info('Conversation unarchived', { conversationId, userType });
    } catch (error) {
      logger.error('Error in unarchiveConversation:', error);
      throw error;
    }
  }

  /**
   * Block a conversation
   */
  async blockConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      if (conversation.isBlocked) {
        throw new Error('Conversation is already blocked');
      }

      await this.messageRepo.blockConversation(conversationId, userType);
      logger.info('Conversation blocked', { conversationId, userType });
    } catch (error) {
      logger.error('Error in blockConversation:', error);
      throw error;
    }
  }

  /**
   * Unblock a conversation
   */
  async unblockConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      // Only the person who blocked can unblock
      if (!conversation.isBlocked) {
        throw new Error('Conversation is not blocked');
      }
      if (conversation.blockedBy !== userType) {
        throw new Error('Only the user who blocked can unblock');
      }

      await this.messageRepo.unblockConversation(conversationId);
      logger.info('Conversation unblocked', { conversationId, userType });
    } catch (error) {
      logger.error('Error in unblockConversation:', error);
      throw error;
    }
  }

  /**
   * Delete a single message (soft delete, sender only).
   */
  async deleteMessage(messageId: string, senderAddress: string): Promise<void> {
    const deleted = await this.messageRepo.deleteMessage(messageId, senderAddress);
    if (!deleted) {
      throw new Error('Message not found or you are not the sender');
    }
  }

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      await this.messageRepo.deleteConversation(conversationId, userType);
      logger.info('Conversation deleted', { conversationId, userType });
    } catch (error) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }

  /**
   * Mark a conversation as resolved
   */
  async resolveConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      if (conversation.status === 'resolved') {
        throw new Error('Conversation is already resolved');
      }

      await this.messageRepo.resolveConversation(conversationId);
      logger.info('Conversation resolved', { conversationId, userType });
    } catch (error) {
      logger.error('Error in resolveConversation:', error);
      throw error;
    }
  }

  /**
   * Reopen a resolved conversation
   */
  async reopenConversation(
    conversationId: string,
    userIdentifier: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Verify user has access
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userType === 'customer' && userIdentifier !== conversation.customerAddress) {
        throw new Error('Unauthorized');
      }
      if (userType === 'shop' && userIdentifier !== conversation.shopId) {
        throw new Error('Unauthorized');
      }

      if (conversation.status === 'open') {
        throw new Error('Conversation is already open');
      }

      await this.messageRepo.reopenConversation(conversationId);
      logger.info('Conversation reopened', { conversationId, userType });
    } catch (error) {
      logger.error('Error in reopenConversation:', error);
      throw error;
    }
  }

  /**
   * Set / clear conversations.ai_paused_until (Phase 2 human handoff).
   *
   *   - mode = 'takeover' → ai_paused_until = NOW() + 100 years
   *     (effectively indefinite until 'resume' clears it). Triggered by
   *     the shop dashboard "Take Over" button.
   *   - mode = 'resume'   → ai_paused_until = NULL. AI resumes on the
   *     next customer message.
   *
   * Shop-only: caller's shopId must match the conversation's shopId.
   * The 30-second auto race-window pause is set elsewhere (in
   * MessageRepository.createMessage when a non-AI shop message lands)
   * — this method handles the two explicit-state transitions only.
   */
  async setAiPausedUntil(
    conversationId: string,
    shopId: string,
    mode: 'takeover' | 'resume'
  ): Promise<void> {
    try {
      const conversation = await this.messageRepo.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      if (conversation.shopId !== shopId) {
        throw new Error('Unauthorized');
      }
      if (mode === 'takeover') {
        await this.messageRepo.takeoverAiOnConversation(conversationId);
      } else {
        await this.messageRepo.resumeAiOnConversation(conversationId);
      }
      logger.info('AI pause state updated', { conversationId, shopId, mode });
    } catch (error) {
      logger.error('Error in setAiPausedUntil:', error);
      throw error;
    }
  }
}

export const messageService = new MessageService();
