import { BaseRepository } from './BaseRepository';
import { Pool } from 'pg';

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

    const result = await this.pool.query<PromoCode>(query, values);
    return result.rows[0];
  }

  async findByCode(code: string, shopId?: string): Promise<PromoCode | null> {
    let query = 'SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1)';
    const values: any[] = [code];

    if (shopId) {
      query += ' AND shop_id = $2';
      values.push(shopId);
    }

    const result = await this.pool.query<PromoCode>(query, values);
    return result.rows[0] || null;
  }

  async findByShop(shopId: string, onlyActive = false): Promise<PromoCode[]> {
    let query = 'SELECT * FROM promo_codes WHERE shop_id = $1';
    const values: any[] = [shopId];

    if (onlyActive) {
      query += ' AND is_active = true AND start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query<PromoCode>(query, values);
    return result.rows;
  }

  async update(id: number, updates: Partial<PromoCode>): Promise<PromoCode | null> {
    const allowedFields = [
      'name', 'description', 'bonus_type', 'bonus_value', 'max_bonus',
      'start_date', 'end_date', 'total_usage_limit', 'per_customer_limit',
      'is_active'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: updates[key as keyof PromoCode] }), {});

    if (Object.keys(filteredUpdates).length === 0) {
      const existing = await this.findById(id);
      return existing;
    }

    (filteredUpdates as any).updated_at = new Date();

    const setClause = Object.keys(filteredUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(filteredUpdates)];

    const query = `
      UPDATE promo_codes 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query<PromoCode>(query, values);
    return result.rows[0] || null;
  }

  async validate(code: string, shopId: string, customerAddress: string): Promise<PromoCodeValidation> {
    const query = 'SELECT * FROM validate_promo_code($1, $2, $3)';
    const values = [code, shopId, customerAddress.toLowerCase()];

    const result = await this.pool.query<PromoCodeValidation>(query, values);
    return result.rows[0];
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

      const insertValues = [
        promoCodeId,
        customerAddress.toLowerCase(),
        shopId,
        transactionId || null,
        baseReward,
        bonusAmount,
        baseReward + bonusAmount
      ];

      const insertResult = await client.query<PromoCodeUse>(insertQuery, insertValues);
      const use = insertResult.rows[0];

      // Update promo code stats
      const updateQuery = `
        UPDATE promo_codes
        SET times_used = times_used + 1,
            total_bonus_issued = total_bonus_issued + $2
        WHERE id = $1
      `;

      await client.query(updateQuery, [promoCodeId, bonusAmount]);

      await client.query('COMMIT');
      return use;
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
      SELECT pcu.*, pc.code, pc.name as promo_name
      FROM promo_code_uses pcu
      JOIN promo_codes pc ON pcu.promo_code_id = pc.id
      WHERE pcu.customer_address = $1
      ORDER BY pcu.used_at DESC
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
    return result.rows;
  }

  async deactivate(id: number): Promise<boolean> {
    const query = 'UPDATE promo_codes SET is_active = false WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async findById(id: number): Promise<PromoCode | null> {
    const query = 'SELECT * FROM promo_codes WHERE id = $1';
    const result = await this.pool.query<PromoCode>(query, [id]);
    return result.rows[0] || null;
  }
}