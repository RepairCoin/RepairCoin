// backend/src/repositories/QuickReplyRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface QuickReply {
  id: string;
  shopId: string;
  title: string;
  content: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuickReplyParams {
  shopId: string;
  title: string;
  content: string;
  category?: string;
}

export interface UpdateQuickReplyParams {
  title?: string;
  content?: string;
  category?: string;
}

export class QuickReplyRepository extends BaseRepository {

  /**
   * Get all active quick replies for a shop, sorted by usage_count desc
   */
  async getByShopId(shopId: string): Promise<QuickReply[]> {
    try {
      const query = `
        SELECT * FROM shop_quick_replies
        WHERE shop_id = $1 AND is_active = true
        ORDER BY usage_count DESC, sort_order ASC, created_at ASC
      `;
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in QuickReplyRepository.getByShopId:', error);
      throw error;
    }
  }

  /**
   * Get a single quick reply by ID
   */
  async getById(id: string): Promise<QuickReply | null> {
    try {
      const query = `SELECT * FROM shop_quick_replies WHERE id = $1 AND is_active = true`;
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error in QuickReplyRepository.getById:', error);
      throw error;
    }
  }

  /**
   * Create a new quick reply
   */
  async create(params: CreateQuickReplyParams): Promise<QuickReply> {
    try {
      const query = `
        INSERT INTO shop_quick_replies (shop_id, title, content, category)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await this.pool.query(query, [
        params.shopId,
        params.title,
        params.content,
        params.category || 'general',
      ]);
      logger.info('Quick reply created', { shopId: params.shopId, title: params.title });
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in QuickReplyRepository.create:', error);
      throw error;
    }
  }

  /**
   * Update an existing quick reply (only if it belongs to the shop)
   */
  async update(id: string, shopId: string, params: UpdateQuickReplyParams): Promise<QuickReply | null> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.title !== undefined) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(params.title);
      }
      if (params.content !== undefined) {
        setClauses.push(`content = $${paramIndex++}`);
        values.push(params.content);
      }
      if (params.category !== undefined) {
        setClauses.push(`category = $${paramIndex++}`);
        values.push(params.category);
      }

      if (setClauses.length === 0) {
        return this.getById(id);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id, shopId);

      const query = `
        UPDATE shop_quick_replies
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++} AND shop_id = $${paramIndex++} AND is_active = true
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) return null;

      logger.info('Quick reply updated', { id, shopId });
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in QuickReplyRepository.update:', error);
      throw error;
    }
  }

  /**
   * Soft delete a quick reply (only if it belongs to the shop)
   */
  async delete(id: string, shopId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE shop_quick_replies
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND shop_id = $2 AND is_active = true
      `;
      const result = await this.pool.query(query, [id, shopId]);
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Quick reply deleted', { id, shopId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error in QuickReplyRepository.delete:', error);
      throw error;
    }
  }

  /**
   * Increment usage count when a quick reply is sent
   */
  async incrementUsage(id: string): Promise<void> {
    try {
      const query = `
        UPDATE shop_quick_replies
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = $1 AND is_active = true
      `;
      await this.pool.query(query, [id]);
    } catch (error) {
      logger.error('Error in QuickReplyRepository.incrementUsage:', error);
      throw error;
    }
  }

  private mapRow(row: any): QuickReply {
    return {
      id: row.id,
      shopId: row.shop_id,
      title: row.title,
      content: row.content,
      category: row.category,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
