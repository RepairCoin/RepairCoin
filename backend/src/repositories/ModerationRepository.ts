import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface BlockedCustomer {
  id: string;
  shopId: string;
  customerId?: string;
  customerWalletAddress: string;
  customerName?: string;
  customerEmail?: string;
  reason: string;
  blockedAt: Date;
  blockedBy: string;
  unblockedAt?: Date;
  unblockedBy?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockCustomerData {
  shopId: string;
  customerWalletAddress: string;
  reason: string;
  blockedBy: string;
}

export interface ShopReport {
  id: string;
  shopId: string;
  category: 'spam' | 'fraud' | 'inappropriate_review' | 'harassment' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  relatedEntityType?: 'customer' | 'review' | 'order';
  relatedEntityId?: string;
  assignedTo?: string;
  adminNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportData {
  shopId: string;
  category: 'spam' | 'fraud' | 'inappropriate_review' | 'harassment' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  relatedEntityType?: 'customer' | 'review' | 'order';
  relatedEntityId?: string;
}

export interface FlaggedReview {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  status: 'pending' | 'approved' | 'removed';
  reviewedBy?: string;
  reviewedAt?: Date;
  adminNotes?: string;
  flaggedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ModerationRepository extends BaseRepository {
  // ==================== BLOCKED CUSTOMERS ====================

  async getBlockedCustomers(shopId: string): Promise<BlockedCustomer[]> {
    try {
      const query = `
        SELECT
          bc.*,
          c.name as customer_name,
          c.email as customer_email
        FROM blocked_customers bc
        LEFT JOIN customers c ON c.wallet_address = bc.customer_wallet_address
        WHERE bc.shop_id = $1 AND bc.is_active = true
        ORDER BY bc.blocked_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);

      return result.rows.map(row => ({
        id: row.id,
        shopId: row.shop_id,
        customerId: row.customer_id || null,
        customerWalletAddress: row.customer_wallet_address,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        reason: row.reason,
        blockedAt: row.blocked_at,
        blockedBy: row.blocked_by,
        unblockedAt: row.unblocked_at,
        unblockedBy: row.unblocked_by,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error fetching blocked customers:', error);
      throw new Error('Failed to fetch blocked customers');
    }
  }

  async isCustomerBlocked(shopId: string, customerWalletAddress: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM blocked_customers
          WHERE shop_id = $1
          AND customer_wallet_address = $2
          AND is_active = true
        ) as blocked
      `;

      const result = await this.pool.query(query, [shopId, customerWalletAddress.toLowerCase()]);
      return result.rows[0].blocked;
    } catch (error) {
      logger.error('Error checking if customer is blocked:', error);
      throw new Error('Failed to check customer block status');
    }
  }

  async blockCustomer(data: BlockCustomerData): Promise<BlockedCustomer> {
    try {
      // Check if customer is already blocked
      const isBlocked = await this.isCustomerBlocked(data.shopId, data.customerWalletAddress);
      if (isBlocked) {
        throw new Error('Customer is already blocked');
      }

      // Get customer data if exists
      const customerQuery = `
        SELECT name, email
        FROM customers
        WHERE wallet_address = $1
      `;
      const customerResult = await this.pool.query(customerQuery, [data.customerWalletAddress.toLowerCase()]);
      const customer = customerResult.rows[0];

      // Insert block record
      const query = `
        INSERT INTO blocked_customers (
          shop_id,
          customer_wallet_address,
          customer_name,
          customer_email,
          reason,
          blocked_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        data.shopId,
        data.customerWalletAddress.toLowerCase(),
        customer?.name,
        customer?.email,
        data.reason,
        data.blockedBy,
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        shopId: row.shop_id,
        customerId: row.customer_id,
        customerWalletAddress: row.customer_wallet_address,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        reason: row.reason,
        blockedAt: row.blocked_at,
        blockedBy: row.blocked_by,
        unblockedAt: row.unblocked_at,
        unblockedBy: row.unblocked_by,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error blocking customer:', error);
      throw error;
    }
  }

  async unblockCustomer(shopId: string, customerWalletAddress: string, unblockedBy: string): Promise<void> {
    try {
      const query = `
        UPDATE blocked_customers
        SET
          is_active = false,
          unblocked_at = CURRENT_TIMESTAMP,
          unblocked_by = $1
        WHERE shop_id = $2
        AND customer_wallet_address = $3
        AND is_active = true
      `;

      const result = await this.pool.query(query, [
        unblockedBy,
        shopId,
        customerWalletAddress.toLowerCase(),
      ]);

      if (result.rowCount === 0) {
        throw new Error('Customer block record not found or already unblocked');
      }
    } catch (error) {
      logger.error('Error unblocking customer:', error);
      throw error;
    }
  }

  // ==================== REPORTS ====================

  async getReports(shopId: string): Promise<ShopReport[]> {
    try {
      const query = `
        SELECT * FROM shop_reports
        WHERE shop_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);

      return result.rows.map(row => ({
        id: row.id,
        shopId: row.shop_id,
        category: row.category,
        description: row.description,
        severity: row.severity,
        status: row.status,
        relatedEntityType: row.related_entity_type,
        relatedEntityId: row.related_entity_id,
        assignedTo: row.assigned_to,
        adminNotes: row.admin_notes,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        resolutionDetails: row.resolution_details,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error fetching reports:', error);
      throw new Error('Failed to fetch reports');
    }
  }

  async createReport(data: CreateReportData): Promise<ShopReport> {
    try {
      const query = `
        INSERT INTO shop_reports (
          shop_id,
          category,
          description,
          severity,
          related_entity_type,
          related_entity_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        data.shopId,
        data.category,
        data.description,
        data.severity,
        data.relatedEntityType || null,
        data.relatedEntityId || null,
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        shopId: row.shop_id,
        category: row.category,
        description: row.description,
        severity: row.severity,
        status: row.status,
        relatedEntityType: row.related_entity_type,
        relatedEntityId: row.related_entity_id,
        assignedTo: row.assigned_to,
        adminNotes: row.admin_notes,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        resolutionDetails: row.resolution_details,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error creating report:', error);
      throw new Error('Failed to create report');
    }
  }

  // ==================== FLAGGED REVIEWS ====================

  async getFlaggedReviews(shopId: string): Promise<FlaggedReview[]> {
    try {
      const query = `
        SELECT * FROM flagged_reviews
        WHERE shop_id = $1
        ORDER BY flagged_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);

      return result.rows.map(row => ({
        id: row.id,
        reviewId: row.review_id,
        shopId: row.shop_id,
        reason: row.reason,
        status: row.status,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        adminNotes: row.admin_notes,
        flaggedAt: row.flagged_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error fetching flagged reviews:', error);
      throw new Error('Failed to fetch flagged reviews');
    }
  }

  async flagReview(shopId: string, reviewId: string, reason: string): Promise<FlaggedReview> {
    try {
      const query = `
        INSERT INTO flagged_reviews (review_id, shop_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (review_id, shop_id) DO NOTHING
        RETURNING *
      `;

      const result = await this.pool.query(query, [reviewId, shopId, reason]);

      if (result.rows.length === 0) {
        throw new Error('Review already flagged');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        reviewId: row.review_id,
        shopId: row.shop_id,
        reason: row.reason,
        status: row.status,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        adminNotes: row.admin_notes,
        flaggedAt: row.flagged_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error flagging review:', error);
      throw error;
    }
  }

  // ==================== ADMIN FUNCTIONS ====================

  async getAllReports(
    status?: 'pending' | 'investigating' | 'resolved' | 'dismissed',
    severity?: 'low' | 'medium' | 'high'
  ): Promise<ShopReport[]> {
    try {
      let query = `SELECT * FROM shop_reports WHERE 1=1`;
      const params: any[] = [];

      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      if (severity) {
        params.push(severity);
        query += ` AND severity = $${params.length}`;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        shopId: row.shop_id,
        category: row.category,
        description: row.description,
        severity: row.severity,
        status: row.status,
        relatedEntityType: row.related_entity_type,
        relatedEntityId: row.related_entity_id,
        assignedTo: row.assigned_to,
        adminNotes: row.admin_notes,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        resolutionDetails: row.resolution_details,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error fetching all reports:', error);
      throw new Error('Failed to fetch all reports');
    }
  }

  async updateReportStatus(
    reportId: string,
    status: 'pending' | 'investigating' | 'resolved' | 'dismissed',
    adminWallet: string,
    adminNotes?: string,
    resolutionDetails?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_reports
        SET
          status = $1,
          admin_notes = COALESCE($2, admin_notes),
          resolution_details = COALESCE($3, resolution_details),
          resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
          resolved_by = CASE WHEN $1 IN ('resolved', 'dismissed') THEN $4 ELSE resolved_by END
        WHERE id = $5
      `;

      await this.pool.query(query, [
        status,
        adminNotes,
        resolutionDetails,
        adminWallet,
        reportId,
      ]);
    } catch (error) {
      logger.error('Error updating report status:', error);
      throw new Error('Failed to update report status');
    }
  }
}
