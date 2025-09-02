import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface AdminActivity {
  id: number;
  adminAddress: string;
  actionType: string;
  actionDescription: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
}

export interface UnsuspendRequest {
  id: number;
  entityType: 'customer' | 'shop';
  entityId: string;
  requestReason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface Alert {
  id: number;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface Admin {
  id: number;
  walletAddress: string;
  name?: string;
  email?: string;
  permissions: string[];
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastLogin?: string;
  metadata?: any;
}

export class AdminRepository extends BaseRepository {
  // Admin Activity Logging
  async logAdminActivity(activity: Omit<AdminActivity, 'id' | 'createdAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO admin_activity_logs (
          admin_address, action_type, action_description,
          entity_type, entity_id, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await this.pool.query(query, [
        activity.adminAddress.toLowerCase(),
        activity.actionType,
        activity.actionDescription,
        activity.entityType,
        activity.entityId,
        JSON.stringify(activity.metadata || {})
      ]);
      
      logger.info('Admin activity logged', {
        admin: activity.adminAddress,
        action: activity.actionType
      });
    } catch (error) {
      logger.error('Error logging admin activity:', error);
      // Don't throw - logging shouldn't break operations
    }
  }

  async getAdminActivityLogs(
    filters: {
      adminAddress?: string;
      actionType?: string;
      entityType?: string;
      startDate?: string;
      endDate?: string;
      page: number;
      limit: number;
    }
  ): Promise<PaginatedResult<AdminActivity>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.adminAddress) {
        paramCount++;
        whereClause += ` AND admin_address = $${paramCount}`;
        params.push(filters.adminAddress.toLowerCase());
      }

      if (filters.actionType) {
        paramCount++;
        whereClause += ` AND action_type = $${paramCount}`;
        params.push(filters.actionType);
      }

      if (filters.entityType) {
        paramCount++;
        whereClause += ` AND entity_type = $${paramCount}`;
        params.push(filters.entityType);
      }

      if (filters.startDate) {
        paramCount++;
        whereClause += ` AND created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereClause += ` AND created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM admin_activity_logs ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT * FROM admin_activity_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const activities = result.rows.map(row => ({
        id: row.id,
        adminAddress: row.admin_address,
        actionType: row.action_type,
        actionDescription: row.action_description,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at
      }));

      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: activities,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting admin activity logs:', error);
      throw new Error('Failed to get admin activity logs');
    }
  }

  // Unsuspend Requests
  async createUnsuspendRequest(data: {
    entityType: 'customer' | 'shop';
    entityId: string;
    requestReason: string;
    status: 'pending' | 'approved' | 'rejected';
  }): Promise<UnsuspendRequest> {
    try {
      const result = await this.pool.query(`
        INSERT INTO unsuspend_requests (
          entity_type, entity_id, request_reason, status, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [data.entityType, data.entityId, data.requestReason, data.status]);
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error creating unsuspend request:', error);
      throw new Error('Failed to create unsuspend request');
    }
  }

  async getUnsuspendRequests(filters: {
    status?: string;
    entityType?: string;
  }): Promise<UnsuspendRequest[]> {
    try {
      let query = 'SELECT * FROM unsuspend_requests WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.entityType) {
        paramCount++;
        query += ` AND entity_type = $${paramCount}`;
        params.push(filters.entityType);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.pool.query(query, params);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting unsuspend requests:', error);
      throw new Error('Failed to get unsuspend requests');
    }
  }

  async getUnsuspendRequest(id: number): Promise<UnsuspendRequest | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM unsuspend_requests WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting unsuspend request:', error);
      throw new Error('Failed to get unsuspend request');
    }
  }

  async updateUnsuspendRequest(id: number, updates: {
    status?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
  }): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.status !== undefined) {
        paramCount++;
        fields.push(`status = $${paramCount}`);
        values.push(updates.status);
      }

      if (updates.reviewedAt !== undefined) {
        paramCount++;
        fields.push(`reviewed_at = $${paramCount}`);
        values.push(updates.reviewedAt);
      }

      if (updates.reviewedBy !== undefined) {
        paramCount++;
        fields.push(`reviewed_by = $${paramCount}`);
        values.push(updates.reviewedBy);
      }

      if (updates.reviewNotes !== undefined) {
        paramCount++;
        fields.push(`review_notes = $${paramCount}`);
        values.push(updates.reviewNotes);
      }

      if (fields.length === 0) {
        return;
      }

      paramCount++;
      values.push(id);

      const query = `
        UPDATE unsuspend_requests 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
      `;

      await this.pool.query(query, values);
    } catch (error) {
      logger.error('Error updating unsuspend request:', error);
      throw new Error('Failed to update unsuspend request');
    }
  }

  // Alert Management
  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'acknowledged' | 'acknowledgedBy' | 'acknowledgedAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO admin_alerts (
          alert_type, severity, title, message, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await this.pool.query(query, [
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        JSON.stringify(alert.metadata || {})
      ]);
      
      logger.info('Alert created', {
        type: alert.alertType,
        severity: alert.severity
      });
    } catch (error) {
      logger.error('Error creating alert:', error);
      // Don't throw - alerting shouldn't break operations
    }
  }

  async getAlerts(filters: {
    acknowledged?: boolean;
    severity?: string;
    limit?: number;
  }): Promise<Alert[]> {
    try {
      let query = 'SELECT * FROM admin_alerts WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.acknowledged !== undefined) {
        paramCount++;
        query += ` AND acknowledged = $${paramCount}`;
        params.push(filters.acknowledged);
      }

      if (filters.severity) {
        paramCount++;
        query += ` AND severity = $${paramCount}`;
        params.push(filters.severity);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        alertType: row.alert_type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        metadata: row.metadata,
        acknowledged: row.acknowledged,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Error getting alerts:', error);
      throw new Error('Failed to get alerts');
    }
  }

  async acknowledgeAlert(id: number, adminAddress: string): Promise<void> {
    try {
      const query = `
        UPDATE admin_alerts 
        SET acknowledged = true, 
            acknowledged_by = $1, 
            acknowledged_at = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(query, [adminAddress.toLowerCase(), id]);
      logger.info('Alert acknowledged', { id, admin: adminAddress });
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw new Error('Failed to acknowledge alert');
    }
  }

  // Platform Statistics
  async getPlatformStatistics(): Promise<{
    totalTokensIssued: number;
    totalRedemptions: number;
  }> {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as total_tokens_issued,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redemptions
        FROM transactions
        WHERE status = 'confirmed'
      `;
      
      const result = await this.pool.query(query);
      const row = result.rows[0];
      
      return {
        totalTokensIssued: parseFloat(row.total_tokens_issued),
        totalRedemptions: parseFloat(row.total_redemptions)
      };
    } catch (error) {
      logger.error('Error getting platform statistics:', error);
      throw new Error('Failed to get platform statistics');
    }
  }

  // Admin Management Methods
  async createAdmin(adminData: {
    walletAddress: string;
    name?: string;
    email?: string;
    permissions?: string[];
    isSuperAdmin?: boolean;
    createdBy?: string;
  }): Promise<Admin> {
    try {
      const query = `
        INSERT INTO admins (
          wallet_address, name, email, permissions, 
          is_super_admin, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        adminData.walletAddress.toLowerCase(),
        adminData.name,
        adminData.email,
        JSON.stringify(adminData.permissions || []),
        adminData.isSuperAdmin || false,
        adminData.createdBy?.toLowerCase()
      ]);
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Admin with this wallet address already exists');
      }
      logger.error('Error creating admin:', error);
      throw new Error('Failed to create admin');
    }
  }

  async getAdmin(walletAddress: string): Promise<Admin | null> {
    try {
      const query = `
        SELECT * FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error getting admin:', error);
      throw new Error('Failed to get admin');
    }
  }

  async getAllAdmins(): Promise<Admin[]> {
    try {
      const query = `
        SELECT * FROM admins 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapAdminFromDb(row));
    } catch (error) {
      logger.error('Error getting all admins:', error);
      throw new Error('Failed to get admins');
    }
  }

  async updateAdmin(walletAddress: string, updates: {
    name?: string;
    email?: string;
    permissions?: string[];
    isActive?: boolean;
    isSuperAdmin?: boolean;
    lastLogin?: string;
    metadata?: any;
  }): Promise<Admin | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.name !== undefined) {
        paramCount++;
        fields.push(`name = $${paramCount}`);
        values.push(updates.name);
      }

      if (updates.email !== undefined) {
        paramCount++;
        fields.push(`email = $${paramCount}`);
        values.push(updates.email);
      }

      if (updates.permissions !== undefined) {
        paramCount++;
        fields.push(`permissions = $${paramCount}`);
        values.push(JSON.stringify(updates.permissions));
      }

      if (updates.isActive !== undefined) {
        paramCount++;
        fields.push(`is_active = $${paramCount}`);
        values.push(updates.isActive);
      }

      if (updates.isSuperAdmin !== undefined) {
        paramCount++;
        fields.push(`is_super_admin = $${paramCount}`);
        values.push(updates.isSuperAdmin);
      }

      if (updates.lastLogin !== undefined) {
        paramCount++;
        fields.push(`last_login = $${paramCount}`);
        values.push(updates.lastLogin);
      }

      if (updates.metadata !== undefined) {
        paramCount++;
        fields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (fields.length === 0) {
        return this.getAdmin(walletAddress);
      }

      paramCount++;
      values.push(walletAddress.toLowerCase());

      const query = `
        UPDATE admins 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE LOWER(wallet_address) = LOWER($${paramCount})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating admin:', error);
      throw new Error('Failed to update admin');
    }
  }

  async deleteAdmin(walletAddress: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1)
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting admin:', error);
      throw new Error('Failed to delete admin');
    }
  }

  async getAdminByWalletAddress(walletAddress: string): Promise<Admin | null> {
    try {
      const query = `
        SELECT 
          id,
          wallet_address as "walletAddress",
          name,
          email,
          permissions,
          is_active as "isActive",
          is_super_admin as "isSuperAdmin",
          created_at as "createdAt",
          last_login as "lastLogin"
        FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1) AND is_active = true
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting admin by wallet address:', error);
      return null;
    }
  }

  async isAdmin(walletAddress: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1) AND is_active = true
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  async updateAdminLastLogin(walletAddress: string): Promise<void> {
    try {
      const query = `
        UPDATE admins 
        SET last_login = NOW()
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      
      await this.pool.query(query, [walletAddress]);
    } catch (error) {
      logger.error('Error updating admin last login:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  // Helper method to map database row to Admin interface
  private mapAdminFromDb(row: any): Admin {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      name: row.name,
      email: row.email,
      permissions: row.permissions || [],
      isActive: row.is_active,
      isSuperAdmin: row.is_super_admin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      lastLogin: row.last_login,
      metadata: row.metadata
    };
  }
}