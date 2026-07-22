// backend/src/repositories/MessageRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';
import { shopHasFeature } from '../utils/shopTier';
/**
 * Which transport a conversation / message lives on. Phase 0 of the AI
 * Auto-Replies multi-channel expansion (see
 * docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md).
 * 'app' = the existing in-app chat (the default for every legacy row); 'sms'
 * and 'whatsapp' are wired in later phases behind ENABLE_CUSTOMER_SMS /
 * ENABLE_CUSTOMER_WHATSAPP.
 */
export type ConversationChannel = 'app' | 'sms' | 'whatsapp';

export interface Conversation {
  conversationId: string;
  customerAddress: string;
  shopId: string;
  /**
   * The channel this conversation lives on (migration 217). Defaults to 'app'
   * for every existing/in-app thread; SMS/WhatsApp conversations set it on
   * creation via the inbound channel router (Phase 1/2).
   */
  channel: ConversationChannel;
  // Phase 3 Task 8 — the service the customer is asking about. NULL on legacy
  // conversations and on threads not initiated from a service detail page.
  // The AI auto-reply hook only fires when this is set.
  serviceId?: string;
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
  customerImageUrl?: string;
  shopName?: string;
  shopImageUrl?: string;
  /**
   * Joined from shop_services.service_name on conversation.service_id.
   * Phase 6 of multi-service architecture: surfaced so the frontend chat
   * header can render a "Currently discussing: X" chip without a separate
   * service lookup. Undefined when conversation has no service_id or the
   * referenced service has been deleted.
   */
  serviceName?: string;
  /**
   * Computed at query time: TRUE only when BOTH the shop has
   * ai_shop_settings.ai_global_enabled=TRUE AND the conversation's
   * service has shop_services.ai_sales_enabled=TRUE. Used by the
   * customer-side chat UI to decide whether to show the "AI is typing"
   * indicator on a pending customer message — without this signal the
   * indicator fires (and times out 30s later) on conversations with
   * shops that don't have AI configured, misleading the customer.
   *
   * FALSE when ANY of these are true:
   *   - The shop has no ai_shop_settings row at all
   *   - ai_shop_settings.ai_global_enabled = false
   *   - The conversation has no service_id
   *   - The service has ai_sales_enabled = false
   */
  aiEnabled: boolean;
  /**
   * Phase 2 human-handoff state (see
   * docs/tasks/strategy/ai-human-handoff-clash.md). When set in the
   * future, the AI orchestrator skips its reply (SkipReason 'ai_paused').
   * NULL = AI is active.
   *
   *   - 30-second auto race window: bumped whenever a non-AI shop
   *     message lands, preventing the AI from talking over staff who's
   *     actively replying. After 30s of staff silence, AI is back.
   *   - Indefinite takeover: shop dashboard "Take Over" button sets
   *     this to NOW() + 100 years. "Resume AI" clears to NULL.
   */
  aiPausedUntil?: Date;
}

export interface Message {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType: 'text' | 'booking_link' | 'service_link' | 'system' | 'encrypted';
  /** Transport this message was sent/received on (migration 217). Defaults to 'app'. */
  channel: ConversationChannel;
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
  clientMessageId?: string;
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
  clientMessageId?: string;
  /** Transport for this message. Omitted → 'app' (DB default). */
  channel?: ConversationChannel;
}

export interface CreateMessageResult {
  message: Message;
  created: boolean;
}

export class MessageRepository extends BaseRepository {
  /**
   * Get or create a conversation between customer and shop.
   *
   * @param serviceId Optional. When provided:
   *   - On creation: stored on the new conversation row
   *   - On existing conversation: updates service_id to this value if it
   *     differs (so the most recent service the customer is asking about
   *     wins — AgentOrchestrator's prompt context follows their intent)
   *   - When omitted on existing conversation: existing service_id is preserved
   *
   * The AI auto-reply hook in MessageService keys off the conversation's
   * resolved service_id (Phase 3 Task 8).
   */
  async getOrCreateConversation(
    customerAddress: string,
    shopId: string,
    serviceId?: string
  ): Promise<Conversation> {
    try {
      // Try to get existing conversation
      const query = `
        SELECT
          c.*,
          cust.name as customer_name,
          cust.profile_image_url as customer_image_url,
          s.name as shop_name,
          s.logo_url as shop_image_url,
          srv.service_name as service_name
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        LEFT JOIN shop_services srv ON c.service_id = srv.service_id
        WHERE c.customer_address = $1 AND c.shop_id = $2
      `;

      let result = await this.pool.query(query, [customerAddress.toLowerCase(), shopId]);

      if (result.rows.length > 0) {
        const existing = this.mapConversationRow(result.rows[0]);

        // Update service_id if the caller explicitly passed one and it differs.
        // Customer's most recent service intent wins. Plain message-sends that
        // don't pass serviceId leave the conversation unchanged.
        if (serviceId && existing.serviceId !== serviceId) {
          await this.pool.query(
            `UPDATE conversations SET service_id = $1, updated_at = NOW() WHERE conversation_id = $2`,
            [serviceId, existing.conversationId]
          );
          existing.serviceId = serviceId;
        }

        return existing;
      }

      // Create new conversation (with service_id if provided)
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const insertQuery = `
        INSERT INTO conversations (
          conversation_id, customer_address, shop_id, service_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      result = await this.pool.query(insertQuery, [
        conversationId,
        customerAddress.toLowerCase(),
        shopId,
        serviceId ?? null
      ]);

      logger.info('Conversation created', { conversationId, customerAddress, shopId, serviceId });

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
          cust.profile_image_url as customer_image_url,
          s.name as shop_name,
          s.logo_url as shop_image_url,
          srv.service_name as service_name
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        LEFT JOIN shop_services srv ON c.service_id = srv.service_id
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

      // Get conversations. Joins ai_shop_settings + reuses the existing
      // shop_services join to compute ai_enabled on each row — saves the
      // frontend a separate lookup per conversation when deciding whether
      // to show the "AI is typing" indicator.
      const query = `
        SELECT
          c.*,
          s.name as shop_name,
          s.logo_url as shop_image_url,
          srv.service_name as service_name,
          (COALESCE(ais.ai_global_enabled, false) AND COALESCE(srv.ai_sales_enabled, false)) AS ai_enabled
        FROM conversations c
        LEFT JOIN shops s ON c.shop_id = s.shop_id
        LEFT JOIN shop_services srv ON c.service_id = srv.service_id
        LEFT JOIN ai_shop_settings ais ON c.shop_id = ais.shop_id
        ${whereClause}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.pool.query(query, [...params, limit, offset]);

      return {
        items: await this.applyAutoReplyTierGate(
          result.rows.map(row => this.mapConversationRow(row))
        ),
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
   * WS2 — the customer-side "AI is typing" indicator gates on aiEnabled. The SQL
   * computes aiEnabled = ai_global_enabled AND ai_sales_enabled, which doesn't
   * know the AI Auto-Replies TIER gate. When that gate is enforced
   * (ENFORCE_AI_AUTOREPLY_TIER=true), a below-Business shop's AI won't auto-reply,
   * so aiEnabled must be forced false here — otherwise the customer sees a typing
   * loader that never resolves. Flag-gated: zero work + zero behavior change when
   * the flag is off (the default). Deduped per shop so a multi-shop customer list
   * costs one entitlement lookup per shop, not per conversation.
   */
  private async applyAutoReplyTierGate(items: Conversation[]): Promise<Conversation[]> {
    if (process.env.ENFORCE_AI_AUTOREPLY_TIER !== 'true') return items;
    const shopIds = [...new Set(items.filter(i => i.aiEnabled).map(i => i.shopId))];
    if (shopIds.length === 0) return items;
    const entitled = new Map<string, boolean>();
    await Promise.all(
      shopIds.map(async id => { entitled.set(id, await shopHasFeature(id, 'aiAutoReplies')); })
    );
    for (const item of items) {
      if (item.aiEnabled && entitled.get(item.shopId) === false) {
        item.aiEnabled = false;
      }
    }
    return items;
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

      // Get conversations. Same ai_enabled computation as the customer
      // path — the shop dashboard surfaces the field too (future: gates
      // the "AI is typing on your behalf" indicator for shop staff).
      const query = `
        SELECT
          c.*,
          cust.name as customer_name,
          cust.profile_image_url as customer_image_url,
          srv.service_name as service_name,
          (COALESCE(ais.ai_global_enabled, false) AND COALESCE(srv.ai_sales_enabled, false)) AS ai_enabled
        FROM conversations c
        LEFT JOIN customers cust ON c.customer_address = cust.address
        LEFT JOIN shop_services srv ON c.service_id = srv.service_id
        LEFT JOIN ai_shop_settings ais ON c.shop_id = ais.shop_id
        ${whereClause}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.pool.query(query, [...params, limit, offset]);

      return {
        items: await this.applyAutoReplyTierGate(
          result.rows.map(row => this.mapConversationRow(row))
        ),
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
   * Create a message.
   *
   * When `clientMessageId` is supplied, the insert is idempotent: on conflict
   * against the (conversation_id, client_message_id) partial unique index the
   * existing row is returned with `created: false`. Callers can use this flag
   * to skip duplicate side-effects (unread count, email, WS push).
   */
  async createMessage(params: CreateMessageParams): Promise<CreateMessageResult> {
    try {
      const insertQuery = `
        INSERT INTO messages (
          message_id,
          conversation_id,
          sender_address,
          sender_type,
          message_text,
          message_type,
          metadata,
          attachments,
          is_encrypted,
          client_message_id,
          channel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (conversation_id, client_message_id) WHERE client_message_id IS NOT NULL
          DO NOTHING
        RETURNING *
      `;

      const insertResult = await this.pool.query(insertQuery, [
        params.messageId,
        params.conversationId,
        params.senderAddress.toLowerCase(),
        params.senderType,
        params.messageText,
        params.messageType || 'text',
        JSON.stringify(params.metadata || {}),
        JSON.stringify(params.attachments || []),
        params.isEncrypted || false,
        params.clientMessageId || null,
        params.channel || 'app'
      ]);

      if (insertResult.rows.length > 0) {
        logger.info('Message created', {
          messageId: params.messageId,
          conversationId: params.conversationId,
          senderType: params.senderType
        });

        // Phase 2 human-handoff: when a NON-AI shop staff message lands,
        // bump conversations.ai_paused_until forward 30 seconds. This is
        // the race-window pause that prevents the AI from firing on top
        // of staff who is actively typing (the staging trace bug). Each
        // new staff message slides the window forward; staff silence for
        // 30s lets the AI resume on the next customer turn.
        //
        // AI messages (metadata.generated_by === 'ai_agent') do NOT bump —
        // the orchestrator already gates itself on this column, and the
        // AI bumping its own pause column would create a feedback loop.
        // Customer messages also don't bump.
        //
        // We intentionally run this AFTER the message insert (not in the
        // same statement) so that a slow conversations UPDATE never
        // blocks the message-send response path. The window is short
        // enough that minor lag is harmless.
        const isHumanShopMessage =
          params.senderType === 'shop' &&
          (params.metadata as any)?.generated_by !== 'ai_agent';
        if (isHumanShopMessage) {
          try {
            await this.pool.query(
              `UPDATE conversations
                 SET ai_paused_until = NOW() + INTERVAL '30 seconds',
                     updated_at = NOW()
               WHERE conversation_id = $1
                 AND (ai_paused_until IS NULL
                      OR ai_paused_until < NOW() + INTERVAL '1 hour')`,
              [params.conversationId]
            );
            // The `< NOW() + INTERVAL '1 hour'` guard preserves the
            // explicit Take Over state: if the shop dashboard set
            // ai_paused_until to NOW() + 100 years, this bump shouldn't
            // shorten it back down to 30s. 1 hour is comfortably above
            // any auto-bump value and well below any indefinite hold.
          } catch (pauseErr) {
            // Never let the pause update fail the message send.
            // Worst case: the AI fires on the next customer turn —
            // a degraded behavior, not a broken one.
            logger.error('Failed to bump ai_paused_until on shop message:', {
              conversationId: params.conversationId,
              messageId: params.messageId,
              error: (pauseErr as Error)?.message,
            });
          }
        }

        return { message: this.mapMessageRow(insertResult.rows[0]), created: true };
      }

      // Conflict: a row already exists for (conversation_id, client_message_id).
      // Fetch and return it so the caller sees a Message, but flag as duplicate.
      const selectResult = await this.pool.query(
        `SELECT * FROM messages WHERE conversation_id = $1 AND client_message_id = $2 LIMIT 1`,
        [params.conversationId, params.clientMessageId]
      );

      if (selectResult.rows.length === 0) {
        throw new Error('createMessage: conflict hit but no existing row found');
      }

      logger.info('Message dedup: existing row returned', {
        conversationId: params.conversationId,
        clientMessageId: params.clientMessageId
      });

      return { message: this.mapMessageRow(selectResult.rows[0]), created: false };
    } catch (error) {
      logger.error('Error in createMessage:', error);
      throw error;
    }
  }

  /**
   * Fetch a single message by id (e.g. to read back an AI reply the orchestrator just
   * persisted, so it can be relayed over an off-app channel like SMS). Null when not found.
   */
  async getMessageById(messageId: string): Promise<Message | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM messages WHERE message_id = $1 LIMIT 1`,
        [messageId]
      );
      return result.rows.length > 0 ? this.mapMessageRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error in getMessageById:', error);
      throw error;
    }
  }

  /** Stamp a conversation's channel (e.g. a guest SMS conversation is sms-only). */
  async setConversationChannel(conversationId: string, channel: ConversationChannel): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE conversations SET channel = $1, updated_at = NOW() WHERE conversation_id = $2`,
        [channel, conversationId]
      );
    } catch (error) {
      logger.error('Error in setConversationChannel:', error);
      throw error;
    }
  }

  /** Stamp a message's channel (e.g. after relaying an AI reply over SMS). */
  async setMessageChannel(messageId: string, channel: ConversationChannel): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE messages SET channel = $1, updated_at = NOW() WHERE message_id = $2`,
        [channel, messageId]
      );
    } catch (error) {
      logger.error('Error in setMessageChannel:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation (paginated)
   */
  async getConversationMessages(
    conversationId: string,
    options: { page?: number; limit?: number; sort?: 'asc' | 'desc' } = {}
  ): Promise<PaginatedResult<Message>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const offset = (page - 1) * limit;
      const sortOrder = options.sort === 'desc' ? 'DESC' : 'ASC';

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages
        WHERE conversation_id = $1 AND is_deleted = FALSE
      `;
      const countResult = await this.pool.query(countQuery, [conversationId]);
      const total = parseInt(countResult.rows[0].total);

      // Get messages
      const query = `
        SELECT
          m.*,
          COALESCE(c.name, s.name) as sender_name
        FROM messages m
        LEFT JOIN customers c ON m.sender_address = c.address AND m.sender_type = 'customer'
        LEFT JOIN shops s ON m.sender_address = s.shop_id AND m.sender_type = 'shop'
        WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
        ORDER BY m.created_at ${sortOrder}
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
   * Get the MOST RECENT `limit` messages of a conversation, returned
   * OLDEST-FIRST.
   *
   * This is deliberately distinct from getConversationMessages(sort:'asc'):
   * that runs `ORDER BY created_at ASC LIMIT N`, which returns the OLDEST
   * N messages — fine for forward pagination from page 1, but WRONG for
   * "give me the tail of the conversation". Once a thread exceeds N
   * messages the ASC+LIMIT form silently freezes on the first N and never
   * returns anything newer.
   *
   * The AI ContextBuilder needs the recent window (the orchestrator reads
   * the last element as "the message Claude is about to reply to"). It
   * previously used getConversationMessages(sort:'asc', limit:20), so on
   * any conversation past 20 messages the AI lost all recent context and
   * kept replying to a stale turn (observed 2026-05-15: customer asked an
   * off-topic question, AI repeated its earlier "you're welcome").
   *
   * Implementation: take the newest N via `DESC LIMIT N` in a subquery,
   * then re-sort that window ASC so the caller gets oldest-first.
   */
  async getRecentConversationMessages(
    conversationId: string,
    limit: number
  ): Promise<Message[]> {
    try {
      const query = `
        SELECT * FROM (
          SELECT
            m.*,
            COALESCE(c.name, s.name) as sender_name
          FROM messages m
          LEFT JOIN customers c ON m.sender_address = c.address AND m.sender_type = 'customer'
          LEFT JOIN shops s ON m.sender_address = s.shop_id AND m.sender_type = 'shop'
          WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
          ORDER BY m.created_at DESC
          LIMIT $2
        ) recent
        ORDER BY recent.created_at ASC
      `;
      const result = await this.pool.query(query, [conversationId, limit]);
      return result.rows.map(row => this.mapMessageRow(row));
    } catch (error) {
      logger.error('Error in getRecentConversationMessages:', error);
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
   * Soft-delete a single message. Only the original sender may delete it.
   * Returns true if a row was updated, false if not found / not the sender.
   *
   * Also refreshes the conversation's denormalized preview. Thread reads filter on
   * is_deleted, but the conversation list reads last_message_preview — without this the
   * deleted message keeps showing in the inbox after it has vanished from the thread.
   */
  async deleteMessage(messageId: string, senderAddress: string): Promise<boolean> {
    try {
      return await this.withTransaction(async (client) => {
        const result = await client.query(
          `UPDATE messages
              SET is_deleted = TRUE, updated_at = NOW()
            WHERE message_id = $1
              AND sender_address = $2
              AND is_deleted = FALSE
            RETURNING conversation_id`,
          [messageId, senderAddress]
        );

        if ((result.rowCount ?? 0) === 0) return false;
        const conversationId = result.rows[0].conversation_id;

        // Point the preview at the newest surviving message...
        await client.query(
          `UPDATE conversations c
              SET last_message_preview = LEFT(m.message_text, 100),
                  last_message_at = m.created_at
             FROM (
               SELECT message_text, created_at
                 FROM messages
                WHERE conversation_id = $1 AND is_deleted = FALSE
                ORDER BY created_at DESC
                LIMIT 1
             ) m
            WHERE c.conversation_id = $1`,
          [conversationId]
        );

        // ...or clear it when nothing survives (the FROM above matches no rows then).
        await client.query(
          `UPDATE conversations
              SET last_message_preview = NULL
            WHERE conversation_id = $1
              AND NOT EXISTS (
                SELECT 1 FROM messages WHERE conversation_id = $1 AND is_deleted = FALSE
              )`,
          [conversationId]
        );

        return true;
      });
    } catch (error) {
      logger.error('Error in deleteMessage:', error);
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
   * Phase 2 human-handoff: shop dashboard "Take Over" button. Sets
   * ai_paused_until to NOW() + 100 years (effectively indefinite hold).
   * The orchestrator prefilter reads this column and skips with
   * SkipReason 'ai_paused' as long as the timestamp is in the future.
   * Cleared back to NULL by resumeAiOnConversation.
   */
  async takeoverAiOnConversation(conversationId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE conversations
           SET ai_paused_until = NOW() + INTERVAL '100 years',
               updated_at = NOW()
         WHERE conversation_id = $1`,
        [conversationId]
      );
      logger.info('Conversation takeover set', { conversationId });
    } catch (error) {
      logger.error('Error in takeoverAiOnConversation:', error);
      throw error;
    }
  }

  /**
   * Phase 2 human-handoff: shop dashboard "Resume AI" button. Clears
   * ai_paused_until to NULL. AI orchestrator will fire normally on the
   * next customer message — regardless of how it was paused (auto race
   * window OR explicit takeover).
   */
  async resumeAiOnConversation(conversationId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE conversations
           SET ai_paused_until = NULL,
               updated_at = NOW()
         WHERE conversation_id = $1`,
        [conversationId]
      );
      logger.info('Conversation AI resumed', { conversationId });
    } catch (error) {
      logger.error('Error in resumeAiOnConversation:', error);
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
      // Defaults to 'app' on legacy rows / queries that predate migration 217.
      channel: (row.channel as ConversationChannel) ?? 'app',
      serviceId: row.service_id ?? undefined,
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
      customerImageUrl: row.customer_image_url,
      shopName: row.shop_name,
      shopImageUrl: row.shop_image_url,
      serviceName: row.service_name ?? undefined,
      // Default to false on legacy queries that don't SELECT ai_enabled
      // (e.g. internal helpers like getConversationById). Only the list
      // endpoints expose this honestly; everywhere else gets a safe
      // "AI not assumed" default.
      aiEnabled: row.ai_enabled === true,
      // Phase 2 pause state. Read from c.* on every query that does
      // SELECT c.*. The column was added in migration 114, defaults
      // NULL on existing rows so legacy behavior (AI active) is
      // preserved.
      aiPausedUntil: row.ai_paused_until ?? undefined,
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
      channel: (row.channel as ConversationChannel) ?? 'app',
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
      clientMessageId: row.client_message_id || undefined,
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
