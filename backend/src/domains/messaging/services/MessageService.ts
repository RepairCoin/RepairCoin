// backend/src/domains/messaging/services/MessageService.ts
import { MessageRepository, Conversation, Message, CreateMessageParams } from '../../../repositories/MessageRepository';
import { NotificationService } from '../../notification/services/NotificationService';
import { WebSocketManager } from '../../../services/WebSocketManager';
import { conversationPresenceService } from '../../../services/ConversationPresenceService';
import { emailCooldownService } from '../../../services/EmailCooldownService';
import { AgentOrchestrator } from '../../AIAgentDomain/services/AgentOrchestrator';
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

  constructor() {
    this.messageRepo = new MessageRepository();
    this.notificationService = new NotificationService();
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
        clientMessageId: request.clientMessageId
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
              const { getWebPushService } = await import('../../../services/WebPushService');
              await getWebPushService().sendNewMessageNotification(receiverAddress!, {
                conversationId: conversation.conversationId,
                senderName,
                preview,
                receiverType,
                senderImageUrl,
              });
            } catch (pushError) {
              logger.error('Failed to send web push for new message:', pushError);
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
        conversation.serviceId
      ) {
        this.fireAiAutoReply({
          messageId,
          conversationId: conversation.conversationId,
          customerAddress: conversation.customerAddress,
          shopId: conversation.shopId,
          serviceId: conversation.serviceId,
          customerMessageText: request.messageText.trim(),
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
    serviceId: string;
    customerMessageText: string;
  }): void {
    setImmediate(async () => {
      try {
        const orchestrator = getOrchestrator();
        if (!orchestrator) return; // ANTHROPIC_API_KEY missing — silently skip

        const result = await orchestrator.handleCustomerMessage(input);

        // On successful AI reply, broadcast WS to the customer so they see
        // the reply land in real-time (the orchestrator persisted the message
        // but did not broadcast — that's MessageService's responsibility).
        if (result.outcome === 'ai_replied' && this.wsManager) {
          try {
            this.wsManager.sendToAddresses(
              [input.customerAddress.toLowerCase()],
              {
                type: 'message:new',
                payload: { conversationId: input.conversationId },
              }
            );
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
}

export const messageService = new MessageService();
