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
        code, shop_id, discount_type, discount_value, max_uses,
        valid_from, valid_until, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      data.code.toUpperCase(),
      data.shop_id,
      data.bonus_type, // maps to discount_type
      data.bonus_value, // maps to discount_value  
      data.total_usage_limit || null, // maps to max_uses
      data.start_date, // maps to valid_from
      data.end_date, // maps to valid_until
      'active', // status
      data.shop_id // created_by (using shop_id as creator)
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
      query += ' AND status = \'active\' AND valid_from <= CURRENT_TIMESTAMP AND valid_until >= CURRENT_TIMESTAMP';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query<PromoCode>(query, values);
    return result.rows;
  }

  async update(id: number, updates: Partial<PromoCode>): Promise<PromoCode | null> {
    const allowedFields = [
      'discount_type', 'discount_value', 'max_uses',
      'valid_from', 'valid_until', 'status', 'conditions'
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
          discount_applied
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const insertValues = [
        promoCodeId,
        customerAddress.toLowerCase(),
        shopId,
        transactionId ? transactionId.toString() : null,
        bonusAmount  // Using bonusAmount as the discount_applied value
      ];

      const insertResult = await client.query<PromoCodeUse>(insertQuery, insertValues);
      const use = insertResult.rows[0];

      // Update promo code stats
      const updateQuery = `
        UPDATE promo_codes
        SET used_count = used_count + 1
        WHERE id = $1
      `;

      await client.query(updateQuery, [promoCodeId]);

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
        SUM(discount_applied) as total_bonus_issued,
        AVG(discount_applied) as average_bonus
      FROM promo_code_uses
      WHERE promo_code_id = $1
    `;

    const dailyQuery = `
      SELECT 
        DATE(used_at) as date,
        COUNT(*) as uses,
        SUM(discount_applied) as bonus_issued
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
      SELECT pcu.*, pc.code, pc.code as promo_name
      FROM promo_code_uses pcu
      JOIN promo_codes pc ON pcu.promo_code_id = pc.id
      WHERE pcu.customer_address = $1
      ORDER BY pcu.used_at DESC
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
    return result.rows;
  }

  async deactivate(id: number): Promise<boolean> {
    const query = 'UPDATE promo_codes SET status = \'inactive\' WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async findById(id: number): Promise<PromoCode | null> {
    const query = 'SELECT * FROM promo_codes WHERE id = $1';
    const result = await this.pool.query<PromoCode>(query, [id]);
    return result.rows[0] || null;
  }
}