// backend/src/repositories/MessageRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface Conversation {
  conversationId: string;
  customerAddress: string;
  shopId: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadCountCustomer: number;
  unreadCountShop: number;
  isArchivedCustomer: boolean;
  isArchivedShop: boolean;
  isBlocked: boolean;
  blockedBy?: string;
  blockedAt?: Date;
  status: 'open' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  customerName?: string;
  shopName?: string;
  shopImageUrl?: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType: 'text' | 'booking_link' | 'service_link' | 'system' | 'encrypted';
  attachments: any[];
  metadata: Record<string, any>;
  isEncrypted: boolean;
  isRead: boolean;
  readAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  senderName?: string;
}

export interface TypingIndicator {
  conversationId: string;
  userAddress: string;
  userType: 'customer' | 'shop';
  startedAt: Date;
  expiresAt: Date;
}

export interface CreateConversationParams {
  conversationId: string;
  customerAddress: string;
  shopId: string;
}

export interface CreateMessageParams {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system' | 'encrypted';
  metadata?: Record<string, any>;
  attachments?: any[];
  isEncrypted?: boolean;
}

export class MessageRepository extends BaseRepository {
  /**
   * Get or create a conversation between customer and shop
   */
  async getOrCreateConversation(
    customerAddress: string,
    shopId: string
  ): Promise<Conversation> {
    try {
      // Try to get existing conversation
      const query = `
        SELECT
          c.*,
          cust.name as customer_name,
          s.name as shop_name,
          s.logo_url as shop_image_url
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        WHERE c.customer_address = $1 AND c.shop_id = $2
      `;

      let result = await this.pool.query(query, [customerAddress.toLowerCase(), shopId]);

      if (result.rows.length > 0) {
        return this.mapConversationRow(result.rows[0]);
      }

      // Create new conversation
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const insertQuery = `
        INSERT INTO conversations (
          conversation_id, customer_address, shop_id
        ) VALUES ($1, $2, $3)
        RETURNING *
      `;

      result = await this.pool.query(insertQuery, [
        conversationId,
        customerAddress.toLowerCase(),
        shopId
      ]);

      logger.info('Conversation created', { conversationId, customerAddress, shopId });

      // Fetch again with joined data
      result = await this.pool.query(query, [customerAddress.toLowerCase(), shopId]);
      return this.mapConversationRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in getOrCreateConversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const query = `
        SELECT
          c.*,
          cust.name as customer_name,
          s.name as shop_name,
          s.logo_url as shop_image_url
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        WHERE c.conversation_id = $1
      `;

      const result = await this.pool.query(query, [conversationId]);
      return result.rows.length > 0 ? this.mapConversationRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error in getConversationById:', error);
      throw error;
    }
  }

  /**
   * Get conversations for a customer (paginated)
   */
  async getCustomerConversations(
    customerAddress: string,
    options: { page?: number; limit?: number; archived?: boolean; status?: 'open' | 'resolved'; search?: string } = {}
  ): Promise<PaginatedResult<Conversation>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;
      const archived = options.archived || false;
      const status = options.status;
      const search = options.search;

      // Build WHERE clause
      let whereClause = 'WHERE c.customer_address = $1 AND c.is_archived_customer = $2';
      const params: any[] = [customerAddress.toLowerCase(), archived];

      if (status) {
        params.push(status);
        whereClause += ` AND c.status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        whereClause += ` AND (s.name ILIKE $${params.length} OR c.last_message_preview ILIKE $${params.length})`;
      }

      // Count total (need JOIN for search on shop name)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM conversations c
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get conversations
      const query = `
        SELECT
          c.*,
          s.name as shop_name,
          s.logo_url as shop_image_url
        FROM conversations c
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        ${whereClause}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.pool.query(query, [...params, limit, offset]);

      return {
        items: result.rows.map(row => this.mapConversationRow(row)),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error in getCustomerConversations:', error);
      throw error;
    }
  }

  /**
   * Get conversations for a shop (paginated)
   */
  async getShopConversations(
    shopId: string,
    options: { page?: number; limit?: number; archived?: boolean; status?: 'open' | 'resolved'; search?: string } = {}
  ): Promise<PaginatedResult<Conversation>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;
      const archived = options.archived || false;
      const status = options.status;
      const search = options.search;

      // Build WHERE clause
      let whereClause = 'WHERE c.shop_id = $1 AND c.is_archived_shop = $2';
      const params: any[] = [shopId, archived];

      if (status) {
        params.push(status);
        whereClause += ` AND c.status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        whereClause += ` AND (cust.name ILIKE $${params.length} OR c.last_message_preview ILIKE $${params.length})`;
      }

      // Count total (need JOIN for search on customer name)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get conversations
      const query = `
        SELECT
          c.*,
          cust.name as customer_name
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        ${whereClause}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.pool.query(query, [...params, limit, offset]);

      return {
        items: result.rows.map(row => this.mapConversationRow(row)),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error in getShopConversations:', error);
      throw error;
    }
  }

  /**
   * Create a message
   */
  async createMessage(params: CreateMessageParams): Promise<Message> {
    try {
      const query = `
        INSERT INTO messages (
          message_id,
          conversation_id,
          sender_address,
          sender_type,
          message_text,
          message_type,
          metadata,
          attachments,
          is_encrypted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        params.messageId,
        params.conversationId,
        params.senderAddress.toLowerCase(),
        params.senderType,
        params.messageText,
        params.messageType || 'text',
        JSON.stringify(params.metadata || {}),
        JSON.stringify(params.attachments || []),
        params.isEncrypted || false
      ]);

      logger.info('Message created', {
        messageId: params.messageId,
        conversationId: params.conversationId,
        senderType: params.senderType
      });

      return this.mapMessageRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in createMessage:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation (paginated)
   */
  async getConversationMessages(
    conversationId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResult<Message>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const offset = (page - 1) * limit;

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages
        WHERE conversation_id = $1 AND is_deleted = FALSE
      `;
      const countResult = await this.pool.query(countQuery, [conversationId]);
      const total = parseInt(countResult.rows[0].total);

      // Get messages (oldest first for chat UI)
      const query = `
        SELECT
          m.*,
          COALESCE(c.name, s.name) as sender_name
        FROM messages m
        LEFT JOIN customers c ON m.sender_address = c.address AND m.sender_type = 'customer'
        LEFT JOIN shops s ON m.sender_address = s.shop_id AND m.sender_type = 'shop'
        WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
        ORDER BY m.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [conversationId, limit, offset]);

      return {
        items: result.rows.map(row => this.mapMessageRow(row)),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error in getConversationMessages:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      const query = `
        UPDATE messages
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE message_id = $1 AND is_read = FALSE
      `;

      await this.pool.query(query, [messageId]);
      logger.info('Message marked as read', { messageId });
    } catch (error) {
      logger.error('Error in markMessageAsRead:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in conversation as read for a user
   */
  async markConversationAsRead(conversationId: string, userType: 'customer' | 'shop'): Promise<void> {
    try {
      const query = `
        UPDATE messages
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE conversation_id = $1
          AND sender_type != $2
          AND is_read = FALSE
      `;

      await this.pool.query(query, [conversationId, userType]);

      // Also reset the unread count in conversations table
      const column = userType === 'customer' ? 'unread_count_customer' : 'unread_count_shop';
      const updateConvQuery = `
        UPDATE conversations
        SET ${column} = 0
        WHERE conversation_id = $1
      `;
      await this.pool.query(updateConvQuery, [conversationId]);

      logger.info('Conversation marked as read', { conversationId, userType });
    } catch (error) {
      logger.error('Error in markConversationAsRead:', error);
      throw error;
    }
  }

  /**
   * Increment unread count for a receiver and update last message preview
   */
  async incrementUnreadCount(conversationId: string, receiverType: 'customer' | 'shop', messagePreview?: string): Promise<void> {
    try {
      const column = receiverType === 'customer' ? 'unread_count_customer' : 'unread_count_shop';

      let query: string;
      let params: any[];

      if (messagePreview) {
        query = `
          UPDATE conversations
          SET ${column} = ${column} + 1,
              last_message_at = NOW(),
              last_message_preview = $2
          WHERE conversation_id = $1
        `;
        params = [conversationId, messagePreview.substring(0, 100)]; // Limit to 100 chars
      } else {
        query = `
          UPDATE conversations
          SET ${column} = ${column} + 1,
              last_message_at = NOW()
          WHERE conversation_id = $1
        `;
        params = [conversationId];
      }

      await this.pool.query(query, params);
      logger.debug('Unread count incremented', { conversationId, receiverType, hasPreview: !!messagePreview });
    } catch (error) {
      logger.error('Error in incrementUnreadCount:', error);
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
      const column = userType === 'customer' ? 'unread_count_customer' : 'unread_count_shop';
      const whereColumn = userType === 'customer' ? 'customer_address' : 'shop_id';
      const archivedColumn = userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop';

      const query = `
        SELECT COALESCE(SUM(${column}), 0) as total
        FROM conversations
        WHERE ${whereColumn} = $1 AND ${archivedColumn} = FALSE
      `;

      const result = await this.pool.query(query, [userType === 'customer' ? userIdentifier.toLowerCase() : userIdentifier]);
      return parseInt(result.rows[0].total) || 0;
    } catch (error) {
      logger.error('Error in getTotalUnreadCount:', error);
      throw error;
    }
  }

  /**
   * Set archived status on a conversation for a specific user type
   */
  async setConversationArchived(
    conversationId: string,
    userType: 'customer' | 'shop',
    archived: boolean
  ): Promise<void> {
    try {
      const column = userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop';
      const query = `UPDATE conversations SET ${column} = $1, updated_at = NOW() WHERE conversation_id = $2`;
      await this.pool.query(query, [archived, conversationId]);
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
      const query = `
        INSERT INTO typing_indicators (conversation_id, user_address, user_type, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '10 seconds')
        ON CONFLICT (conversation_id, user_address)
        DO UPDATE SET expires_at = NOW() + INTERVAL '10 seconds'
      `;

      await this.pool.query(query, [conversationId, userAddress.toLowerCase(), userType]);
    } catch (error) {
      logger.error('Error in setTypingIndicator:', error);
      throw error;
    }
  }

  /**
   * Get typing indicators for conversation
   */
  async getTypingIndicators(conversationId: string): Promise<TypingIndicator[]> {
    try {
      const query = `
        SELECT * FROM typing_indicators
        WHERE conversation_id = $1 AND expires_at > NOW()
      `;

      const result = await this.pool.query(query, [conversationId]);
      return result.rows.map(row => this.mapTypingIndicatorRow(row));
    } catch (error) {
      logger.error('Error in getTypingIndicators:', error);
      throw error;
    }
  }

  /**
   * Clean up expired typing indicators
   */
  async cleanupExpiredTypingIndicators(): Promise<void> {
    try {
      await this.pool.query('SELECT cleanup_expired_typing_indicators()');
    } catch (error) {
      logger.error('Error in cleanupExpiredTypingIndicators:', error);
    }
  }

  /**
   * Archive a conversation for a user
   */
  async archiveConversation(
    conversationId: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      const column = userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop';
      const query = `
        UPDATE conversations
        SET ${column} = TRUE, updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
      logger.info('Conversation archived', { conversationId, userType });
    } catch (error) {
      logger.error('Error in archiveConversation:', error);
      throw error;
    }
  }

  /**
   * Unarchive a conversation for a user
   */
  async unarchiveConversation(
    conversationId: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      const column = userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop';
      const query = `
        UPDATE conversations
        SET ${column} = FALSE, updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
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
    blockedBy: 'customer' | 'shop'
  ): Promise<void> {
    try {
      const query = `
        UPDATE conversations
        SET is_blocked = TRUE, blocked_by = $2, blocked_at = NOW(), updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId, blockedBy]);
      logger.info('Conversation blocked', { conversationId, blockedBy });
    } catch (error) {
      logger.error('Error in blockConversation:', error);
      throw error;
    }
  }

  /**
   * Unblock a conversation
   */
  async unblockConversation(conversationId: string): Promise<void> {
    try {
      const query = `
        UPDATE conversations
        SET is_blocked = FALSE, blocked_by = NULL, blocked_at = NULL, updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
      logger.info('Conversation unblocked', { conversationId });
    } catch (error) {
      logger.error('Error in unblockConversation:', error);
      throw error;
    }
  }

  /**
   * Soft delete a conversation for a user (archive it)
   */
  async deleteConversation(
    conversationId: string,
    userType: 'customer' | 'shop'
  ): Promise<void> {
    try {
      // Soft delete by archiving for the user
      const column = userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop';
      const query = `
        UPDATE conversations
        SET ${column} = TRUE, updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
      logger.info('Conversation deleted (soft)', { conversationId, userType });
    } catch (error) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }

  /**
   * Mark a conversation as resolved
   */
  async resolveConversation(conversationId: string): Promise<void> {
    try {
      const query = `
        UPDATE conversations
        SET status = 'resolved', updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
      logger.info('Conversation resolved', { conversationId });
    } catch (error) {
      logger.error('Error in resolveConversation:', error);
      throw error;
    }
  }

  /**
   * Reopen a resolved conversation
   */
  async reopenConversation(conversationId: string): Promise<void> {
    try {
      const query = `
        UPDATE conversations
        SET status = 'open', updated_at = NOW()
        WHERE conversation_id = $1
      `;
      await this.pool.query(query, [conversationId]);
      logger.info('Conversation reopened', { conversationId });
    } catch (error) {
      logger.error('Error in reopenConversation:', error);
      throw error;
    }
  }

  /**
   * Map conversation database row to Conversation object
   */
  private mapConversationRow(row: any): Conversation {
    return {
      conversationId: row.conversation_id,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      unreadCountCustomer: parseInt(row.unread_count_customer) || 0,
      unreadCountShop: parseInt(row.unread_count_shop) || 0,
      isArchivedCustomer: row.is_archived_customer || false,
      isArchivedShop: row.is_archived_shop || false,
      isBlocked: row.is_blocked || false,
      blockedBy: row.blocked_by,
      blockedAt: row.blocked_at,
      status: row.status || 'open',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: row.customer_name,
      shopName: row.shop_name,
      shopImageUrl: row.shop_image_url
    };
  }

  /**
   * Map message database row to Message object
   */
  private mapMessageRow(row: any): Message {
    return {
      messageId: row.message_id,
      conversationId: row.conversation_id,
      senderAddress: row.sender_address,
      senderType: row.sender_type,
      messageText: row.message_text,
      messageType: row.message_type,
      attachments: row.attachments || [],
      metadata: row.metadata || {},
      isEncrypted: row.is_encrypted || false,
      isRead: row.is_read || false,
      readAt: row.read_at,
      isDelivered: row.is_delivered || false,
      deliveredAt: row.delivered_at,
      isDeleted: row.is_deleted || false,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      senderName: row.sender_name
    };
  }

  /**
   * Map typing indicator row
   */
  private mapTypingIndicatorRow(row: any): TypingIndicator {
    return {
      conversationId: row.conversation_id,
      userAddress: row.user_address,
      userType: row.user_type,
      startedAt: row.started_at,
      expiresAt: row.expires_at
    };
  }
}
