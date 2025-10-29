// backend/src/repositories/WebhookLogRepository.ts
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface WebhookLog {
  id: number;
  webhookId: string;
  eventType: string;
  source: 'stripe' | 'fixflow' | 'thirdweb' | 'other';
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retry';
  httpStatus?: number;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookLogInput {
  webhookId: string;
  eventType: string;
  source: 'stripe' | 'fixflow' | 'thirdweb' | 'other';
  payload: Record<string, unknown>;
  httpStatus?: number;
}

export interface UpdateWebhookLogInput {
  status?: 'processing' | 'success' | 'failed' | 'retry';
  httpStatus?: number;
  response?: Record<string, unknown>;
  errorMessage?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  processedAt?: Date;
}

export interface WebhookHealthMetrics {
  source: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  retryCount: number;
  avgProcessingTimeMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

export class WebhookLogRepository extends BaseRepository {
  constructor(pool?: Pool) {
    super(pool);
  }

  /**
   * Create a new webhook log entry
   */
  async create(input: CreateWebhookLogInput): Promise<WebhookLog> {
    const query = `
      INSERT INTO webhook_logs (
        webhook_id, event_type, source, payload, http_status, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const values = [
      input.webhookId,
      input.eventType,
      input.source,
      JSON.stringify(input.payload),
      input.httpStatus
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update webhook log
   */
  async update(id: number, input: UpdateWebhookLogInput): Promise<WebhookLog> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(input.status);
    }

    if (input.httpStatus !== undefined) {
      updates.push(`http_status = $${paramCount++}`);
      values.push(input.httpStatus);
    }

    if (input.response !== undefined) {
      updates.push(`response = $${paramCount++}`);
      values.push(JSON.stringify(input.response));
    }

    if (input.errorMessage !== undefined) {
      updates.push(`error_message = $${paramCount++}`);
      values.push(input.errorMessage);
    }

    if (input.retryCount !== undefined) {
      updates.push(`retry_count = $${paramCount++}`);
      values.push(input.retryCount);
    }

    if (input.lastRetryAt !== undefined) {
      updates.push(`last_retry_at = $${paramCount++}`);
      values.push(input.lastRetryAt);
    }

    if (input.processedAt !== undefined) {
      updates.push(`processed_at = $${paramCount++}`);
      values.push(input.processedAt);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const query = `
      UPDATE webhook_logs
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find webhook log by ID
   */
  async findById(id: number): Promise<WebhookLog | null> {
    const query = `
      SELECT
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM webhook_logs
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find webhook log by webhook ID
   */
  async findByWebhookId(webhookId: string): Promise<WebhookLog | null> {
    const query = `
      SELECT
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM webhook_logs
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [webhookId]);
    return result.rows[0] || null;
  }

  /**
   * Get paginated webhook logs
   */
  async getPaginated(params: {
    page?: number;
    limit?: number;
    source?: string;
    status?: string;
    eventType?: string;
  }): Promise<{ items: WebhookLog[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (params.source) {
      whereClauses.push(`source = $${paramCount++}`);
      values.push(params.source);
    }

    if (params.status) {
      whereClauses.push(`status = $${paramCount++}`);
      values.push(params.status);
    }

    if (params.eventType) {
      whereClauses.push(`event_type = $${paramCount++}`);
      values.push(params.eventType);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM webhook_logs ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);

    const query = `
      SELECT
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM webhook_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const result = await this.pool.query(query, values);

    return {
      items: result.rows,
      total,
      page,
      limit
    };
  }

  /**
   * Get failed webhooks that need retry
   */
  async getFailedForRetry(maxRetries: number = 3): Promise<WebhookLog[]> {
    const query = `
      SELECT
        id,
        webhook_id AS "webhookId",
        event_type AS "eventType",
        source,
        status,
        http_status AS "httpStatus",
        payload,
        response,
        error_message AS "errorMessage",
        retry_count AS "retryCount",
        last_retry_at AS "lastRetryAt",
        processed_at AS "processedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM webhook_logs
      WHERE status = 'failed'
      AND retry_count < $1
      AND (last_retry_at IS NULL OR last_retry_at < NOW() - INTERVAL '5 minutes')
      ORDER BY created_at ASC
      LIMIT 100
    `;

    const result = await this.pool.query(query, [maxRetries]);
    return result.rows;
  }

  /**
   * Get webhook health metrics
   */
  async getHealthMetrics(): Promise<WebhookHealthMetrics[]> {
    const query = `SELECT * FROM get_webhook_health()`;

    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      source: row.source,
      totalCount: parseInt(row.total_count),
      successCount: parseInt(row.success_count),
      failedCount: parseInt(row.failed_count),
      retryCount: parseInt(row.retry_count),
      avgProcessingTimeMs: parseFloat(row.avg_processing_time_ms || 0),
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at
    }));
  }

  /**
   * Delete old webhook logs
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const query = `SELECT cleanup_old_webhook_logs($1)`;
    const result = await this.pool.query(query, [retentionDays]);
    return parseInt(result.rows[0].cleanup_old_webhook_logs);
  }
}
