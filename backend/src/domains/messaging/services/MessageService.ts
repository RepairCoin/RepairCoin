// backend/src/domains/messaging/services/MessageService.ts
import { MessageRepository, Conversation, Message, CreateMessageParams } from '../../../repositories/MessageRepository';
import { NotificationService } from '../../notification/services/NotificationService';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SendMessageRequest {
  conversationId?: string;
  customerAddress?: string;
  shopId?: string;
  senderIdentifier: string; // For customers: wallet address, For shops: shopId
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system';
  metadata?: Record<string, any>;
}

export class MessageService {
  private messageRepo: MessageRepository;
  private notificationService: NotificationService;

  constructor() {
    this.messageRepo = new MessageRepository();
    this.notificationService = new NotificationService();
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
          request.shopId
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

      // Validate message content
      if (!request.messageText || request.messageText.trim().length === 0) {
        throw new Error('Message text is required');
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
        messageText: request.messageText.trim(),
        messageType: request.messageType || 'text',
        metadata: request.metadata || {}
      };

      const message = await this.messageRepo.createMessage(messageParams);

      // Increment unread count for the receiver and update last message preview
      try {
        await this.messageRepo.incrementUnreadCount(
          conversation.conversationId,
          request.senderType === 'customer' ? 'shop' : 'customer',
          request.messageText.trim() // Pass message text as preview
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
   * Get conversations for a user
   * @param userIdentifier - For customers: wallet address, For shops: shopId
   * @param userType - 'customer' or 'shop'
   * @param options - Pagination options
   */
  async getConversations(
    userIdentifier: string,
    userType: 'customer' | 'shop',
    options: { page?: number; limit?: number } = {}
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
    options: { page?: number; limit?: number } = {}
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
}
