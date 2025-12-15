// backend/src/repositories/ReviewRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ServiceReview {
  reviewId: string;
  serviceId: string;
  orderId: string;
  customerAddress: string;
  shopId: string;
  rating: number;
  comment?: string;
  images?: string[];
  helpfulCount: number;
  shopResponse?: string;
  shopResponseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceReviewWithDetails extends ServiceReview {
  customerName?: string;
  serviceName?: string;
  shopName?: string;
}

export interface CreateReviewParams {
  reviewId: string;
  serviceId: string;
  orderId: string;
  customerAddress: string;
  shopId: string;
  rating: number;
  comment?: string;
  images?: string[];
}

export interface UpdateReviewParams {
  rating?: number;
  comment?: string;
  images?: string[];
}

export class ReviewRepository extends BaseRepository {
  /**
   * Create a new review
   */
  async createReview(params: CreateReviewParams): Promise<ServiceReview> {
    try {
      const query = `
        INSERT INTO service_reviews (
          review_id, service_id, order_id, customer_address, shop_id,
          rating, comment, images
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        params.reviewId,
        params.serviceId,
        params.orderId,
        params.customerAddress.toLowerCase(),
        params.shopId,
        params.rating,
        params.comment || null,
        params.images || []
      ];

      const result = await this.pool.query(query, values);
      logger.info('Review created', { reviewId: params.reviewId, serviceId: params.serviceId });
      return this.mapReviewRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Get review by ID
   */
  async getReviewById(reviewId: string): Promise<ServiceReview | null> {
    try {
      const query = 'SELECT * FROM service_reviews WHERE review_id = $1';
      const result = await this.pool.query(query, [reviewId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapReviewRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching review:', error);
      throw error;
    }
  }

  /**
   * Get review by order ID (check if customer already reviewed)
   */
  async getReviewByOrderId(orderId: string): Promise<ServiceReview | null> {
    try {
      const query = 'SELECT * FROM service_reviews WHERE order_id = $1';
      const result = await this.pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapReviewRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching review by order:', error);
      throw error;
    }
  }

  /**
   * Get all reviews for a service
   */
  async getServiceReviews(
    serviceId: string,
    options: {
      page?: number;
      limit?: number;
      rating?: number;
    } = {}
  ): Promise<PaginatedResult<ServiceReviewWithDetails>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['r.service_id = $1'];
      const params: unknown[] = [serviceId];
      let paramCount = 1;

      if (options.rating) {
        paramCount++;
        whereClauses.push(`r.rating = $${paramCount}`);
        params.push(options.rating);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_reviews r
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with details
      const query = `
        SELECT
          r.*,
          c.name as customer_name,
          s.service_name,
          sh.name as shop_name
        FROM service_reviews r
        LEFT JOIN customers c ON r.customer_address = c.address
        INNER JOIN shop_services s ON r.service_id = s.service_id
        INNER JOIN shops sh ON r.shop_id = sh.shop_id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => this.mapReviewWithDetailsRow(row));

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
      logger.error('Error fetching service reviews:', error);
      throw error;
    }
  }

  /**
   * Get all reviews by a customer
   */
  async getCustomerReviews(
    customerAddress: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<ServiceReviewWithDetails>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_reviews
        WHERE customer_address = $1
      `;
      const countResult = await this.pool.query(countQuery, [customerAddress.toLowerCase()]);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const query = `
        SELECT
          r.*,
          s.service_name,
          sh.name as shop_name
        FROM service_reviews r
        INNER JOIN shop_services s ON r.service_id = s.service_id
        INNER JOIN shops sh ON r.shop_id = sh.shop_id
        WHERE r.customer_address = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), limit, offset]);
      const items = result.rows.map(row => this.mapReviewWithDetailsRow(row));

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
      logger.error('Error fetching customer reviews:', error);
      throw error;
    }
  }

  /**
   * Get all reviews for a shop
   */
  async getShopReviews(
    shopId: string,
    options: {
      page?: number;
      limit?: number;
      rating?: number;
    } = {}
  ): Promise<PaginatedResult<ServiceReviewWithDetails>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['r.shop_id = $1'];
      const params: unknown[] = [shopId];
      let paramCount = 1;

      if (options.rating) {
        paramCount++;
        whereClauses.push(`r.rating = $${paramCount}`);
        params.push(options.rating);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_reviews r
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const query = `
        SELECT
          r.*,
          c.name as customer_name,
          s.service_name
        FROM service_reviews r
        LEFT JOIN customers c ON r.customer_address = c.address
        INNER JOIN shop_services s ON r.service_id = s.service_id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => this.mapReviewWithDetailsRow(row));

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
      logger.error('Error fetching shop reviews:', error);
      throw error;
    }
  }

  /**
   * Update a review
   */
  async updateReview(reviewId: string, updates: UpdateReviewParams): Promise<ServiceReview> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCount = 0;

      if (updates.rating !== undefined) {
        paramCount++;
        fields.push(`rating = $${paramCount}`);
        values.push(updates.rating);
      }

      if (updates.comment !== undefined) {
        paramCount++;
        fields.push(`comment = $${paramCount}`);
        values.push(updates.comment);
      }

      if (updates.images !== undefined) {
        paramCount++;
        fields.push(`images = $${paramCount}`);
        values.push(updates.images);
      }

      if (fields.length === 0) {
        const current = await this.getReviewById(reviewId);
        if (!current) throw new Error('Review not found');
        return current;
      }

      paramCount++;
      values.push(reviewId);

      const query = `
        UPDATE service_reviews
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE review_id = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Review not found');
      }

      logger.info('Review updated', { reviewId });
      return this.mapReviewRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Add shop response to review
   */
  async addShopResponse(reviewId: string, response: string): Promise<ServiceReview> {
    try {
      const query = `
        UPDATE service_reviews
        SET shop_response = $1, shop_response_at = NOW(), updated_at = NOW()
        WHERE review_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [response, reviewId]);

      if (result.rows.length === 0) {
        throw new Error('Review not found');
      }

      logger.info('Shop response added', { reviewId });
      return this.mapReviewRow(result.rows[0]);
    } catch (error) {
      logger.error('Error adding shop response:', error);
      throw error;
    }
  }

  /**
   * Toggle helpful vote for a review (unique per user)
   * Returns the new vote state and updated count
   */
  async toggleHelpfulVote(reviewId: string, voterAddress: string): Promise<{ voted: boolean; helpfulCount: number }> {
    try {
      const normalizedAddress = voterAddress.toLowerCase();

      // Check if user already voted
      const checkQuery = `
        SELECT id FROM review_helpful_votes
        WHERE review_id = $1 AND voter_address = $2
      `;
      const existingVote = await this.pool.query(checkQuery, [reviewId, normalizedAddress]);

      let voted: boolean;

      if (existingVote.rows.length > 0) {
        // Remove vote (unvote)
        const deleteQuery = `
          DELETE FROM review_helpful_votes
          WHERE review_id = $1 AND voter_address = $2
        `;
        await this.pool.query(deleteQuery, [reviewId, normalizedAddress]);
        voted = false;
        logger.info('Review helpful vote removed', { reviewId, voterAddress: normalizedAddress });
      } else {
        // Add vote
        const insertQuery = `
          INSERT INTO review_helpful_votes (review_id, voter_address)
          VALUES ($1, $2)
        `;
        await this.pool.query(insertQuery, [reviewId, normalizedAddress]);
        voted = true;
        logger.info('Review marked helpful', { reviewId, voterAddress: normalizedAddress });
      }

      // Get updated count (trigger updates this, but fetch to return)
      const countQuery = `
        SELECT helpful_count FROM service_reviews WHERE review_id = $1
      `;
      const countResult = await this.pool.query(countQuery, [reviewId]);
      const helpfulCount = countResult.rows[0]?.helpful_count || 0;

      return { voted, helpfulCount };
    } catch (error) {
      logger.error('Error toggling helpful vote:', error);
      throw error;
    }
  }

  /**
   * Check if user has voted on a review
   */
  async hasUserVoted(reviewId: string, voterAddress: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM review_helpful_votes
        WHERE review_id = $1 AND voter_address = $2
      `;
      const result = await this.pool.query(query, [reviewId, voterAddress.toLowerCase()]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking user vote:', error);
      throw error;
    }
  }

  /**
   * Get user's votes for multiple reviews (batch check)
   */
  async getUserVotesForReviews(reviewIds: string[], voterAddress: string): Promise<Set<string>> {
    try {
      if (reviewIds.length === 0) {
        return new Set();
      }

      const query = `
        SELECT review_id FROM review_helpful_votes
        WHERE review_id = ANY($1) AND voter_address = $2
      `;
      const result = await this.pool.query(query, [reviewIds, voterAddress.toLowerCase()]);
      return new Set(result.rows.map(row => row.review_id));
    } catch (error) {
      logger.error('Error getting user votes:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<void> {
    try {
      const query = 'DELETE FROM service_reviews WHERE review_id = $1';
      const result = await this.pool.query(query, [reviewId]);

      if (result.rowCount === 0) {
        throw new Error('Review not found');
      }

      logger.info('Review deleted', { reviewId });
    } catch (error) {
      logger.error('Error deleting review:', error);
      throw error;
    }
  }

  /**
   * Map database row to ServiceReview
   */
  private mapReviewRow(row: any): ServiceReview {
    return {
      reviewId: row.review_id,
      serviceId: row.service_id,
      orderId: row.order_id,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      rating: row.rating,
      comment: row.comment,
      images: row.images || [],
      helpfulCount: row.helpful_count || 0,
      shopResponse: row.shop_response,
      shopResponseAt: row.shop_response_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to ServiceReviewWithDetails
   */
  private mapReviewWithDetailsRow(row: any): ServiceReviewWithDetails {
    return {
      ...this.mapReviewRow(row),
      customerName: row.customer_name,
      serviceName: row.service_name,
      shopName: row.shop_name
    };
  }
}
