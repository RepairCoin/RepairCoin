import { Pool } from 'pg';
import { getSharedPool } from '../utils/database-pool';

export interface WaitlistEntry {
  id: string;
  email: string;
  userType: 'customer' | 'shop';
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  notifiedAt?: Date;
  notes?: string;
}

export interface CreateWaitlistEntryParams {
  email: string;
  userType: 'customer' | 'shop';
}

export interface UpdateWaitlistStatusParams {
  id: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  notes?: string;
}

export class WaitlistRepository {
  private pool: Pool;

  constructor() {
    this.pool = getSharedPool();
  }

  /**
   * Create a new waitlist entry
   */
  async create(params: CreateWaitlistEntryParams): Promise<WaitlistEntry> {
    const query = `
      INSERT INTO waitlist (email, user_type)
      VALUES ($1, $2)
      RETURNING
        id,
        email,
        user_type as "userType",
        status,
        created_at as "createdAt",
        updated_at as "updatedAt",
        notified_at as "notifiedAt",
        notes
    `;

    const result = await this.pool.query(query, [params.email, params.userType]);
    return result.rows[0];
  }

  /**
   * Check if email already exists in waitlist
   */
  async existsByEmail(email: string): Promise<boolean> {
    const query = 'SELECT EXISTS(SELECT 1 FROM waitlist WHERE email = $1)';
    const result = await this.pool.query(query, [email]);
    return result.rows[0].exists;
  }

  /**
   * Get all waitlist entries with pagination
   */
  async getAll(params: {
    limit?: number;
    offset?: number;
    status?: string;
    userType?: string;
  }): Promise<{ entries: WaitlistEntry[]; total: number }> {
    const { limit = 50, offset = 0, status, userType } = params;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    if (userType) {
      whereConditions.push(`user_type = $${paramCount}`);
      queryParams.push(userType);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM waitlist ${whereClause}`;
    const countResult = await this.pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get entries
    const query = `
      SELECT
        id,
        email,
        user_type as "userType",
        status,
        created_at as "createdAt",
        updated_at as "updatedAt",
        notified_at as "notifiedAt",
        notes
      FROM waitlist
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await this.pool.query(query, queryParams);

    return {
      entries: result.rows,
      total
    };
  }

  /**
   * Update waitlist entry status
   */
  async updateStatus(params: UpdateWaitlistStatusParams): Promise<WaitlistEntry> {
    const query = `
      UPDATE waitlist
      SET
        status = $1,
        notes = COALESCE($2, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING
        id,
        email,
        user_type as "userType",
        status,
        created_at as "createdAt",
        updated_at as "updatedAt",
        notified_at as "notifiedAt",
        notes
    `;

    const result = await this.pool.query(query, [
      params.status,
      params.notes,
      params.id
    ]);

    if (result.rows.length === 0) {
      throw new Error('Waitlist entry not found');
    }

    return result.rows[0];
  }

  /**
   * Mark entry as notified
   */
  async markAsNotified(id: string): Promise<void> {
    const query = `
      UPDATE waitlist
      SET notified_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Get waitlist statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byUserType: Record<string, number>;
    recent24h: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE user_type = 'customer') as customers,
        COUNT(*) FILTER (WHERE user_type = 'shop') as shops,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_24h
      FROM waitlist
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      byStatus: {
        pending: parseInt(row.pending),
        contacted: parseInt(row.contacted),
        approved: parseInt(row.approved),
        rejected: parseInt(row.rejected)
      },
      byUserType: {
        customer: parseInt(row.customers),
        shop: parseInt(row.shops)
      },
      recent24h: parseInt(row.recent_24h)
    };
  }

  /**
   * Delete a waitlist entry
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM waitlist WHERE id = $1';
    await this.pool.query(query, [id]);
  }
}

export default new WaitlistRepository();
