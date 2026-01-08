// backend/src/repositories/ServiceRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ShopService {
  serviceId: string;
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Group-related fields
  groupId?: string;
  groupExclusive?: boolean;
  groupTokenRewardPercentage?: number;
  groupBonusMultiplier?: number;
}

export interface ShopServiceWithShopInfo extends ShopService {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  shopLogo?: string;
  avgRating?: number;
  reviewCount?: number;
  isFavorited?: boolean;
  shopLocation?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface CreateServiceParams {
  serviceId: string;
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface UpdateServiceParams {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface ServiceFilters {
  shopId?: string;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  activeOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'oldest';
  groupId?: string;
  groupExclusiveOnly?: boolean;
  city?: string;
  state?: string;
}

export interface ServiceGroupAvailability {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  addedAt: Date;
  updatedAt: Date;
  // Joined data
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

export class ServiceRepository extends BaseRepository {
  /**
   * Create a new service
   */
  async createService(params: CreateServiceParams): Promise<ShopService> {
    try {
      const query = `
        INSERT INTO shop_services (
          service_id, shop_id, service_name, description, price_usd,
          duration_minutes, category, image_url, tags, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        params.serviceId,
        params.shopId,
        params.serviceName,
        params.description || null,
        params.priceUsd,
        params.durationMinutes || null,
        params.category || null,
        params.imageUrl || null,
        params.tags || [],
        params.active !== undefined ? params.active : true
      ];

      const result = await this.pool.query(query, values);
      logger.info('Service created', { serviceId: params.serviceId, shopId: params.shopId });
      return this.mapServiceRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating service:', error);
      throw error;
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(serviceId: string): Promise<ShopService | null> {
    try {
      const query = 'SELECT * FROM shop_services WHERE service_id = $1';
      const result = await this.pool.query(query, [serviceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapServiceRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching service:', error);
      throw error;
    }
  }

  /**
   * Get service with shop information
   */
  async getServiceWithShopInfo(serviceId: string, customerAddress?: string): Promise<ShopServiceWithShopInfo | null> {
    try {
      const normalizedAddress = customerAddress?.toLowerCase();
      const params: string[] = [serviceId];

      let favoritesJoin = '';
      let favoritesSelect = 'false as is_favorited';

      if (normalizedAddress) {
        params.push(normalizedAddress);
        favoritesJoin = `LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $2`;
        favoritesSelect = '(sf.customer_address IS NOT NULL) as is_favorited';
      }

      const query = `
        SELECT
          s.*,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.location_lat as shop_lat,
          sh.location_lng as shop_lng,
          sh.location_city as shop_city,
          sh.location_state as shop_state,
          sh.location_zip_code as shop_zip_code,
          NULL as shop_logo,
          ${favoritesSelect}
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        ${favoritesJoin}
        WHERE s.service_id = $1
      `;
      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapServiceWithShopInfoRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching service with shop info:', error);
      throw error;
    }
  }

  /**
   * Get all services for a specific shop
   */
  async getServicesByShop(
    shopId: string,
    options: {
      page?: number;
      limit?: number;
      activeOnly?: boolean;
      customerAddress?: string;
    } = {}
  ): Promise<PaginatedResult<ShopService>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;
      const normalizedAddress = options.customerAddress?.toLowerCase();

      let whereClause = 'WHERE s.shop_id = $1';
      if (options.activeOnly) {
        whereClause += ' AND s.active = true';
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM shop_services s ${whereClause}`;
      const countResult = await this.pool.query(countQuery, [shopId]);
      const total = parseInt(countResult.rows[0].total);

      // Build favorites join if customer is authenticated
      const params: (string | number)[] = [shopId];
      let paramCount = 1;
      let favoritesJoin = '';
      let favoritesSelect = 'false as is_favorited';

      if (normalizedAddress) {
        paramCount++;
        favoritesJoin = `LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $${paramCount}`;
        favoritesSelect = '(sf.customer_address IS NOT NULL) as is_favorited';
        params.push(normalizedAddress);
      }

      // Get paginated results with groups
      const query = `
        SELECT
          s.*,
          ${favoritesSelect},
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
        FROM shop_services s
        ${favoritesJoin}
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      const result = await this.pool.query(query, params);

      const items = result.rows.map(row => {
        const service = this.mapServiceRow(row);
        return {
          ...service,
          groups: row.groups || [],
          isFavorited: row.is_favorited === true
        };
      });

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
      logger.error('Error fetching shop services:', error);
      throw error;
    }
  }

  /**
   * Get all active services with optional filters
   */
  async getAllActiveServices(
    filters: ServiceFilters = {},
    options: {
      page?: number;
      limit?: number;
      customerAddress?: string;
    } = {}
  ): Promise<PaginatedResult<ShopServiceWithShopInfo>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [];
      const params: unknown[] = [];
      let paramCount = 0;

      // Always filter for active services unless specified otherwise
      if (filters.activeOnly !== false) {
        whereClauses.push('s.active = true');
      }

      if (filters.shopId) {
        paramCount++;
        whereClauses.push(`s.shop_id = $${paramCount}`);
        params.push(filters.shopId);
      }

      if (filters.category) {
        paramCount++;
        whereClauses.push(`s.category = $${paramCount}`);
        params.push(filters.category);
      }

      if (filters.search) {
        paramCount++;
        whereClauses.push(`(s.service_name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`);
        params.push(`%${filters.search}%`);
      }

      if (filters.minPrice !== undefined) {
        paramCount++;
        whereClauses.push(`s.price_usd >= $${paramCount}`);
        params.push(filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        paramCount++;
        whereClauses.push(`s.price_usd <= $${paramCount}`);
        params.push(filters.maxPrice);
      }

      // Location filters - search within the full address field
      // Note: Shops typically only fill in the single "address" field, not separate city/state
      if (filters.city) {
        paramCount++;
        whereClauses.push(`LOWER(sh.address) LIKE LOWER($${paramCount})`);
        params.push(`%${filters.city}%`);
      }

      if (filters.state) {
        paramCount++;
        whereClauses.push(`LOWER(sh.address) LIKE LOWER($${paramCount})`);
        params.push(`%${filters.state}%`);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Determine sort order
      let orderByClause = 'ORDER BY s.created_at DESC'; // Default: newest first
      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'price_asc':
            orderByClause = 'ORDER BY s.price_usd ASC';
            break;
          case 'price_desc':
            orderByClause = 'ORDER BY s.price_usd DESC';
            break;
          case 'rating_desc':
            orderByClause = 'ORDER BY COALESCE(avg_rating, 0) DESC, review_count DESC';
            break;
          case 'newest':
            orderByClause = 'ORDER BY s.created_at DESC';
            break;
          case 'oldest':
            orderByClause = 'ORDER BY s.created_at ASC';
            break;
        }
      }

      // Get total count (must join shops table for location filters)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Build favorites join if customer is authenticated
      const customerAddress = options.customerAddress?.toLowerCase();
      let favoritesJoin = '';
      let favoritesSelect = 'false as is_favorited';

      if (customerAddress) {
        paramCount++;
        favoritesJoin = `LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $${paramCount}`;
        favoritesSelect = '(sf.customer_address IS NOT NULL) as is_favorited';
        params.push(customerAddress);
      }

      // Get paginated results with shop info and review stats
      const query = `
        SELECT
          s.*,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.location_lat as shop_lat,
          sh.location_lng as shop_lng,
          sh.location_city as shop_city,
          sh.location_state as shop_state,
          sh.location_zip_code as shop_zip_code,
          NULL as shop_logo,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          COUNT(r.review_id) as review_count,
          ${favoritesSelect},
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
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        LEFT JOIN service_reviews r ON s.service_id = r.service_id
        ${favoritesJoin}
        ${whereClause}
        GROUP BY s.service_id, s.shop_id, s.service_name, s.description, s.price_usd, s.duration_minutes, s.category, s.image_url, s.tags, s.active, s.created_at, s.updated_at, sh.shop_id, sh.name, sh.address, sh.phone, sh.email, sh.location_lat, sh.location_lng, sh.location_city, sh.location_state, sh.location_zip_code${customerAddress ? ', sf.customer_address' : ''}
        ${orderByClause}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => {
        const service = this.mapServiceWithShopInfoRow(row);
        return {
          ...service,
          groups: row.groups || []
        };
      });

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
      logger.error('Error fetching services:', error);
      throw error;
    }
  }

  /**
   * Update a service
   */
  async updateService(serviceId: string, updates: UpdateServiceParams): Promise<ShopService> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCount = 0;

      const fieldMappings: Record<string, string> = {
        serviceName: 'service_name',
        description: 'description',
        priceUsd: 'price_usd',
        durationMinutes: 'duration_minutes',
        category: 'category',
        imageUrl: 'image_url',
        tags: 'tags',
        active: 'active'
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && fieldMappings[key]) {
          paramCount++;
          fields.push(`${fieldMappings[key]} = $${paramCount}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        const current = await this.getServiceById(serviceId);
        if (!current) throw new Error('Service not found');
        return current;
      }

      paramCount++;
      values.push(serviceId);

      const query = `
        UPDATE shop_services
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE service_id = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Service not found');
      }

      logger.info('Service updated', { serviceId });
      return this.mapServiceRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating service:', error);
      throw error;
    }
  }

  /**
   * Soft delete a service (set active = false)
   */
  async deleteService(serviceId: string): Promise<void> {
    try {
      const query = `
        UPDATE shop_services
        SET active = false, updated_at = NOW()
        WHERE service_id = $1
      `;
      const result = await this.pool.query(query, [serviceId]);

      if (result.rowCount === 0) {
        throw new Error('Service not found');
      }

      logger.info('Service deleted (soft)', { serviceId });
    } catch (error) {
      logger.error('Error deleting service:', error);
      throw error;
    }
  }

  /**
   * Map database row to ShopService
   */
  private mapServiceRow(row: any): ShopService {
    return {
      serviceId: row.service_id,
      shopId: row.shop_id,
      serviceName: row.service_name,
      description: row.description,
      priceUsd: parseFloat(row.price_usd),
      durationMinutes: row.duration_minutes,
      category: row.category,
      imageUrl: row.image_url,
      tags: row.tags || [],
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      groupId: row.group_id || undefined,
      groupExclusive: row.group_exclusive || false,
      groupTokenRewardPercentage: row.group_token_reward_percentage ? parseFloat(row.group_token_reward_percentage) : undefined,
      groupBonusMultiplier: row.group_bonus_multiplier ? parseFloat(row.group_bonus_multiplier) : undefined
    };
  }

  /**
   * Map database row to ShopServiceWithShopInfo
   */
  private mapServiceWithShopInfoRow(row: any): ShopServiceWithShopInfo {
    return {
      ...this.mapServiceRow(row),
      shopName: row.shop_name,
      shopAddress: row.shop_address,
      shopPhone: row.shop_phone,
      shopEmail: row.shop_email,
      shopLogo: row.shop_logo,
      avgRating: row.avg_rating ? parseFloat(row.avg_rating) : 0,
      reviewCount: row.review_count ? parseInt(row.review_count) : 0,
      isFavorited: row.is_favorited === true,
      shopLocation: row.shop_lat && row.shop_lng ? {
        lat: parseFloat(row.shop_lat),
        lng: parseFloat(row.shop_lng),
        city: row.shop_city,
        state: row.shop_state,
        zipCode: row.shop_zip_code
      } : undefined
    };
  }

  /**
   * Link a service to an affiliate group (many-to-many)
   */
  async linkServiceToGroup(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage: number = 100,
    bonusMultiplier: number = 1.0
  ): Promise<ServiceGroupAvailability> {
    try {
      const query = `
        INSERT INTO service_group_availability (
          service_id, group_id, token_reward_percentage, bonus_multiplier, active
        ) VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (service_id, group_id)
        DO UPDATE SET
          token_reward_percentage = EXCLUDED.token_reward_percentage,
          bonus_multiplier = EXCLUDED.bonus_multiplier,
          active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [serviceId, groupId, tokenRewardPercentage, bonusMultiplier];
      const result = await this.pool.query(query, values);

      logger.info('Service linked to group', { serviceId, groupId });
      return this.mapServiceGroupAvailabilityRow(result.rows[0]);
    } catch (error) {
      logger.error('Error linking service to group', { error, serviceId, groupId });
      throw error;
    }
  }

  /**
   * Unlink a service from an affiliate group
   */
  async unlinkServiceFromGroup(serviceId: string, groupId: string): Promise<void> {
    try {
      const query = `DELETE FROM service_group_availability WHERE service_id = $1 AND group_id = $2`;
      await this.pool.query(query, [serviceId, groupId]);
      logger.info('Service unlinked from group', { serviceId, groupId });
    } catch (error) {
      logger.error('Error unlinking service from group', { error, serviceId, groupId });
      throw error;
    }
  }

  /**
   * Get all groups a service is linked to
   */
  async getServiceGroups(serviceId: string): Promise<ServiceGroupAvailability[]> {
    try {
      const query = `
        SELECT
          sga.*,
          asg.group_name,
          asg.custom_token_name,
          asg.custom_token_symbol,
          asg.icon
        FROM service_group_availability sga
        JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
        WHERE sga.service_id = $1 AND sga.active = true
        ORDER BY sga.added_at DESC
      `;

      const result = await this.pool.query(query, [serviceId]);
      return result.rows.map(row => this.mapServiceGroupAvailabilityRow(row));
    } catch (error) {
      logger.error('Error getting service groups', { error, serviceId });
      throw error;
    }
  }

  /**
   * Get all services in an affiliate group
   */
  async getServicesByGroup(groupId: string, filters?: ServiceFilters, customerAddress?: string): Promise<ShopServiceWithShopInfo[]> {
    try {
      const normalizedAddress = customerAddress?.toLowerCase();
      const values: any[] = [groupId];
      let paramCount = 1;

      // Build favorites join if customer is authenticated
      let favoritesJoin = '';
      let favoritesSelect = 'false as is_favorited';

      if (normalizedAddress) {
        paramCount++;
        favoritesJoin = `LEFT JOIN service_favorites sf ON ss.service_id = sf.service_id AND sf.customer_address = $${paramCount}`;
        favoritesSelect = '(sf.customer_address IS NOT NULL) as is_favorited';
        values.push(normalizedAddress);
      }

      let query = `
        SELECT
          ss.*,
          sga.token_reward_percentage as group_token_reward_percentage,
          sga.bonus_multiplier as group_bonus_multiplier,
          s.name as shop_name,
          s.address as shop_address,
          s.phone as shop_phone,
          s.email as shop_email,
          s.logo_url as shop_logo,
          COALESCE(ss.average_rating, 0) as avg_rating,
          COALESCE(ss.review_count, 0) as review_count,
          s.location_lat as shop_lat,
          s.location_lng as shop_lng,
          s.location_city as shop_city,
          s.location_state as shop_state,
          s.location_zip_code as shop_zip_code,
          ${favoritesSelect}
        FROM service_group_availability sga
        JOIN shop_services ss ON sga.service_id = ss.service_id
        JOIN shops s ON ss.shop_id = s.shop_id
        ${favoritesJoin}
        WHERE sga.group_id = $1 AND sga.active = true AND ss.active = true
      `;

      if (filters?.category) {
        paramCount++;
        query += ` AND ss.category = $${paramCount}`;
        values.push(filters.category);
      }

      if (filters?.minPrice !== undefined) {
        paramCount++;
        query += ` AND ss.price_usd >= $${paramCount}`;
        values.push(filters.minPrice);
      }

      if (filters?.maxPrice !== undefined) {
        paramCount++;
        query += ` AND ss.price_usd <= $${paramCount}`;
        values.push(filters.maxPrice);
      }

      if (filters?.search) {
        paramCount++;
        query += ` AND (ss.service_name ILIKE $${paramCount} OR ss.description ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }

      query += ` ORDER BY sga.added_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapServiceWithShopInfoRow(row));
    } catch (error) {
      logger.error('Error getting services by group', { error, groupId });
      throw error;
    }
  }

  /**
   * Update group reward settings for a service
   */
  async updateServiceGroupRewards(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage?: number,
    bonusMultiplier?: number
  ): Promise<ServiceGroupAvailability> {
    try {
      const updates: string[] = [];
      const values: any[] = [serviceId, groupId];
      let paramCount = 2;

      if (tokenRewardPercentage !== undefined) {
        paramCount++;
        updates.push(`token_reward_percentage = $${paramCount}`);
        values.push(tokenRewardPercentage);
      }

      if (bonusMultiplier !== undefined) {
        paramCount++;
        updates.push(`bonus_multiplier = $${paramCount}`);
        values.push(bonusMultiplier);
      }

      if (updates.length === 0) {
        throw new Error('No updates provided');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');

      const query = `
        UPDATE service_group_availability
        SET ${updates.join(', ')}
        WHERE service_id = $1 AND group_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Service-group link not found');
      }

      logger.info('Service group rewards updated', { serviceId, groupId });
      return this.mapServiceGroupAvailabilityRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating service group rewards', { error, serviceId, groupId });
      throw error;
    }
  }

  /**
   * Map service group availability row to interface
   */
  private mapServiceGroupAvailabilityRow(row: any): ServiceGroupAvailability {
    return {
      id: row.id,
      serviceId: row.service_id,
      groupId: row.group_id,
      tokenRewardPercentage: parseFloat(row.token_reward_percentage),
      bonusMultiplier: parseFloat(row.bonus_multiplier),
      active: row.active,
      addedAt: new Date(row.added_at),
      updatedAt: new Date(row.updated_at),
      groupName: row.group_name,
      customTokenName: row.custom_token_name,
      customTokenSymbol: row.custom_token_symbol,
      icon: row.icon
    };
  }
}
