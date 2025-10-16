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

    const result = await this.pool.query(query, values);
    const row = result.rows[0];
    
    // Map database columns to PromoCode interface
    return {
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: data.name || row.code,
      description: data.description,
      bonus_type: row.discount_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.discount_value),
      max_bonus: data.max_bonus,
      start_date: row.valid_from,
      end_date: row.valid_until,
      total_usage_limit: row.max_uses || undefined,
      per_customer_limit: data.per_customer_limit || 1,
      times_used: row.used_count || 0,
      total_bonus_issued: 0,
      is_active: row.status === 'active',
      created_at: row.created_at,
      updated_at: row.created_at
    };
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
    
    // Map database columns to PromoCode interface
    const row = result.rows[0];
    return {
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: row.code, // Use code as name since name column doesn't exist
      description: row.conditions?.description || undefined,
      bonus_type: row.discount_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.discount_value),
      max_bonus: row.conditions?.max_bonus || undefined,
      start_date: row.valid_from,
      end_date: row.valid_until,
      total_usage_limit: row.max_uses || undefined,
      per_customer_limit: row.conditions?.per_customer_limit || 1,
      times_used: row.used_count || 0,
      total_bonus_issued: (parseFloat(row.discount_value) * (row.used_count || 0)) || 0,
      is_active: row.status === 'active',
      created_at: row.created_at,
      updated_at: row.created_at // Use created_at since updated_at doesn't exist
    };
  }

  async findByShop(shopId: string, onlyActive = false): Promise<PromoCode[]> {
    let query = 'SELECT * FROM promo_codes WHERE shop_id = $1';
    const values: any[] = [shopId];

    if (onlyActive) {
      query += ' AND status = \'active\' AND valid_from <= CURRENT_TIMESTAMP AND valid_until >= CURRENT_TIMESTAMP';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, values);
    
    // Map database columns to PromoCode interface
    return result.rows.map(row => ({
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: row.code, // Use code as name since name column doesn't exist
      description: row.conditions?.description || undefined,
      bonus_type: row.discount_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.discount_value),
      max_bonus: row.conditions?.max_bonus || undefined,
      start_date: row.valid_from,
      end_date: row.valid_until,
      total_usage_limit: row.max_uses || undefined,
      per_customer_limit: row.conditions?.per_customer_limit || 1,
      times_used: row.used_count || 0,
      total_bonus_issued: (parseFloat(row.discount_value) * (row.used_count || 0)) || 0,
      is_active: row.status === 'active',
      created_at: row.created_at,
      updated_at: row.created_at // Use created_at since updated_at doesn't exist
    }));
  }

  async update(id: number, updates: Partial<PromoCode>): Promise<PromoCode | null> {
    // Map PromoCode interface fields to database columns
    const dbUpdates: any = {};
    
    if (updates.bonus_type !== undefined) {
      dbUpdates.discount_type = updates.bonus_type;
    }
    if (updates.bonus_value !== undefined) {
      dbUpdates.discount_value = updates.bonus_value;
    }
    if (updates.total_usage_limit !== undefined) {
      dbUpdates.max_uses = updates.total_usage_limit;
    }
    if (updates.start_date !== undefined) {
      dbUpdates.valid_from = updates.start_date;
    }
    if (updates.end_date !== undefined) {
      dbUpdates.valid_until = updates.end_date;
    }
    if (updates.is_active !== undefined) {
      dbUpdates.status = updates.is_active ? 'active' : 'inactive';
    }
    
    // Handle conditions for additional fields
    if (updates.max_bonus !== undefined || updates.per_customer_limit !== undefined || updates.description !== undefined) {
      const existing = await this.findById(id);
      if (existing) {
        const conditions = (existing as any).conditions || {};
        if (updates.max_bonus !== undefined) conditions.max_bonus = updates.max_bonus;
        if (updates.per_customer_limit !== undefined) conditions.per_customer_limit = updates.per_customer_limit;
        if (updates.description !== undefined) conditions.description = updates.description;
        dbUpdates.conditions = conditions;
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      const existing = await this.findById(id);
      return existing;
    }

    const setClause = Object.keys(dbUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(dbUpdates)];

    const query = `
      UPDATE promo_codes 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (!result.rows[0]) return null;
    
    // Map database columns to PromoCode interface
    const row = result.rows[0];
    return {
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: row.code,
      description: row.conditions?.description || undefined,
      bonus_type: row.discount_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.discount_value),
      max_bonus: row.conditions?.max_bonus || undefined,
      start_date: row.valid_from,
      end_date: row.valid_until,
      total_usage_limit: row.max_uses || undefined,
      per_customer_limit: row.conditions?.per_customer_limit || 1,
      times_used: row.used_count || 0,
      total_bonus_issued: (parseFloat(row.discount_value) * (row.used_count || 0)) || 0,
      is_active: row.status === 'active',
      created_at: row.created_at,
      updated_at: row.created_at
    };
  }

  async validate(code: string, shopId: string, customerAddress: string): Promise<PromoCodeValidation> {
    const query = 'SELECT * FROM validate_promo_code($1, $2, $3)';
    const values = [code, shopId, customerAddress.toLowerCase()];

    console.log('Validating promo code:', { code, shopId, customerAddress: customerAddress.toLowerCase() });
    
    try {
      const result = await this.pool.query<PromoCodeValidation>(query, values);
      console.log('Validation result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in validate method:', error);
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

      const insertResult = await client.query(insertQuery, insertValues);
      
      // Map the database result to PromoCodeUse interface
      const dbRow = insertResult.rows[0];
      const use: PromoCodeUse = {
        id: dbRow.id,
        promo_code_id: dbRow.promo_code_id,
        customer_address: dbRow.customer_address,
        shop_id: dbRow.shop_id,
        transaction_id: dbRow.transaction_id ? parseInt(dbRow.transaction_id) : undefined,
        base_reward: baseReward,  // Use the parameter since it's not in DB
        bonus_amount: bonusAmount,  // Use the parameter since it's not in DB (same as discount_applied)
        total_reward: baseReward + bonusAmount,  // Calculate since it's not in DB
        used_at: dbRow.used_at
      };

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
      SELECT 
        pcu.id,
        pcu.promo_code_id,
        pcu.customer_address,
        pcu.shop_id,
        pcu.transaction_id,
        pcu.discount_applied as bonus_amount,
        pcu.used_at,
        pc.code,
        pc.code as promo_name
      FROM promo_code_uses pcu
      JOIN promo_codes pc ON pcu.promo_code_id = pc.id
      WHERE pcu.customer_address = $1
      ORDER BY pcu.used_at DESC
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
    
    // Map the results to PromoCodeUse interface
    return result.rows.map(row => ({
      id: row.id,
      promo_code_id: row.promo_code_id,
      customer_address: row.customer_address,
      shop_id: row.shop_id,
      transaction_id: row.transaction_id ? parseInt(row.transaction_id) : undefined,
      base_reward: 0,  // Not stored in DB, using default
      bonus_amount: parseFloat(row.bonus_amount) || 0,
      total_reward: parseFloat(row.bonus_amount) || 0,  // Assuming bonus_amount is the total for now
      used_at: row.used_at
    }));
  }

  async deactivate(id: number): Promise<boolean> {
    const query = 'UPDATE promo_codes SET status = \'inactive\' WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async findById(id: number): Promise<PromoCode | null> {
    const query = 'SELECT * FROM promo_codes WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (!result.rows[0]) return null;
    
    // Map database columns to PromoCode interface
    const row = result.rows[0];
    return {
      id: row.id,
      code: row.code,
      shop_id: row.shop_id,
      name: row.code,
      description: row.conditions?.description || undefined,
      bonus_type: row.discount_type as 'fixed' | 'percentage',
      bonus_value: parseFloat(row.discount_value),
      max_bonus: row.conditions?.max_bonus || undefined,
      start_date: row.valid_from,
      end_date: row.valid_until,
      total_usage_limit: row.max_uses || undefined,
      per_customer_limit: row.conditions?.per_customer_limit || 1,
      times_used: row.used_count || 0,
      total_bonus_issued: (parseFloat(row.discount_value) * (row.used_count || 0)) || 0,
      is_active: row.status === 'active',
      created_at: row.created_at,
      updated_at: row.created_at
    };
  }
}