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
}

export interface ShopServiceWithShopInfo extends ShopService {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  shopLogo?: string;
  avgRating?: number;
  reviewCount?: number;
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
  async getServiceWithShopInfo(serviceId: string): Promise<ShopServiceWithShopInfo | null> {
    try {
      const query = `
        SELECT
          s.*,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.lat as shop_lat,
          sh.lng as shop_lng,
          sh.city as shop_city,
          sh.state as shop_state,
          sh.zip_code as shop_zip_code,
          NULL as shop_logo
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        WHERE s.service_id = $1
      `;
      const result = await this.pool.query(query, [serviceId]);

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
    } = {}
  ): Promise<PaginatedResult<ShopService>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE shop_id = $1';
      if (options.activeOnly) {
        whereClause += ' AND active = true';
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM shop_services ${whereClause}`;
      const countResult = await this.pool.query(countQuery, [shopId]);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const query = `
        SELECT * FROM shop_services
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const result = await this.pool.query(query, [shopId, limit, offset]);

      const items = result.rows.map(row => this.mapServiceRow(row));

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

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM shop_services s
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with shop info and review stats
      const query = `
        SELECT
          s.*,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.lat as shop_lat,
          sh.lng as shop_lng,
          sh.city as shop_city,
          sh.state as shop_state,
          sh.zip_code as shop_zip_code,
          NULL as shop_logo,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          COUNT(r.review_id) as review_count
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        LEFT JOIN service_reviews r ON s.service_id = r.service_id
        ${whereClause}
        GROUP BY s.service_id, sh.shop_id
        ${orderByClause}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => this.mapServiceWithShopInfoRow(row));

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
      updatedAt: row.updated_at
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
      shopLocation: row.shop_lat && row.shop_lng ? {
        lat: parseFloat(row.shop_lat),
        lng: parseFloat(row.shop_lng),
        city: row.shop_city,
        state: row.shop_state,
        zipCode: row.shop_zip_code
      } : undefined
    };
  }
}
