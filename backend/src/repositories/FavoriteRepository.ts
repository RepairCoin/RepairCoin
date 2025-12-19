// backend/src/repositories/FavoriteRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ServiceFavorite {
  id: string;
  customerAddress: string;
  serviceId: string;
  createdAt: Date;
}

export interface FavoriteWithServiceInfo {
  id: string;
  customerAddress: string;
  serviceId: string;
  createdAt: Date;
  // Service info
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  averageRating?: number;
  reviewCount?: number;
  // Shop info
  shopId: string;
  shopName?: string;
  shopAddress?: string;
  shopIsVerified?: boolean;
  // Group rewards
  groups?: Array<{
    groupId: string;
    groupName: string;
    customTokenSymbol: string;
    customTokenName: string;
    icon?: string;
    tokenRewardPercentage: number;
    bonusMultiplier: number;
  }>;
}

export class FavoriteRepository extends BaseRepository {
  /**
   * Add service to favorites
   */
  async addFavorite(customerAddress: string, serviceId: string): Promise<ServiceFavorite> {
    try {
      const query = `
        INSERT INTO service_favorites (customer_address, service_id)
        VALUES ($1, $2)
        ON CONFLICT (customer_address, service_id) DO NOTHING
        RETURNING *
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), serviceId]);

      if (result.rows.length === 0) {
        // Already favorited, fetch existing
        const existing = await this.getFavorite(customerAddress, serviceId);
        if (existing) {
          return existing;
        }
        throw new Error('Failed to add favorite');
      }

      logger.info('Service favorited', { customerAddress, serviceId });
      return this.mapFavoriteRow(result.rows[0]);
    } catch (error) {
      logger.error('Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove service from favorites
   */
  async removeFavorite(customerAddress: string, serviceId: string): Promise<void> {
    try {
      const query = `
        DELETE FROM service_favorites
        WHERE customer_address = $1 AND service_id = $2
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), serviceId]);

      if (result.rowCount === 0) {
        throw new Error('Favorite not found');
      }

      logger.info('Service unfavorited', { customerAddress, serviceId });
    } catch (error) {
      logger.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Check if service is favorited by customer
   */
  async isFavorited(customerAddress: string, serviceId: string): Promise<boolean> {
    try {
      const query = `
        SELECT 1 FROM service_favorites
        WHERE customer_address = $1 AND service_id = $2
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), serviceId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      return false;
    }
  }

  /**
   * Get single favorite record
   */
  async getFavorite(customerAddress: string, serviceId: string): Promise<ServiceFavorite | null> {
    try {
      const query = `
        SELECT * FROM service_favorites
        WHERE customer_address = $1 AND service_id = $2
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), serviceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapFavoriteRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching favorite:', error);
      throw error;
    }
  }

  /**
   * Get all favorited services for a customer with full service details
   */
  async getCustomerFavorites(
    customerAddress: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<FavoriteWithServiceInfo>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_favorites
        WHERE customer_address = $1
      `;
      const countResult = await this.pool.query(countQuery, [customerAddress.toLowerCase()]);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with service and shop info
      const query = `
        SELECT
          f.*,
          s.service_name,
          s.description,
          s.price_usd,
          s.duration_minutes,
          s.category,
          s.image_url,
          s.tags,
          s.average_rating,
          s.review_count,
          s.shop_id,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.verified as shop_is_verified,
          (
            SELECT json_agg(json_build_object(
              'groupId', sga.group_id,
              'groupName', asg.group_name,
              'customTokenSymbol', asg.custom_token_symbol,
              'customTokenName', asg.custom_token_name,
              'icon', asg.icon,
              'tokenRewardPercentage', sga.token_reward_percentage,
              'bonusMultiplier', sga.bonus_multiplier
            ))
            FROM service_group_availability sga
            JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
            WHERE sga.service_id = s.service_id AND sga.active = true
          ) as groups
        FROM service_favorites f
        INNER JOIN shop_services s ON f.service_id = s.service_id
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        WHERE f.customer_address = $1 AND s.active = true
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), limit, offset]);
      const items = result.rows.map(row => ({
        ...this.mapFavoriteWithServiceInfoRow(row),
        groups: row.groups || []
      }));

      return {
        items,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error fetching customer favorites:', error);
      throw error;
    }
  }

  /**
   * Get favorite count for a service
   */
  async getServiceFavoriteCount(serviceId: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM service_favorites
        WHERE service_id = $1
      `;

      const result = await this.pool.query(query, [serviceId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting service favorite count:', error);
      return 0;
    }
  }

  /**
   * Map database row to ServiceFavorite
   */
  private mapFavoriteRow(row: any): ServiceFavorite {
    return {
      id: row.id,
      customerAddress: row.customer_address,
      serviceId: row.service_id,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to FavoriteWithServiceInfo
   */
  private mapFavoriteWithServiceInfoRow(row: any): FavoriteWithServiceInfo {
    return {
      id: row.id,
      customerAddress: row.customer_address,
      serviceId: row.service_id,
      createdAt: row.created_at,
      serviceName: row.service_name,
      description: row.description,
      priceUsd: parseFloat(row.price_usd),
      durationMinutes: row.duration_minutes,
      category: row.category,
      imageUrl: row.image_url,
      tags: row.tags || [],
      averageRating: row.average_rating ? parseFloat(row.average_rating) : undefined,
      reviewCount: row.review_count || 0,
      shopId: row.shop_id,
      shopName: row.shop_name,
      shopAddress: row.shop_address,
      shopIsVerified: row.shop_is_verified || false
    };
  }
}
