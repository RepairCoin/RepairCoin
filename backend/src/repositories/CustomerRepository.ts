import { BaseRepository, PaginatedResult } from './BaseRepository';
import { CustomerData, TierLevel } from '../contracts/TierManager';
import { logger } from '../utils/logger';

export interface CustomerFilters {
  tier?: TierLevel;
  active?: boolean;
}

export class CustomerRepository extends BaseRepository {
  async getCustomer(address: string): Promise<CustomerData | null> {
    try {
      const query = 'SELECT * FROM customers WHERE address = $1';
      const result = await this.pool.query(query, [address.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Map database fields to CustomerData interface
      const row = result.rows[0];
      return {
        address: row.address,
        name: row.name,
        email: row.email,
        phone: row.phone,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings),
        dailyEarnings: parseFloat(row.daily_earnings || 0),
        monthlyEarnings: parseFloat(row.monthly_earnings),
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.join_date ? new Date(row.join_date).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      };
    } catch (error) {
      logger.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer');
    }
  }

  async getCustomerByReferralCode(referralCode: string): Promise<CustomerData | null> {
    try {
      const query = 'SELECT * FROM customers WHERE referral_code = $1';
      const result = await this.pool.query(query, [referralCode]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Map database fields to CustomerData interface
      const row = result.rows[0];
      return {
        address: row.address,
        name: row.name,
        email: row.email,
        phone: row.phone,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings),
        dailyEarnings: parseFloat(row.daily_earnings || 0),
        monthlyEarnings: parseFloat(row.monthly_earnings),
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.join_date ? new Date(row.join_date).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      };
    } catch (error) {
      logger.error('Error fetching customer by referral code:', error);
      throw new Error('Failed to fetch customer by referral code');
    }
  }

  async createCustomer(customer: CustomerData): Promise<void> {
    try {
      const query = `
        INSERT INTO customers (
          address, wallet_address, name, email, phone, tier, lifetime_earnings,
          daily_earnings, monthly_earnings,
          last_earned_date, is_active, referral_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      await this.pool.query(query, [
        customer.address.toLowerCase(),
        customer.address.toLowerCase(), // wallet_address is same as address
        customer.name,
        customer.email,
        customer.phone,
        customer.tier,
        customer.lifetimeEarnings,
        customer.dailyEarnings,
        customer.monthlyEarnings,
        customer.lastEarnedDate,
        customer.isActive,
        customer.referralCount
      ]);
      
      logger.info('Customer created successfully', { address: customer.address });
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  async updateCustomer(address: string, updates: Partial<CustomerData>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Map camelCase to snake_case for database fields
      const fieldMappings: { [key: string]: string } = {
        name: 'name',
        email: 'email',
        phone: 'phone',
        tier: 'tier',
        lifetimeEarnings: 'lifetime_earnings',
        currentBalance: 'current_balance',
        totalRedemptions: 'total_redemptions',
        monthlyEarnings: 'monthly_earnings',
        lastEarnedDate: 'last_earned_date',
        isActive: 'is_active',
        referralCount: 'referral_count',
        fixflowCustomerId: 'fixflow_customer_id',
        suspendedAt: 'suspended_at',
        suspensionReason: 'suspension_reason',
        referredBy: 'referred_by'
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && fieldMappings[key]) {
          paramCount++;
          fields.push(`${fieldMappings[key]} = $${paramCount}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return;
      }

      paramCount++;
      values.push(address.toLowerCase());

      const query = `
        UPDATE customers 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE address = $${paramCount}
      `;

      await this.pool.query(query, values);
      logger.info('Customer updated successfully', { address });
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw new Error('Failed to update customer');
    }
  }

  async updateCustomerAfterEarning(
    address: string, 
    amount: number, 
    newTier: TierLevel
  ): Promise<void> {
    try {
      // First get the customer to check if we need to reset daily/monthly earnings
      const customer = await this.getCustomer(address);
      if (!customer) {
        throw new Error('Customer not found');
      }
      
      const today = new Date().toISOString().split('T')[0];
      const customerLastEarnedDateOnly = customer.lastEarnedDate.split('T')[0];
      const currentDate = new Date();
      const lastEarnedDate = new Date(customer.lastEarnedDate);
      
      // Determine if we need to reset daily/monthly earnings
      const isNewDay = customerLastEarnedDateOnly !== today;
      const isNewMonth = (currentDate.getMonth() !== lastEarnedDate.getMonth() || 
                         currentDate.getFullYear() !== lastEarnedDate.getFullYear());
      
      let query: string;
      if (isNewDay && isNewMonth) {
        // Reset both daily and monthly
        query = `
          UPDATE customers 
          SET 
            lifetime_earnings = lifetime_earnings + $1,
            daily_earnings = $1,
            monthly_earnings = $1,
            tier = $2,
            last_earned_date = NOW(),
            updated_at = NOW()
          WHERE address = $3
        `;
      } else if (isNewDay) {
        // Reset only daily
        query = `
          UPDATE customers 
          SET 
            lifetime_earnings = lifetime_earnings + $1,
            daily_earnings = $1,
            monthly_earnings = monthly_earnings + $1,
            tier = $2,
            last_earned_date = NOW(),
            updated_at = NOW()
          WHERE address = $3
        `;
      } else {
        // No reset needed
        query = `
          UPDATE customers 
          SET 
            lifetime_earnings = lifetime_earnings + $1,
            daily_earnings = daily_earnings + $1,
            monthly_earnings = monthly_earnings + $1,
            tier = $2,
            last_earned_date = NOW(),
            updated_at = NOW()
          WHERE address = $3
        `;
      }
      
      await this.pool.query(query, [amount, newTier, address.toLowerCase()]);
      logger.info('Customer earnings updated', { address, amount, newTier, isNewDay, isNewMonth });
    } catch (error) {
      logger.error('Error updating customer earnings:', error);
      throw new Error('Failed to update customer earnings');
    }
  }

  async updateCustomerAfterRedemption(address: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          updated_at = NOW()
        WHERE address = $1
      `;
      
      await this.pool.query(query, [address.toLowerCase()]);
      logger.info('Customer redemption updated', { address, amount });
    } catch (error) {
      logger.error('Error updating customer redemption:', error);
      throw new Error('Failed to update customer redemption');
    }
  }

  async updateCustomerProfile(
    address: string,
    updates: {
      name?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<void> {
    try {
      const setClause: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      // Build dynamic SET clause based on provided fields
      if (updates.name !== undefined) {
        paramCount++;
        setClause.push(`name = $${paramCount}`);
        params.push(updates.name);
      }

      if (updates.email !== undefined) {
        paramCount++;
        setClause.push(`email = $${paramCount}`);
        params.push(updates.email);
      }

      if (updates.phone !== undefined) {
        paramCount++;
        setClause.push(`phone = $${paramCount}`);
        params.push(updates.phone);
      }

      // Always update the updated_at timestamp
      setClause.push('updated_at = NOW()');

      if (setClause.length === 1) {
        // Only updated_at, nothing else to update
        return;
      }

      paramCount++;
      params.push(address.toLowerCase());

      const query = `
        UPDATE customers 
        SET ${setClause.join(', ')}
        WHERE address = $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      if (result.rowCount === 0) {
        throw new Error('Customer not found');
      }

      logger.info('Customer profile updated', { address, updates });
    } catch (error) {
      logger.error('Error updating customer profile:', error);
      throw new Error('Failed to update customer profile');
    }
  }

  async getCustomersPaginated(
    filters: CustomerFilters & { page: number; limit: number }
  ): Promise<PaginatedResult<CustomerData>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.tier) {
        paramCount++;
        whereClause += ` AND tier = $${paramCount}`;
        params.push(filters.tier);
      }

      if (filters.active !== undefined) {
        paramCount++;
        whereClause += ` AND is_active = $${paramCount}`;
        params.push(filters.active);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM customers ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT * FROM customers 
        ${whereClause}
        ORDER BY lifetime_earnings DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const customers = result.rows.map(row => ({
        address: row.address,
        name: row.name,
        email: row.email,
        phone: row.phone,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings),
        dailyEarnings: parseFloat(row.daily_earnings || 0),
        monthlyEarnings: parseFloat(row.monthly_earnings),
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.join_date ? new Date(row.join_date).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      }));

      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: customers,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting paginated customers:', error);
      throw new Error('Failed to get customers');
    }
  }

  async getCustomersByTier(tier: TierLevel): Promise<CustomerData[]> {
    try {
      const query = 'SELECT * FROM customers WHERE tier = $1 AND is_active = true';
      const result = await this.pool.query(query, [tier]);
      
      return result.rows.map(row => ({
        address: row.address,
        name: row.name,
        email: row.email,
        phone: row.phone,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings),
        dailyEarnings: parseFloat(row.daily_earnings || 0),
        monthlyEarnings: parseFloat(row.monthly_earnings),
        lastEarnedDate: row.last_earned_date,
        joinDate: row.join_date,
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      }));
    } catch (error) {
      logger.error('Error getting customers by tier:', error);
      throw new Error('Failed to get customers by tier');
    }
  }

  async resetMonthlyEarnings(): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET monthly_earnings = 0, updated_at = NOW()
        WHERE monthly_earnings > 0
      `;
      
      const result = await this.pool.query(query);
      logger.info(`Monthly earnings reset for ${result.rowCount} customers`);
    } catch (error) {
      logger.error('Error resetting monthly earnings:', error);
      throw new Error('Failed to reset monthly earnings');
    }
  }
}