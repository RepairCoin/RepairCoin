import { BaseRepository } from './BaseRepository';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface PromoCode {
  id: number;
  code: string;
  shop_id: string;
  name: string;
  description?: string;
  bonus_type: 'fixed' | 'percentage';
  bonus_value: number;
  max_bonus?: number;
  start_date: Date;
  end_date: Date;
  total_usage_limit?: number;
  per_customer_limit: number;
  times_used: number;
  total_bonus_issued: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PromoCodeUse {
  id: number;
  promo_code_id: number;
  customer_address: string;
  shop_id: string;
  transaction_id?: number;
  base_reward: number;
  bonus_amount: number;
  total_reward: number;
  used_at: Date;
}

export interface CreatePromoCodeData {
  code: string;
  shop_id: string;
  name: string;
  description?: string;
  bonus_type: 'fixed' | 'percentage';
  bonus_value: number;
  max_bonus?: number;
  start_date: Date;
  end_date: Date;
  total_usage_limit?: number;
  per_customer_limit?: number;
}

export interface PromoCodeValidation {
  is_valid: boolean;
  error_message?: string;
  promo_code_id?: number;
  bonus_type?: 'fixed' | 'percentage';
  bonus_value?: number;
  max_bonus?: number;
}

export class PromoCodeRepository extends BaseRepository {
  constructor() {
    super();
  }

  async create(data: CreatePromoCodeData): Promise<PromoCode> {
    const query = `
      INSERT INTO promo_codes (
        code, shop_id, name, description, bonus_type, bonus_value, max_bonus,
        start_date, end_date, total_usage_limit, per_customer_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      data.code.toUpperCase(),
      data.shop_id,
      data.name,
      data.description || null,
      data.bonus_type,
      data.bonus_value,
      data.max_bonus || null,
      data.start_date,
      data.end_date,
      data.total_usage_limit || null,
      data.per_customer_limit || 1
    ];

    const result = await this.pool.query(query, values);
    const row = result.rows[0];

    return this.mapRowToPromoCode(row);
  }

  async findByCode(code: string, shopId?: string): Promise<PromoCode | null> {
    let query = 'SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1)';
    const values: any[] = [code];

    if (shopId) {
      query += ' AND shop_id = $2';
      values.push(shopId);
    }

    const result = await this.pool.query(query, values);
    if (!result.rows[0]) return null;

    return this.mapRowToPromoCode(result.rows[0]);
  }

  async findByShop(shopId: string, onlyActive = false): Promise<PromoCode[]> {
    let query = 'SELECT * FROM promo_codes WHERE shop_id = $1';
    const values: any[] = [shopId];

    if (onlyActive) {
      query += ' AND is_active = true AND start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, values);

    return result.rows.map(row => this.mapRowToPromoCode(row));
  }

  async update(id: number, updates: Partial<PromoCode>): Promise<PromoCode | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.bonus_type !== undefined) {
      updateFields.push(`bonus_type = $${paramCount++}`);
      values.push(updates.bonus_type);
    }
    if (updates.bonus_value !== undefined) {
      updateFields.push(`bonus_value = $${paramCount++}`);
      values.push(updates.bonus_value);
    }
    if (updates.max_bonus !== undefined) {
      updateFields.push(`max_bonus = $${paramCount++}`);
      values.push(updates.max_bonus);
    }
    if (updates.start_date !== undefined) {
      updateFields.push(`start_date = $${paramCount++}`);
      values.push(updates.start_date);
    }
    if (updates.end_date !== undefined) {
      updateFields.push(`end_date = $${paramCount++}`);
      values.push(updates.end_date);
    }
    if (updates.total_usage_limit !== undefined) {
      updateFields.push(`total_usage_limit = $${paramCount++}`);
      values.push(updates.total_usage_limit);
    }
    if (updates.per_customer_limit !== undefined) {
      updateFields.push(`per_customer_limit = $${paramCount++}`);
      values.push(updates.per_customer_limit);
    }
    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE promo_codes
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (!result.rows[0]) return null;

    return this.mapRowToPromoCode(result.rows[0]);
  }

  async validate(code: string, shopId: string, customerAddress: string): Promise<PromoCodeValidation> {
    const query = 'SELECT * FROM validate_promo_code($1, $2, $3)';
    const values = [code, shopId, customerAddress.toLowerCase()];

    logger.debug('Validating promo code:', { code, shopId, customerAddress: customerAddress.toLowerCase() });

    try {
      const result = await this.pool.query<PromoCodeValidation>(query, values);
      logger.debug('Validation result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error in validate method:', error);
      throw error;
    }
  }

  async recordUse(
    promoCodeId: number,
    customerAddress: string,
    shopId: string,
    baseReward: number,
    bonusAmount: number,
    transactionId?: number
  ): Promise<PromoCodeUse> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Record the use
      const insertQuery = `
        INSERT INTO promo_code_uses (
          promo_code_id, customer_address, shop_id, transaction_id,
          base_reward, bonus_amount, total_reward
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const totalReward = baseReward + bonusAmount;
      const insertValues = [
        promoCodeId,
        customerAddress.toLowerCase(),
        shopId,
        transactionId ? transactionId.toString() : null,
        baseReward,
        bonusAmount,
        totalReward
      ];

      const insertResult = await client.query(insertQuery, insertValues);
      const dbRow = insertResult.rows[0];

      // Update promo code stats
      const updateQuery = `
        UPDATE promo_codes
        SET times_used = times_used + 1,
            total_bonus_issued = total_bonus_issued + $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(updateQuery, [promoCodeId, bonusAmount]);

      await client.query('COMMIT');

      return {
        id: dbRow.id,
        promo_code_id: dbRow.promo_code_id,
        customer_address: dbRow.customer_address,
        shop_id: dbRow.shop_id,
        transaction_id: dbRow.transaction_id ? parseInt(dbRow.transaction_id) : undefined,
        base_reward: parseFloat(dbRow.base_reward),
        bonus_amount: parseFloat(dbRow.bonus_amount),
        total_reward: parseFloat(dbRow.total_reward),
        used_at: dbRow.used_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUsageStats(promoCodeId: number): Promise<{
    total_uses: number;
    unique_customers: number;
    total_bonus_issued: number;
    average_bonus: number;
    uses_by_day: Array<{ date: string; uses: number; bonus_issued: number }>;
  }> {
    const statsQuery = `
      SELECT
        COUNT(*) as total_uses,
        COUNT(DISTINCT customer_address) as unique_customers,
        SUM(bonus_amount) as total_bonus_issued,
        AVG(bonus_amount) as average_bonus
      FROM promo_code_uses
      WHERE promo_code_id = $1
    `;

    const dailyQuery = `
      SELECT
        DATE(used_at) as date,
        COUNT(*) as uses,
        SUM(bonus_amount) as bonus_issued
      FROM promo_code_uses
      WHERE promo_code_id = $1
      GROUP BY DATE(used_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    const [statsResult, dailyResult] = await Promise.all([
      this.pool.query(statsQuery, [promoCodeId]),
      this.pool.query(dailyQuery, [promoCodeId])
    ]);

    return {
      total_uses: parseInt(statsResult.rows[0].total_uses) || 0,
      unique_customers: parseInt(statsResult.rows[0].unique_customers) || 0,
      total_bonus_issued: parseFloat(statsResult.rows[0].total_bonus_issued) || 0,
      average_bonus: parseFloat(statsResult.rows[0].average_bonus) || 0,
      uses_by_day: dailyResult.rows
    };
  }

  async getCustomerUsage(customerAddress: string): Promise<PromoCodeUse[]> {
    const query = `
      SELECT
        pcu.id,
        pcu.promo_code_id,
        pcu.customer_address,
        pcu.shop_id,
        pcu.transaction_id,
        pcu.base_reward,
        pcu.bonus_amount,
        pcu.total_reward,
        pcu.used_at,
        pc.code,
        pc.name as promo_name
      FROM promo_code_uses pcu
      JOIN promo_codes pc ON pcu.promo_code_id = pc.id
      WHERE pcu.customer_address = $1
      ORDER BY pcu.used_at DESC
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);

    return result.rows.map(row => ({
      id: row.id,
      promo_code_id: row.promo_code_id,
      customer_address: row.customer_address,
      shop_id: row.shop_id,
      transaction_id: row.transaction_id ? parseInt(row.transaction_id) : undefined,
      base_reward: parseFloat(row.base_reward),
      bonus_amount: parseFloat(row.bonus_amount),
      total_reward: parseFloat(row.total_reward),
      used_at: row.used_at
    }));
  }

  async deactivate(id: number): Promise<boolean> {
    const query = 'UPDATE promo_codes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async findById(id: number): Promise<PromoCode | null> {
    const query = 'SELECT * FROM promo_codes WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (!result.rows[0]) return null;

    return this.mapRowToPromoCode(result.rows[0]);
  }

  private mapRowToPromoCode(row: any): PromoCode {
    return {
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: row.name,
      description: row.description || undefined,
      bonus_type: row.bonus_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.bonus_value),
      max_bonus: row.max_bonus ? parseFloat(row.max_bonus) : undefined,
      start_date: row.start_date,
      end_date: row.end_date,
      total_usage_limit: row.total_usage_limit || undefined,
      per_customer_limit: row.per_customer_limit || 1,
      times_used: row.times_used || 0,
      total_bonus_issued: parseFloat(row.total_bonus_issued) || 0,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
