// backend/src/repositories/AutoMessageRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface AutoMessage {
  id: string;
  shopId: string;
  name: string;
  messageTemplate: string;
  triggerType: 'schedule' | 'event';
  scheduleType: string | null;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  scheduleHour: number;
  eventType: string | null;
  delayHours: number;
  targetAudience: string;
  isActive: boolean;
  maxSendsPerCustomer: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoMessageSend {
  id: string;
  autoMessageId: string;
  shopId: string;
  customerAddress: string;
  conversationId: string | null;
  messageId: string | null;
  triggerReference: string | null;
  status: 'pending' | 'sent' | 'failed';
  scheduledSendAt: string | null;
  sentAt: string;
}

export interface CreateAutoMessageParams {
  shopId: string;
  name: string;
  messageTemplate: string;
  triggerType: 'schedule' | 'event';
  scheduleType?: string;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  scheduleHour?: number;
  eventType?: string;
  delayHours?: number;
  targetAudience?: string;
  maxSendsPerCustomer?: number;
}

export interface UpdateAutoMessageParams {
  name?: string;
  messageTemplate?: string;
  triggerType?: 'schedule' | 'event';
  scheduleType?: string;
  scheduleDayOfWeek?: number | null;
  scheduleDayOfMonth?: number | null;
  scheduleHour?: number;
  eventType?: string | null;
  delayHours?: number;
  targetAudience?: string;
  maxSendsPerCustomer?: number;
}

export class AutoMessageRepository extends BaseRepository {

  /**
   * Get all auto-message rules for a shop
   */
  async getByShopId(shopId: string): Promise<AutoMessage[]> {
    try {
      const query = `
        SELECT am.*,
          (SELECT COUNT(*) FROM auto_message_sends ams WHERE ams.auto_message_id = am.id AND ams.status = 'sent') AS total_sends,
          (SELECT MAX(ams.sent_at) FROM auto_message_sends ams WHERE ams.auto_message_id = am.id AND ams.status = 'sent') AS last_sent_at
        FROM shop_auto_messages am
        WHERE am.shop_id = $1
        ORDER BY am.created_at DESC
      `;
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getByShopId:', error);
      throw error;
    }
  }

  /**
   * Get a single auto-message rule by ID
   */
  async getById(id: string): Promise<AutoMessage | null> {
    try {
      const query = `
        SELECT am.*,
          (SELECT COUNT(*) FROM auto_message_sends ams WHERE ams.auto_message_id = am.id AND ams.status = 'sent') AS total_sends,
          (SELECT MAX(ams.sent_at) FROM auto_message_sends ams WHERE ams.auto_message_id = am.id AND ams.status = 'sent') AS last_sent_at
        FROM shop_auto_messages am
        WHERE am.id = $1
      `;
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getById:', error);
      throw error;
    }
  }

  /**
   * Create a new auto-message rule
   */
  async create(params: CreateAutoMessageParams): Promise<AutoMessage> {
    try {
      const query = `
        INSERT INTO shop_auto_messages (
          shop_id, name, message_template, trigger_type,
          schedule_type, schedule_day_of_week, schedule_day_of_month, schedule_hour,
          event_type, delay_hours, target_audience, max_sends_per_customer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const result = await this.pool.query(query, [
        params.shopId,
        params.name,
        params.messageTemplate,
        params.triggerType,
        params.scheduleType || null,
        params.scheduleDayOfWeek ?? null,
        params.scheduleDayOfMonth ?? null,
        params.scheduleHour ?? 10,
        params.eventType || null,
        params.delayHours ?? 0,
        params.targetAudience || 'all',
        params.maxSendsPerCustomer ?? 1,
      ]);
      logger.info('Auto-message rule created', { shopId: params.shopId, name: params.name });
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.create:', error);
      throw error;
    }
  }

  /**
   * Update an existing auto-message rule (only if it belongs to the shop)
   */
  async update(id: string, shopId: string, params: UpdateAutoMessageParams): Promise<AutoMessage | null> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const fields: [string, any][] = [
        ['name', params.name],
        ['message_template', params.messageTemplate],
        ['trigger_type', params.triggerType],
        ['schedule_type', params.scheduleType],
        ['schedule_day_of_week', params.scheduleDayOfWeek],
        ['schedule_day_of_month', params.scheduleDayOfMonth],
        ['schedule_hour', params.scheduleHour],
        ['event_type', params.eventType],
        ['delay_hours', params.delayHours],
        ['target_audience', params.targetAudience],
        ['max_sends_per_customer', params.maxSendsPerCustomer],
      ];

      for (const [column, value] of fields) {
        if (value !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (setClauses.length === 0) {
        return this.getById(id);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id, shopId);

      const query = `
        UPDATE shop_auto_messages
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++} AND shop_id = $${paramIndex++}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) return null;

      logger.info('Auto-message rule updated', { id, shopId });
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.update:', error);
      throw error;
    }
  }

  /**
   * Delete an auto-message rule (hard delete — also deletes send history)
   */
  async delete(id: string, shopId: string): Promise<boolean> {
    try {
      // Delete send history first (FK constraint)
      await this.pool.query(
        `DELETE FROM auto_message_sends WHERE auto_message_id = $1 AND shop_id = $2`,
        [id, shopId]
      );

      const result = await this.pool.query(
        `DELETE FROM shop_auto_messages WHERE id = $1 AND shop_id = $2`,
        [id, shopId]
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Auto-message rule deleted', { id, shopId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error in AutoMessageRepository.delete:', error);
      throw error;
    }
  }

  /**
   * Toggle active status of an auto-message rule
   */
  async toggleActive(id: string, shopId: string): Promise<AutoMessage | null> {
    try {
      const query = `
        UPDATE shop_auto_messages
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1 AND shop_id = $2
        RETURNING *
      `;
      const result = await this.pool.query(query, [id, shopId]);
      if (result.rows.length === 0) return null;

      logger.info('Auto-message rule toggled', { id, shopId, isActive: result.rows[0].is_active });
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.toggleActive:', error);
      throw error;
    }
  }

  /**
   * Get send history for an auto-message rule
   */
  async getSendHistory(autoMessageId: string, shopId: string, options?: { page?: number; limit?: number }): Promise<{ items: AutoMessageSend[]; total: number }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const countQuery = `
        SELECT COUNT(*) FROM auto_message_sends
        WHERE auto_message_id = $1 AND shop_id = $2
      `;
      const countResult = await this.pool.query(countQuery, [autoMessageId, shopId]);
      const total = parseInt(countResult.rows[0].count, 10);

      const query = `
        SELECT * FROM auto_message_sends
        WHERE auto_message_id = $1 AND shop_id = $2
        ORDER BY sent_at DESC
        LIMIT $3 OFFSET $4
      `;
      const result = await this.pool.query(query, [autoMessageId, shopId, limit, offset]);

      return {
        items: result.rows.map(row => this.mapSendRow(row)),
        total,
      };
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getSendHistory:', error);
      throw error;
    }
  }

  /**
   * Record a send (or schedule a pending send)
   */
  async recordSend(params: {
    autoMessageId: string;
    shopId: string;
    customerAddress: string;
    conversationId?: string;
    messageId?: string;
    triggerReference?: string;
    status?: 'pending' | 'sent' | 'failed';
    scheduledSendAt?: Date;
  }): Promise<AutoMessageSend> {
    try {
      const query = `
        INSERT INTO auto_message_sends (
          auto_message_id, shop_id, customer_address, conversation_id,
          message_id, trigger_reference, status, scheduled_send_at, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const result = await this.pool.query(query, [
        params.autoMessageId,
        params.shopId,
        params.customerAddress,
        params.conversationId || null,
        params.messageId || null,
        params.triggerReference || null,
        params.status || 'sent',
        params.scheduledSendAt || null,
        params.status === 'pending' ? null : new Date(),
      ]);
      return this.mapSendRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.recordSend:', error);
      throw error;
    }
  }

  /**
   * Get all active event-based rules for a given event type (across all shops)
   */
  async getAllActiveEventRulesByType(eventType: string): Promise<AutoMessage[]> {
    try {
      const query = `
        SELECT * FROM shop_auto_messages
        WHERE is_active = true AND trigger_type = 'event' AND event_type = $1
        ORDER BY shop_id
      `;
      const result = await this.pool.query(query, [eventType]);
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getAllActiveEventRulesByType:', error);
      throw error;
    }
  }

  /**
   * Check if a rule has sent to a customer within the last N days
   */
  async hasSentWithinDays(autoMessageId: string, customerAddress: string, days: number): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) FROM auto_message_sends
        WHERE auto_message_id = $1 AND customer_address = $2 AND status = 'sent'
        AND sent_at >= NOW() - INTERVAL '1 day' * $3
      `;
      const result = await this.pool.query(query, [autoMessageId, customerAddress, days]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error in AutoMessageRepository.hasSentWithinDays:', error);
      throw error;
    }
  }

  /**
   * Get active event-based rules for a specific shop and event type
   */
  async getActiveEventRules(shopId: string, eventType: string): Promise<AutoMessage[]> {
    try {
      const query = `
        SELECT * FROM shop_auto_messages
        WHERE is_active = true AND trigger_type = 'event'
          AND shop_id = $1 AND event_type = $2
        ORDER BY created_at ASC
      `;
      const result = await this.pool.query(query, [shopId, eventType]);
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getActiveEventRules:', error);
      throw error;
    }
  }

  /**
   * Get all active schedule-based rules (for the scheduler service)
   */
  async getActiveScheduleRules(): Promise<AutoMessage[]> {
    try {
      const query = `
        SELECT * FROM shop_auto_messages
        WHERE is_active = true AND trigger_type = 'schedule'
        ORDER BY shop_id
      `;
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getActiveScheduleRules:', error);
      throw error;
    }
  }

  /**
   * Get pending sends that are due
   */
  async getPendingSends(): Promise<AutoMessageSend[]> {
    try {
      const query = `
        SELECT * FROM auto_message_sends
        WHERE status = 'pending' AND scheduled_send_at <= NOW()
        ORDER BY scheduled_send_at ASC
      `;
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSendRow(row));
    } catch (error) {
      logger.error('Error in AutoMessageRepository.getPendingSends:', error);
      throw error;
    }
  }

  /**
   * Update send status (pending -> sent/failed)
   */
  async updateSendStatus(sendId: string, status: 'sent' | 'failed', messageId?: string, conversationId?: string): Promise<void> {
    try {
      const query = `
        UPDATE auto_message_sends
        SET status = $1, message_id = COALESCE($2, message_id), conversation_id = COALESCE($3, conversation_id), sent_at = NOW()
        WHERE id = $4
      `;
      await this.pool.query(query, [status, messageId || null, conversationId || null, sendId]);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.updateSendStatus:', error);
      throw error;
    }
  }

  /**
   * Count sends for a specific rule + customer (for max_sends_per_customer check)
   */
  async countSendsForCustomer(autoMessageId: string, customerAddress: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) FROM auto_message_sends
        WHERE auto_message_id = $1 AND customer_address = $2 AND status = 'sent'
      `;
      const result = await this.pool.query(query, [autoMessageId, customerAddress]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error in AutoMessageRepository.countSendsForCustomer:', error);
      throw error;
    }
  }

  /**
   * Check if a send already exists for a specific trigger reference (prevents duplicate event sends)
   */
  async hasSendForTriggerReference(autoMessageId: string, customerAddress: string, triggerReference: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) FROM auto_message_sends
        WHERE auto_message_id = $1 AND customer_address = $2 AND trigger_reference = $3
      `;
      const result = await this.pool.query(query, [autoMessageId, customerAddress, triggerReference]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error in AutoMessageRepository.hasSendForTriggerReference:', error);
      throw error;
    }
  }

  /**
   * Check if a scheduled rule has already sent today (for daily dedup)
   */
  async hasSentToday(autoMessageId: string, customerAddress: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) FROM auto_message_sends
        WHERE auto_message_id = $1 AND customer_address = $2 AND status = 'sent'
        AND sent_at >= CURRENT_DATE
      `;
      const result = await this.pool.query(query, [autoMessageId, customerAddress]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error in AutoMessageRepository.hasSentToday:', error);
      throw error;
    }
  }

  private mapRow(row: any): AutoMessage & { totalSends?: number; lastSentAt?: string } {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      messageTemplate: row.message_template,
      triggerType: row.trigger_type,
      scheduleType: row.schedule_type,
      scheduleDayOfWeek: row.schedule_day_of_week,
      scheduleDayOfMonth: row.schedule_day_of_month,
      scheduleHour: row.schedule_hour,
      eventType: row.event_type,
      delayHours: row.delay_hours,
      targetAudience: row.target_audience,
      isActive: row.is_active,
      maxSendsPerCustomer: row.max_sends_per_customer,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalSends: row.total_sends ? parseInt(row.total_sends, 10) : undefined,
      lastSentAt: row.last_sent_at || undefined,
    };
  }

  private mapSendRow(row: any): AutoMessageSend {
    return {
      id: row.id,
      autoMessageId: row.auto_message_id,
      shopId: row.shop_id,
      customerAddress: row.customer_address,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      triggerReference: row.trigger_reference,
      status: row.status,
      scheduledSendAt: row.scheduled_send_at,
      sentAt: row.sent_at,
    };
  }
}
