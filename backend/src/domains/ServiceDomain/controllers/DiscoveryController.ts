// backend/src/domains/ServiceDomain/controllers/DiscoveryController.ts
import { Request, Response } from 'express';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

export class DiscoveryController {
  /**
   * Autocomplete search - returns matching service names and shops
   */
  async autocompleteSearch(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters'
        });
        return;
      }

      const pool = getSharedPool();
      const searchTerm = q.trim().toLowerCase();

      // Search in both service names and shop names
      const query = `
        SELECT
          s.service_id,
          s.service_name,
          s.category,
          s.price_usd,
          s.image_url,
          sh.shop_id,
          sh.name as shop_name,
          sh.location_city,
          sh.location_state
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        WHERE s.active = true
          AND sh.active = true
          AND (
            LOWER(s.service_name) LIKE $1
            OR LOWER(COALESCE(s.description, '')) LIKE $1
            OR LOWER(sh.name) LIKE $1
            OR (s.tags IS NOT NULL AND $2 = ANY(s.tags))
          )
        ORDER BY
          CASE
            WHEN LOWER(s.service_name) LIKE $2 THEN 1
            WHEN LOWER(sh.name) LIKE $2 THEN 2
            ELSE 3
          END,
          s.average_rating DESC NULLS LAST
        LIMIT 10
      `;

      const result = await pool.query(query, [
        `%${searchTerm}%`,
        `${searchTerm}%`
      ]);

      const suggestions = result.rows.map(row => ({
        serviceId: row.service_id,
        serviceName: row.service_name,
        category: row.category,
        priceUsd: parseFloat(row.price_usd),
        imageUrl: row.image_url,
        shopId: row.shop_id,
        shopName: row.shop_name,
        location: row.location_city && row.location_state
          ? `${row.location_city}, ${row.location_state}`
          : null
      }));

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Error in autocomplete search:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch autocomplete suggestions'
      });
    }
  }

  /**
   * Track recently viewed service
   */
  async trackRecentlyViewed(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!serviceId) {
        res.status(400).json({
          success: false,
          error: 'Service ID is required'
        });
        return;
      }

      const pool = getSharedPool();

      // Upsert: update viewed_at if exists, insert if not
      const query = `
        INSERT INTO recently_viewed_services (customer_address, service_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (customer_address, service_id)
        DO UPDATE SET viewed_at = NOW()
      `;

      await pool.query(query, [customerAddress, serviceId]);

      res.json({
        success: true,
        message: 'Service view tracked'
      });
    } catch (error) {
      logger.error('Error tracking recently viewed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track service view'
      });
    }
  }

  /**
   * Get recently viewed services for customer
   */
  async getRecentlyViewed(req: Request, res: Response): Promise<void> {
    try {
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const pool = getSharedPool();
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);

      const query = `
        SELECT
          s.service_id,
          s.service_name,
          s.description,
          s.price_usd,
          s.duration_minutes,
          s.category,
          s.image_url,
          s.tags,
          s.active,
          s.average_rating,
          s.review_count,
          sh.shop_id,
          sh.name as company_name,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.location_city as shop_city,
          sh.country as shop_country,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.verified as shop_is_verified,
          sh.location_lat,
          sh.location_lng,
          sh.location_city,
          sh.location_state,
          sh.location_zip_code,
          rv.viewed_at,
          (sf.customer_address IS NOT NULL) as is_favorited,
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
        FROM recently_viewed_services rv
        INNER JOIN shop_services s ON rv.service_id = s.service_id
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $1
        WHERE rv.customer_address = $1
          AND s.active = true
          AND sh.active = true
        ORDER BY rv.viewed_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [customerAddress, limit]);

      const services = result.rows.map(row => ({
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
        avgRating: row.average_rating ? parseFloat(row.average_rating) : null,
        reviewCount: row.review_count || 0,
        isFavorited: row.is_favorited === true,
        companyName: row.company_name,
        shopName: row.shop_name,
        shopAddress: row.shop_address,
        shopCity: row.shop_city,
        shopCountry: row.shop_country,
        shopPhone: row.shop_phone,
        shopEmail: row.shop_email,
        shopIsVerified: row.shop_is_verified,
        shopLocation: {
          lat: row.location_lat ? parseFloat(row.location_lat) : null,
          lng: row.location_lng ? parseFloat(row.location_lng) : null,
          city: row.location_city,
          state: row.location_state,
          zipCode: row.location_zip_code
        },
        groups: row.groups || [],
        viewedAt: row.viewed_at
      }));

      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      logger.error('Error getting recently viewed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recently viewed services'
      });
    }
  }

  /**
   * Get similar services based on category and tags
   */
  async getSimilarServices(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
      const customerAddress = req.user?.role === 'customer' ? req.user.address?.toLowerCase() : null;

      const pool = getSharedPool();

      // First, get the reference service
      const refQuery = `
        SELECT category, tags, shop_id, price_usd
        FROM shop_services
        WHERE service_id = $1 AND active = true
      `;

      const refResult = await pool.query(refQuery, [serviceId]);

      if (refResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Service not found'
        });
        return;
      }

      const refService = refResult.rows[0];
      const category = refService.category;
      const tags = refService.tags || [];
      const priceUsd = parseFloat(refService.price_usd);

      // Build favorites join if customer is authenticated
      const favoritesJoin = customerAddress
        ? `LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $7`
        : '';
      const favoritesSelect = customerAddress
        ? '(sf.customer_address IS NOT NULL) as is_favorited,'
        : 'false as is_favorited,';

      // Find similar services based on:
      // 1. Same category (highest priority)
      // 2. Shared tags
      // 3. Similar price range (+/- 30%)
      const query = `
        SELECT
          s.service_id,
          s.service_name,
          s.description,
          s.price_usd,
          s.duration_minutes,
          s.category,
          s.image_url,
          s.tags,
          s.active,
          s.average_rating,
          s.review_count,
          sh.shop_id,
          sh.name as company_name,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.location_city as shop_city,
          sh.country as shop_country,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.verified as shop_is_verified,
          sh.location_lat,
          sh.location_lng,
          sh.location_city,
          sh.location_state,
          sh.location_zip_code,
          ${favoritesSelect}
          -- Calculate similarity score
          (
            CASE WHEN s.category = $2 THEN 100 ELSE 0 END +
            (SELECT COUNT(*) * 10 FROM unnest(s.tags) tag WHERE tag = ANY($3::text[])) +
            CASE
              WHEN s.price_usd BETWEEN $4 AND $5 THEN 20
              ELSE 0
            END
          ) as similarity_score,
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
        ${favoritesJoin}
        WHERE s.service_id != $1
          AND s.active = true
          AND sh.active = true
          AND (
            s.category = $2
            OR s.tags && $3::text[]
            OR s.price_usd BETWEEN $4 AND $5
          )
        ORDER BY similarity_score DESC, s.average_rating DESC NULLS LAST
        LIMIT $6
      `;

      const minPrice = priceUsd * 0.7;
      const maxPrice = priceUsd * 1.3;

      const params = [serviceId, category, tags, minPrice, maxPrice, limit];
      if (customerAddress) {
        params.push(customerAddress);
      }

      const result = await pool.query(query, params);

      const services = result.rows.map(row => ({
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
        avgRating: row.average_rating ? parseFloat(row.average_rating) : null,
        reviewCount: row.review_count || 0,
        isFavorited: row.is_favorited === true,
        companyName: row.company_name,
        shopName: row.shop_name,
        shopAddress: row.shop_address,
        shopCity: row.shop_city,
        shopCountry: row.shop_country,
        shopPhone: row.shop_phone,
        shopEmail: row.shop_email,
        shopIsVerified: row.shop_is_verified,
        shopLocation: {
          lat: row.location_lat ? parseFloat(row.location_lat) : null,
          lng: row.location_lng ? parseFloat(row.location_lng) : null,
          city: row.location_city,
          state: row.location_state,
          zipCode: row.location_zip_code
        },
        groups: row.groups || []
      }));

      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      logger.error('Error getting similar services:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch similar services'
      });
    }
  }

  /**
   * Get trending services based on recent booking activity
   */
  async getTrendingServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
      const days = Math.min(parseInt(req.query.days as string) || 7, 30);
      const customerAddress = req.user?.role === 'customer' ? req.user.address?.toLowerCase() : null;

      const pool = getSharedPool();

      // Build favorites join if customer is authenticated
      const favoritesJoin = customerAddress
        ? `LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.customer_address = $3`
        : '';
      const favoritesSelect = customerAddress
        ? '(sf.customer_address IS NOT NULL) as is_favorited,'
        : 'false as is_favorited,';
      const favoritesGroupBy = customerAddress ? ', sf.customer_address' : '';

      // Find services with most bookings in last N days
      const query = `
        SELECT
          s.service_id,
          s.service_name,
          s.description,
          s.price_usd,
          s.duration_minutes,
          s.category,
          s.image_url,
          s.tags,
          s.active,
          s.average_rating,
          s.review_count,
          sh.shop_id,
          sh.name as company_name,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.location_city as shop_city,
          sh.country as shop_country,
          sh.phone as shop_phone,
          sh.email as shop_email,
          sh.verified as shop_is_verified,
          sh.location_lat,
          sh.location_lng,
          sh.location_city,
          sh.location_state,
          sh.location_zip_code,
          ${favoritesSelect}
          COUNT(o.order_id) as booking_count,
          COUNT(o.order_id) * 100 +
          COALESCE(s.average_rating, 0) * 20 as trending_score,
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
        LEFT JOIN service_orders o ON s.service_id = o.service_id
          AND o.created_at >= NOW() - INTERVAL '1 day' * $1
          AND o.status IN ('paid', 'completed')
        ${favoritesJoin}
        WHERE s.active = true
          AND sh.active = true
        GROUP BY s.service_id, sh.shop_id${favoritesGroupBy}
        HAVING COUNT(o.order_id) > 0
        ORDER BY trending_score DESC, booking_count DESC
        LIMIT $2
      `;

      const params: (string | number)[] = [days, limit];
      if (customerAddress) {
        params.push(customerAddress);
      }

      const result = await pool.query(query, params);

      const services = result.rows.map(row => ({
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
        avgRating: row.average_rating ? parseFloat(row.average_rating) : null,
        reviewCount: row.review_count || 0,
        isFavorited: row.is_favorited === true,
        companyName: row.company_name,
        shopName: row.shop_name,
        shopAddress: row.shop_address,
        shopCity: row.shop_city,
        shopCountry: row.shop_country,
        shopPhone: row.shop_phone,
        shopEmail: row.shop_email,
        shopIsVerified: row.shop_is_verified,
        shopLocation: {
          lat: row.location_lat ? parseFloat(row.location_lat) : null,
          lng: row.location_lng ? parseFloat(row.location_lng) : null,
          city: row.location_city,
          state: row.location_state,
          zipCode: row.location_zip_code
        },
        groups: row.groups || [],
        bookingCount: parseInt(row.booking_count),
        trendingScore: parseFloat(row.trending_score)
      }));

      res.json({
        success: true,
        data: services,
        meta: {
          period: `Last ${days} days`
        }
      });
    } catch (error) {
      logger.error('Error getting trending services:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending services'
      });
    }
  }
}
