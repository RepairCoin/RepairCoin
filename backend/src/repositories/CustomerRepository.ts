import { BaseRepository, PaginatedResult } from './BaseRepository';
import { CustomerData, TierLevel } from '../contracts/TierManager';
import { logger } from '../utils/logger';

export interface CustomerFilters {
  tier?: TierLevel;
  active?: boolean;
}

export class CustomerRepository extends BaseRepository {
  async getAllCustomers(limit: number, offset: number, search?: string): Promise<CustomerData[]> {
    try {
      let query = `
        SELECT * FROM customers 
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (search) {
        query += ` AND (
          LOWER(address) LIKE LOWER($${params.length + 1}) OR 
          LOWER(email) LIKE LOWER($${params.length + 1}) OR 
          LOWER(name) LIKE LOWER($${params.length + 1})
        )`;
        params.push(`%${search}%`);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await this.pool.query(query, params);
      
      return result.rows.map(row => ({
        address: row.address,
        name: row.name,
        email: row.email,
        phone: row.phone,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings),
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      }));
    } catch (error) {
      logger.error('Error fetching all customers:', error);
      throw new Error('Failed to fetch customers');
    }
  }

  async getCustomerCount(search?: string): Promise<number> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM customers 
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (search) {
        query += ` AND (
          LOWER(address) LIKE LOWER($${params.length + 1}) OR 
          LOWER(email) LIKE LOWER($${params.length + 1}) OR 
          LOWER(name) LIKE LOWER($${params.length + 1})
        )`;
        params.push(`%${search}%`);
      }
      
      const result = await this.pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error counting customers:', error);
      throw new Error('Failed to count customers');
    }
  }

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
        currentBalance: row.current_balance ? parseFloat(row.current_balance) : 0,
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by,
        // Enhanced balance tracking fields
        currentRcnBalance: row.current_rcn_balance ? parseFloat(row.current_rcn_balance) : 0,
        pendingMintBalance: row.pending_mint_balance ? parseFloat(row.pending_mint_balance) : 0,
        totalRedemptions: row.total_redemptions ? parseFloat(row.total_redemptions) : 0,
        lastBlockchainSync: row.last_blockchain_sync ? new Date(row.last_blockchain_sync).toISOString() : null
      };
    } catch (error) {
      logger.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer');
    }
  }

  async getCustomerByReferralCode(referralCode: string): Promise<CustomerData | null> {
    try {
      const query = 'SELECT * FROM customers WHERE UPPER(referral_code) = UPPER($1)';
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
        currentBalance: row.current_balance ? parseFloat(row.current_balance) : 0,
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        isActive: row.is_active,
        referralCount: row.referral_count,
        fixflowCustomerId: row.fixflow_customer_id,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        referralCode: row.referral_code,
        referredBy: row.referred_by,
        // Enhanced balance tracking fields
        currentRcnBalance: row.current_rcn_balance ? parseFloat(row.current_rcn_balance) : 0,
        pendingMintBalance: row.pending_mint_balance ? parseFloat(row.pending_mint_balance) : 0,
        totalRedemptions: row.total_redemptions ? parseFloat(row.total_redemptions) : 0,
        lastBlockchainSync: row.last_blockchain_sync ? new Date(row.last_blockchain_sync).toISOString() : null
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
          last_earned_date, is_active, referral_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await this.pool.query(query, [
        customer.address.toLowerCase(),
        customer.address.toLowerCase(), // wallet_address is same as address
        customer.name,
        customer.email,
        customer.phone,
        customer.tier,
        customer.lifetimeEarnings,
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

  async updateCustomerAfterRedemption(
    address: string,
    amount: number
  ): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET total_redemptions = COALESCE(total_redemptions, 0) + $1,
            lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) - $1),
            updated_at = NOW()
        WHERE address = $2
      `;
      
      await this.pool.query(query, [amount, address.toLowerCase()]);
      logger.info('Customer redemption recorded - balance reduced', { address, amount });
    } catch (error) {
      logger.error('Error updating customer redemption:', error);
      throw new Error('Failed to update customer redemption');
    }
  }

  async updateCustomerAfterEarning(
    address: string, 
    amount: number, 
    newTier: TierLevel
  ): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          lifetime_earnings = lifetime_earnings + $1,
          tier = $2,
          last_earned_date = NOW(),
          updated_at = NOW()
        WHERE address = $3
      `;
      
      await this.pool.query(query, [amount, newTier, address.toLowerCase()]);
      logger.info('Customer earnings updated', { address, amount, newTier });
    } catch (error) {
      logger.error('Error updating customer earnings:', error);
      throw new Error('Failed to update customer earnings');
    }
  }

  async updateBalanceAfterTransfer(
    address: string,
    amount: number
  ): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) + $1),
          updated_at = NOW()
        WHERE address = $2
      `;
      
      await this.pool.query(query, [amount, address.toLowerCase()]);
      logger.info('Customer balance updated after transfer', { address, amount });
    } catch (error) {
      logger.error('Error updating customer balance after transfer:', error);
      throw new Error('Failed to update customer balance after transfer');
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
        lastEarnedDate: row.last_earned_date ? new Date(row.last_earned_date).toISOString() : new Date().toISOString(),
        joinDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
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

  async getCustomerAnalytics(address: string): Promise<{
    totalEarned: number;
    totalSpent: number;
    transactionCount: number;
    favoriteShop: string | null;
    successfulReferrals: number;
    earningsTrend: Array<{ date: string; amount: number }>;
    redemptionHistory: Array<{ date: string; amount: number; shopId: string; shopName: string }>;
  }> {
    try {
      const customerAddr = address.toLowerCase();

      // Get total earned (repair rewards + referral rewards + tier bonuses)
      const earnedQuery = await this.pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint') THEN amount ELSE 0 END), 0) as total_earned,
          COUNT(CASE WHEN type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint') THEN 1 END) as earning_transactions
        FROM transactions 
        WHERE customer_address = $1 AND amount > 0
      `, [customerAddr]);

      // Get total spent (redemptions)
      const spentQuery = await this.pool.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_spent,
          COUNT(*) as redemption_count
        FROM transactions 
        WHERE customer_address = $1 AND type = 'redemption' AND amount > 0
      `, [customerAddr]);

      // Get favorite shop (most transactions with)
      const favoriteShopQuery = await this.pool.query(`
        SELECT 
          t.shop_id,
          s.name as shop_name,
          COUNT(*) as transaction_count
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        WHERE t.customer_address = $1 AND t.shop_id IS NOT NULL
        GROUP BY t.shop_id, s.name
        ORDER BY transaction_count DESC
        LIMIT 1
      `, [customerAddr]);

      // Get successful referrals count
      const referralsQuery = await this.pool.query(`
        SELECT COUNT(*) as successful_referrals
        FROM customers 
        WHERE referred_by = $1 AND is_active = true
      `, [customerAddr]);

      // Get earnings trend (last 30 days)
      const earningsTrendQuery = await this.pool.query(`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(amount), 0) as amount
        FROM transactions 
        WHERE customer_address = $1 
          AND type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `, [customerAddr]);

      // Get redemption history (last 20 redemptions)
      const redemptionHistoryQuery = await this.pool.query(`
        SELECT 
          DATE(t.created_at) as date,
          t.amount,
          t.shop_id,
          s.name as shop_name
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        WHERE t.customer_address = $1 
          AND t.type = 'redemption'
        ORDER BY t.created_at DESC
        LIMIT 20
      `, [customerAddr]);

      const earnedData = earnedQuery.rows[0];
      const spentData = spentQuery.rows[0];
      const favoriteShop = favoriteShopQuery.rows[0];
      const referrals = referralsQuery.rows[0];

      return {
        totalEarned: parseFloat(earnedData.total_earned || '0'),
        totalSpent: parseFloat(spentData.total_spent || '0'),
        transactionCount: parseInt(earnedData.earning_transactions || '0') + parseInt(spentData.redemption_count || '0'),
        favoriteShop: favoriteShop ? favoriteShop.shop_name : null,
        successfulReferrals: parseInt(referrals.successful_referrals || '0'),
        earningsTrend: earningsTrendQuery.rows.map(row => ({
          date: row.date,
          amount: parseFloat(row.amount || '0')
        })),
        redemptionHistory: redemptionHistoryQuery.rows.map(row => ({
          date: row.date,
          amount: parseFloat(row.amount || '0'),
          shopId: row.shop_id,
          shopName: row.shop_name || 'Unknown Shop'
        }))
      };
    } catch (error) {
      logger.error('Error getting customer analytics:', error);
      throw new Error('Failed to get customer analytics');
    }
  }

  // Enhanced Balance Tracking Methods

  /**
   * Get customer's enhanced balance information for hybrid database/blockchain system
   */
  async getCustomerBalance(address: string): Promise<{
    databaseBalance: number;
    pendingMintBalance: number;
    totalBalance: number;
    lifetimeEarnings: number;
    totalRedemptions: number;
    lastBlockchainSync: string | null;
    balanceSynced: boolean;
  } | null> {
    try {
      const query = `
        SELECT 
          current_rcn_balance,
          pending_mint_balance,
          lifetime_earnings,
          total_redemptions,
          last_blockchain_sync,
          (current_rcn_balance + COALESCE(pending_mint_balance, 0)) as total_balance,
          ABS(current_rcn_balance - (lifetime_earnings - COALESCE(total_redemptions, 0))) < 0.00000001 as balance_synced
        FROM customers 
        WHERE address = $1
      `;
      
      const result = await this.pool.query(query, [address.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        databaseBalance: parseFloat(row.current_rcn_balance || '0'),
        pendingMintBalance: parseFloat(row.pending_mint_balance || '0'),
        totalBalance: parseFloat(row.total_balance || '0'),
        lifetimeEarnings: parseFloat(row.lifetime_earnings || '0'),
        totalRedemptions: parseFloat(row.total_redemptions || '0'),
        lastBlockchainSync: row.last_blockchain_sync ? new Date(row.last_blockchain_sync).toISOString() : null,
        balanceSynced: row.balance_synced
      };
    } catch (error) {
      logger.error('Error getting customer balance:', error);
      throw new Error('Failed to get customer balance');
    }
  }

  /**
   * Update customer's database balance after earning
   */
  async updateBalanceAfterEarning(
    address: string, 
    amount: number, 
    newTier: TierLevel
  ): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          lifetime_earnings = lifetime_earnings + $1,
          current_rcn_balance = COALESCE(current_rcn_balance, 0) + $1,
          tier = $2,
          last_earned_date = NOW(),
          updated_at = NOW()
        WHERE address = $3
      `;
      
      await this.pool.query(query, [amount, newTier, address.toLowerCase()]);
      logger.info('Customer balance updated after earning', { address, amount, newTier });
    } catch (error) {
      logger.error('Error updating balance after earning:', error);
      throw new Error('Failed to update balance after earning');
    }
  }

  /**
   * Update customer's database balance after redemption
   */
  async updateBalanceAfterRedemption(address: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - $1),
          total_redemptions = COALESCE(total_redemptions, 0) + $1,
          updated_at = NOW()
        WHERE address = $2
      `;
      
      await this.pool.query(query, [amount, address.toLowerCase()]);
      logger.info('Customer balance updated after redemption', { address, amount });
    } catch (error) {
      logger.error('Error updating balance after redemption:', error);
      throw new Error('Failed to update balance after redemption');
    }
  }

  /**
   * Move customer balance to pending mint queue (for mint-to-wallet feature)
   */
  async queueForMinting(address: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - $1),
          pending_mint_balance = COALESCE(pending_mint_balance, 0) + $1,
          updated_at = NOW()
        WHERE address = $2 
        AND COALESCE(current_rcn_balance, 0) >= $1
      `;
      
      const result = await this.pool.query(query, [amount, address.toLowerCase()]);
      
      if (result.rowCount === 0) {
        throw new Error('Insufficient balance for minting or customer not found');
      }
      
      logger.info('Customer balance queued for minting', { address, amount });
    } catch (error) {
      logger.error('Error queueing balance for minting:', error);
      throw new Error('Failed to queue balance for minting');
    }
  }

  /**
   * Complete blockchain mint and remove from pending queue
   */
  async completeMint(address: string, amount: number, blockchainTxHash: string): Promise<void> {
    try {
      const query = `
        UPDATE customers 
        SET 
          pending_mint_balance = GREATEST(0, COALESCE(pending_mint_balance, 0) - $1),
          last_blockchain_sync = NOW(),
          updated_at = NOW()
        WHERE address = $2 
        AND COALESCE(pending_mint_balance, 0) >= $1
      `;
      
      const result = await this.pool.query(query, [amount, address.toLowerCase()]);
      
      if (result.rowCount === 0) {
        throw new Error('Insufficient pending balance or customer not found');
      }
      
      logger.info('Customer mint completed', { address, amount, blockchainTxHash });
    } catch (error) {
      logger.error('Error completing mint:', error);
      throw new Error('Failed to complete mint');
    }
  }

  /**
   * Get customers with pending mint balances (for batch processing)
   */
  async getCustomersWithPendingMints(limit: number = 100): Promise<Array<{
    address: string;
    name: string | null;
    pendingAmount: number;
  }>> {
    try {
      const query = `
        SELECT address, name, pending_mint_balance as pending_amount
        FROM customers 
        WHERE pending_mint_balance > 0 
        AND is_active = true
        ORDER BY pending_mint_balance DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        address: row.address,
        name: row.name,
        pendingAmount: parseFloat(row.pending_amount)
      }));
    } catch (error) {
      logger.error('Error getting customers with pending mints:', error);
      throw new Error('Failed to get customers with pending mints');
    }
  }

  /**
   * Sync customer balance with calculated values (maintenance function)
   */
  async syncCustomerBalance(address: string): Promise<void> {
    try {
      // Calculate balance from transactions
      const balanceQuery = `
        WITH balance_calculation AS (
          SELECT 
            COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as total_earned,
            COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redeemed
          FROM transactions 
          WHERE customer_address = $1
        )
        UPDATE customers 
        SET 
          current_rcn_balance = GREATEST(0, bc.total_earned - bc.total_redeemed),
          total_redemptions = bc.total_redeemed,
          updated_at = NOW()
        FROM balance_calculation bc
        WHERE address = $1
      `;
      
      await this.pool.query(balanceQuery, [address.toLowerCase()]);
      logger.info('Customer balance synced', { address });
    } catch (error) {
      logger.error('Error syncing customer balance:', error);
      throw new Error('Failed to sync customer balance');
    }
  }

  /**
   * Get aggregate balance statistics for analytics
   */
  async getBalanceStatistics(): Promise<{
    totalDatabaseBalance: number;
    totalPendingMints: number;
    totalCustomersWithBalance: number;
    averageBalance: number;
  }> {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(current_rcn_balance), 0) as total_database_balance,
          COALESCE(SUM(pending_mint_balance), 0) as total_pending_mints,
          COUNT(CASE WHEN current_rcn_balance > 0 THEN 1 END) as customers_with_balance,
          COALESCE(AVG(NULLIF(current_rcn_balance, 0)), 0) as average_balance
        FROM customers 
        WHERE is_active = true
      `;

      const result = await this.pool.query(query);
      const row = result.rows[0];

      return {
        totalDatabaseBalance: parseFloat(row.total_database_balance || '0'),
        totalPendingMints: parseFloat(row.total_pending_mints || '0'),
        totalCustomersWithBalance: parseInt(row.customers_with_balance || '0'),
        averageBalance: parseFloat(row.average_balance || '0')
      };
    } catch (error) {
      logger.error('Error getting balance statistics:', error);
      throw new Error('Failed to get balance statistics');
    }
  }

}