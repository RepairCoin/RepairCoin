import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

interface WebhookLog {
  id: string;
  source: string;
  event: string;
  payload: any;
  processed: boolean;
  processingTime?: number;
  result?: any;
  timestamp?: Date;
  retryCount?: number;
}

export class WebhookRepository extends BaseRepository {
  async recordWebhook(webhook: WebhookLog): Promise<void> {
    try {
      const query = `
        INSERT INTO webhook_logs (
          id, source, event, payload, 
          processed, processing_time, result, timestamp, retry_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `;
      
      await this.pool.query(query, [
        webhook.id,
        webhook.source,
        webhook.event,
        JSON.stringify(webhook.payload),
        webhook.processed,
        webhook.processingTime,
        webhook.result ? JSON.stringify(webhook.result) : null,
        webhook.retryCount || 0
      ]);
      
      logger.info('Webhook recorded', { 
        id: webhook.id,
        event: webhook.event,
        source: webhook.source
      });
    } catch (error) {
      logger.error('Error recording webhook:', error);
      throw new Error('Failed to record webhook');
    }
  }

  async getWebhook(id: string): Promise<WebhookLog | null> {
    try {
      const query = 'SELECT * FROM webhook_logs WHERE id = $1';
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        source: row.source,
        event: row.event,
        payload: row.payload,
        processed: row.processed,
        processingTime: row.processing_time,
        result: row.result,
        timestamp: row.timestamp,
        retryCount: row.retry_count || 0
      };
    } catch (error) {
      logger.error('Error fetching webhook:', error);
      throw new Error('Failed to fetch webhook');
    }
  }

  async updateWebhookProcessingStatus(
    id: string, 
    processed: boolean,
    processingTime?: number,
    result?: any
  ): Promise<void> {
    try {
      const query = `
        UPDATE webhook_logs 
        SET processed = $1, processing_time = $2, result = $3, updated_at = NOW()
        WHERE id = $4
      `;
      
      await this.pool.query(query, [
        processed,
        processingTime,
        result ? JSON.stringify(result) : null,
        id
      ]);
      
      logger.info('Webhook processing status updated', { id, processed });
    } catch (error) {
      logger.error('Error updating webhook processing status:', error);
      throw new Error('Failed to update webhook processing status');
    }
  }

  async getUnprocessedWebhooks(limit: number = 100): Promise<WebhookLog[]> {
    try {
      const query = `
        SELECT * FROM webhook_logs 
        WHERE processed = false
        ORDER BY timestamp ASC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        source: row.source,
        event: row.event,
        payload: row.payload,
        processed: row.processed,
        processingTime: row.processing_time,
        result: row.result,
        timestamp: row.timestamp,
        retryCount: row.retry_count || 0
      }));
    } catch (error) {
      logger.error('Error fetching unprocessed webhooks:', error);
      throw new Error('Failed to fetch unprocessed webhooks');
    }
  }

  async getFailedWebhooks(limit: number = 20): Promise<WebhookLog[]> {
    try {
      const query = `
        SELECT * FROM webhook_logs 
        WHERE processed = true 
        AND result->>'success' = 'false'
        ORDER BY timestamp DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        source: row.source,
        event: row.event,
        payload: row.payload,
        processed: row.processed,
        processingTime: row.processing_time,
        result: row.result,
        timestamp: row.timestamp,
        retryCount: row.retry_count || 0
      }));
    } catch (error) {
      logger.error('Error fetching failed webhooks:', error);
      throw new Error('Failed to fetch failed webhooks');
    }
  }

  async cleanupOldWebhooks(daysOld: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM webhook_logs 
        WHERE timestamp < NOW() - INTERVAL '${daysOld} days'
        AND status = 'success'
      `;
      
      const result = await this.pool.query(query);
      logger.info(`Cleaned up ${result.rowCount} old webhooks`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error cleaning up webhooks:', error);
      throw new Error('Failed to cleanup webhooks');
    }
  }
}