import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ShopRcnPurchase {
  id: string;
  shopId: string;
  purchaseAmount: number;
  amountPaid: number;
  pricePerToken: number;
  paymentMethod: string;
  paymentDetails?: any;
  status: 'pending' | 'completed' | 'failed';
  purchasedAt: string;
  completedAt?: string;
}

export interface TreasuryData {
  totalSupply: number;
  circulatingSupply: number;
  availableSupply: number;
  totalRevenue: number;
  averageTokenPrice: number;
}

export class TreasuryRepository extends BaseRepository {
  async recordShopRcnPurchase(purchase: ShopRcnPurchase): Promise<void> {
    try {
      const query = `
        INSERT INTO shop_rcn_purchases (
          id, shop_id, amount, total_cost,
          price_per_rcn, payment_method, payment_reference,
          status, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await this.pool.query(query, [
        purchase.id,
        purchase.shopId,
        purchase.purchaseAmount,
        purchase.amountPaid,
        purchase.pricePerToken,
        purchase.paymentMethod,
        purchase.paymentDetails?.reference || null,
        purchase.status,
        purchase.purchasedAt,
        purchase.completedAt
      ]);
      
      logger.info('Shop RCN purchase recorded', {
        purchaseId: purchase.id,
        shopId: purchase.shopId,
        amount: purchase.purchaseAmount
      });
    } catch (error) {
      logger.error('Error recording shop RCN purchase:', error);
      throw new Error('Failed to record shop RCN purchase');
    }
  }

  async updateShopRcnPurchaseStatus(
    purchaseId: string, 
    status: 'completed' | 'failed',
    transactionHash?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_rcn_purchases 
        SET status = $1, 
            completed_at = NOW(),
            payment_reference = COALESCE($2, payment_reference)
        WHERE id = $3
      `;
      
      const paymentUpdate = transactionHash || null;
      
      await this.pool.query(query, [status, paymentUpdate, purchaseId]);
      
      logger.info('Shop RCN purchase status updated', { purchaseId, status });
    } catch (error) {
      logger.error('Error updating shop RCN purchase status:', error);
      throw new Error('Failed to update shop RCN purchase status');
    }
  }

  async getShopRcnPurchases(
    shopId: string,
    status?: 'pending' | 'completed' | 'failed'
  ): Promise<ShopRcnPurchase[]> {
    try {
      let query = 'SELECT * FROM shop_rcn_purchases WHERE shop_id = $1';
      const params: any[] = [shopId];
      
      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }
      
      query += ' ORDER BY purchased_at DESC';
      
      const result = await this.pool.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        shopId: row.shop_id,
        purchaseAmount: parseFloat(row.amount),
        amountPaid: parseFloat(row.total_cost),
        pricePerToken: parseFloat(row.price_per_rcn),
        paymentMethod: row.payment_method,
        paymentDetails: row.payment_reference ? { reference: row.payment_reference } : {},
        status: row.status,
        purchasedAt: row.created_at,
        completedAt: row.completed_at
      }));
    } catch (error) {
      logger.error('Error fetching shop RCN purchases:', error);
      throw new Error('Failed to fetch shop RCN purchases');
    }
  }

  async getShopPurchasedRcnBalance(shopId: string): Promise<number> {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN status = 'completed' THEN amount 
              ELSE 0 
            END
          ), 0) as purchased_balance
        FROM shop_rcn_purchases
        WHERE shop_id = $1
      `;
      
      const result = await this.pool.query(query, [shopId]);
      return parseFloat(result.rows[0].purchased_balance);
    } catch (error) {
      logger.error('Error calculating shop purchased RCN balance:', error);
      throw new Error('Failed to calculate shop purchased RCN balance');
    }
  }

  async getTreasuryData(): Promise<TreasuryData> {
    try {
      const query = `
        WITH minted_stats AS (
          SELECT 
            COALESCE(SUM(amount), 0) as total_minted
          FROM transactions
          WHERE type = 'mint' AND status = 'confirmed'
        ),
        shop_purchase_stats AS (
          SELECT 
            COALESCE(SUM(amount), 0) as total_sold,
            COALESCE(SUM(total_cost), 0) as total_revenue,
            COALESCE(AVG(price_per_rcn), 0.10) as avg_price
          FROM shop_rcn_purchases
          WHERE status IN ('completed', 'minted')
        )
        SELECT 
          'unlimited'::text as total_supply, -- Unlimited supply per v3.0
          ms.total_minted,
          sps.total_sold,
          sps.total_sold + ms.total_minted as circulating_supply,
          'unlimited'::text as available_supply, -- Unlimited availability
          sps.total_revenue,
          sps.avg_price
        FROM minted_stats ms, shop_purchase_stats sps
      `;
      
      const result = await this.pool.query(query);
      const row = result.rows[0];
      
      return {
        totalSupply: row.total_supply === 'unlimited' ? Infinity : parseFloat(row.total_supply),
        circulatingSupply: parseFloat(row.circulating_supply),
        availableSupply: row.available_supply === 'unlimited' ? Infinity : parseFloat(row.available_supply),
        totalRevenue: parseFloat(row.total_revenue),
        averageTokenPrice: parseFloat(row.avg_price)
      };
    } catch (error) {
      logger.error('Error fetching treasury data:', error);
      throw new Error('Failed to fetch treasury data');
    }
  }

  // Public query method for custom queries
  async query(sql: string, params?: any[]) {
    return this.pool.query(sql, params);
  }

  async getRevenueByPeriod(
    startDate: string,
    endDate: string
  ): Promise<{ date: string; revenue: number; purchases: number }[]> {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          SUM(total_cost) as revenue,
          COUNT(*) as purchases
        FROM shop_rcn_purchases
        WHERE status IN ('completed', 'minted')
        AND created_at >= $1
        AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const result = await this.pool.query(query, [startDate, endDate]);
      
      return result.rows.map(row => ({
        date: row.date,
        revenue: parseFloat(row.revenue),
        purchases: parseInt(row.purchases)
      }));
    } catch (error) {
      logger.error('Error fetching revenue by period:', error);
      throw new Error('Failed to fetch revenue by period');
    }
  }

  async updateTreasuryAfterSale(amountSold: number, revenue: number): Promise<void> {
    try {
      const checkQuery = `SELECT COUNT(*) as count FROM admin_treasury`;
      const checkResult = await this.pool.query(checkQuery);
      
      if (parseInt(checkResult.rows[0].count) === 0) {
        // Initialize treasury if it doesn't exist
        await this.pool.query(`
          INSERT INTO admin_treasury (
            total_supply, total_sold, total_revenue, 
            available_supply, last_updated
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [null, amountSold, revenue, null]);
      } else {
        // Update existing treasury
        await this.pool.query(`
          UPDATE admin_treasury 
          SET total_sold = COALESCE(total_sold, 0) + $1,
              total_revenue = COALESCE(total_revenue, 0) + $2,
              last_updated = CURRENT_TIMESTAMP
        `, [amountSold, revenue]);
      }
      
      logger.info('Treasury updated after sale:', { amountSold, revenue });
    } catch (error) {
      logger.error('Error updating treasury after sale:', error);
      throw new Error('Failed to update treasury');
    }
  }

  async getCustomerDiscrepancies(): Promise<Array<{
    address: string;
    name: string;
    totalEarned: number;
    totalRedeemed: number;
    expectedBalance: number;
    offchainMints: number;
    totalMints: number;
    adminTransfers: number;
    status: string;
    needsTokenTransfer: boolean;
    shopsInvolved: string;
  }>> {
    try {
      const query = `
        WITH customer_balances AS (
          SELECT 
            LOWER(t.customer_address) as customer_address,
            MAX(c.name) as customer_name,
            SUM(CASE WHEN t.type = 'mint' AND t.shop_id IS NOT NULL THEN t.amount ELSE 0 END) as total_earned,
            SUM(CASE WHEN t.type = 'redeem' THEN t.amount ELSE 0 END) as total_redeemed,
            SUM(CASE WHEN t.type = 'mint' AND t.shop_id IS NOT NULL THEN t.amount ELSE 0 END) - 
            SUM(CASE WHEN t.type = 'redeem' THEN t.amount ELSE 0 END) as expected_balance,
            COUNT(CASE WHEN t.type = 'mint' AND t.shop_id IS NOT NULL AND (t.transaction_hash IS NULL OR t.transaction_hash = '' OR t.transaction_hash LIKE 'offchain_%') THEN 1 END) as offchain_mints,
            COUNT(CASE WHEN t.type = 'mint' AND t.shop_id IS NOT NULL THEN 1 END) as total_mints,
            STRING_AGG(DISTINCT t.shop_id::text, ', ' ORDER BY t.shop_id::text) FILTER (WHERE t.type = 'mint' AND t.shop_id IS NOT NULL) as shops_involved,
            SUM(CASE WHEN t.type = 'mint' AND t.shop_id IS NULL AND t.metadata::text LIKE '%admin_manual_transfer%' THEN t.amount ELSE 0 END) as admin_transfers
          FROM transactions t
          LEFT JOIN customers c ON LOWER(c.address) = LOWER(t.customer_address)
          WHERE t.status = 'confirmed'
          AND LOWER(t.customer_address) != LOWER('0x761E5E59485ec6feb263320f5d636042bD9EBc8c')
          GROUP BY LOWER(t.customer_address)
          HAVING SUM(CASE WHEN t.type = 'mint' AND t.shop_id IS NOT NULL THEN t.amount ELSE 0 END) > 0
        )
        SELECT 
          customer_address,
          customer_name,
          total_earned,
          total_redeemed,
          expected_balance,
          offchain_mints,
          total_mints,
          shops_involved,
          admin_transfers,
          CASE 
            WHEN admin_transfers >= expected_balance THEN 'Already fixed by admin'
            WHEN offchain_mints = total_mints AND expected_balance > 0 THEN 'All transactions off-chain only'
            WHEN offchain_mints > 0 AND expected_balance > 0 THEN 'Some transactions off-chain'
            WHEN expected_balance > 0 THEN 'May need tokens'
            ELSE 'OK'
          END as status
        FROM customer_balances
        WHERE expected_balance > 0 AND (admin_transfers IS NULL OR admin_transfers < expected_balance)
        ORDER BY expected_balance DESC, offchain_mints DESC
        LIMIT 100
      `;
      
      const result = await this.pool.query(query);
      
      return result.rows.map((row: any) => ({
        address: row.customer_address,
        name: row.customer_name || 'Unknown',
        totalEarned: parseFloat(row.total_earned),
        totalRedeemed: parseFloat(row.total_redeemed),
        expectedBalance: parseFloat(row.expected_balance),
        offchainMints: parseInt(row.offchain_mints),
        totalMints: parseInt(row.total_mints),
        adminTransfers: parseFloat(row.admin_transfers || 0),
        status: row.status,
        needsTokenTransfer: parseFloat(row.expected_balance) > parseFloat(row.admin_transfers || 0),
        shopsInvolved: row.shops_involved || ''
      }));
    } catch (error) {
      logger.error('Error fetching customer discrepancies:', error);
      throw new Error('Failed to fetch customer discrepancies');
    }
  }

  async getAnalyticsData(daysBack: number): Promise<{
    revenue: Array<{ date: string; transaction_count: number; total_rcn_sold: number; total_revenue: number; avg_price_per_rcn: number }>;
    shopGrowth: Array<{ date: string; new_shops: number }>;
    tokenDistribution: Array<{ date: string; tokens_issued: number; tokens_redeemed: number; mint_transactions: number; redeem_transactions: number }>;
  }> {
    try {
      const [revenueQuery, shopGrowthQuery, tokenDistributionQuery] = await Promise.all([
        this.pool.query(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as transaction_count,
            SUM(amount) as total_rcn_sold,
            SUM(total_cost) as total_revenue,
            AVG(total_cost/amount) as avg_price_per_rcn
          FROM shop_rcn_purchases
          WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
          AND status IN ('completed', 'pending')
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `),
        this.pool.query(`
          SELECT 
            DATE(join_date) as date,
            COUNT(*) as new_shops
          FROM shops
          WHERE join_date >= NOW() - INTERVAL '${daysBack} days'
          AND verified = true
          GROUP BY DATE(join_date)
          ORDER BY date ASC
        `),
        this.pool.query(`
          SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as tokens_issued,
            SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as tokens_redeemed,
            COUNT(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN 1 END) as mint_transactions,
            COUNT(CASE WHEN type = 'redeem' THEN 1 END) as redeem_transactions
          FROM transactions
          WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
          AND status = 'confirmed'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `)
      ]);

      return {
        revenue: revenueQuery.rows.map(row => ({
          date: row.date,
          transaction_count: parseInt(row.transaction_count),
          total_rcn_sold: parseFloat(row.total_rcn_sold || 0),
          total_revenue: parseFloat(row.total_revenue || 0),
          avg_price_per_rcn: parseFloat(row.avg_price_per_rcn || 0)
        })),
        shopGrowth: shopGrowthQuery.rows.map(row => ({
          date: row.date,
          new_shops: parseInt(row.new_shops)
        })),
        tokenDistribution: tokenDistributionQuery.rows.map(row => ({
          date: row.date,
          tokens_issued: parseFloat(row.tokens_issued || 0),
          tokens_redeemed: parseFloat(row.tokens_redeemed || 0),
          mint_transactions: parseInt(row.mint_transactions || 0),
          redeem_transactions: parseInt(row.redeem_transactions || 0)
        }))
      };
    } catch (error) {
      logger.error('Error fetching analytics data:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  async getTreasuryStatsWithWarnings(): Promise<{
    treasury: {
      totalSupply: number;
      totalSold: number;
      totalRevenue: number;
      totalMinted: number;
      totalIssuedByShops: number;
    };
    adminWallet: {
      address: string;
      onChainBalance: number;
      expectedBalance: number;
      discrepancy: number;
    };
    warnings: {
      hasDiscrepancies: boolean;
      customersWithMissingTokens: number;
      totalMissingTokens: number;
      message: string;
    };
  }> {
    try {
      const adminAddress = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
      
      const [treasuryQuery, discrepancyQuery] = await Promise.all([
        this.pool.query(`
          SELECT 
            COALESCE(SUM(amount), 0) as total_sold,
            COALESCE(SUM(total_cost), 0) as total_revenue
          FROM shop_rcn_purchases
          WHERE status IN ('completed', 'pending')
        `),
        this.pool.query(`
          WITH customer_balances AS (
            SELECT 
              customer_address,
              SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as shop_rewards,
              SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as redeemed,
              SUM(CASE WHEN type = 'mint' AND shop_id IS NULL AND metadata::text LIKE '%admin_manual_transfer%' THEN amount ELSE 0 END) as admin_transfers
            FROM transactions
            WHERE status = 'confirmed'
            AND LOWER(customer_address) != LOWER($1)
            GROUP BY customer_address
            HAVING SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) > 0
          )
          SELECT 
            COUNT(*) as customers_with_positive_balance,
            COALESCE(SUM(GREATEST(shop_rewards - redeemed - admin_transfers, 0)), 0) as total_expected_balance
          FROM customer_balances
          WHERE shop_rewards - redeemed - admin_transfers > 0
        `, [adminAddress])
      ]);

      const treasuryData = treasuryQuery.rows[0];
      const discrepancyData = discrepancyQuery.rows[0];

      const totalPurchasedByShops = parseFloat(treasuryData.total_sold || '0');
      const totalRevenue = parseFloat(treasuryData.total_revenue || '0');
      const hasDiscrepancies = parseInt(discrepancyData.customers_with_positive_balance || '0') > 0;

      return {
        treasury: {
          totalSupply: 0, // Will be set by calling code
          totalSold: totalPurchasedByShops,
          totalRevenue: totalRevenue,
          totalMinted: 0, // Will be set by calling code
          totalIssuedByShops: 0 // Will be set by calling code
        },
        adminWallet: {
          address: adminAddress,
          onChainBalance: 0, // Will be set by calling code
          expectedBalance: 0, // Will be calculated by calling code
          discrepancy: 0 // Will be calculated by calling code
        },
        warnings: {
          hasDiscrepancies,
          customersWithMissingTokens: parseInt(discrepancyData.customers_with_positive_balance || '0'),
          totalMissingTokens: parseFloat(discrepancyData.total_expected_balance || '0'),
          message: hasDiscrepancies 
            ? `${discrepancyData.customers_with_positive_balance} customers may be missing tokens. Check discrepancies tab.`
            : 'All customers have received their tokens on-chain'
        }
      };
    } catch (error) {
      logger.error('Error fetching treasury stats with warnings:', error);
      throw new Error('Failed to fetch treasury stats with warnings');
    }
  }

  async getShopPurchaseDebugInfo(shopId: string): Promise<{
    shop: any;
    purchases: any[];
    summary: {
      totalPurchased: number;
      totalsByStatus: Record<string, number>;
      blockchainBalance: number;
      balanceError: string | null;
      unmintedAmount: number;
    };
  }> {
    try {
      const [purchasesQuery, shopQuery] = await Promise.all([
        this.pool.query(`
          SELECT 
            id,
            shop_id,
            amount,
            total_cost,
            status,
            payment_method,
            payment_reference,
            created_at
          FROM shop_rcn_purchases
          WHERE shop_id = $1
          ORDER BY created_at DESC
        `, [shopId]),
        this.pool.query(`
          SELECT 
            shop_id,
            name,
            wallet_address,
            active,
            verified,
            purchased_rcn_balance,
            operational_status
          FROM shops
          WHERE shop_id = $1
        `, [shopId])
      ]);

      const shop = shopQuery.rows[0] || null;
      const purchases = purchasesQuery.rows;

      // Calculate totals by status
      const totalsByStatus: Record<string, number> = {};
      let totalPurchased = 0;

      purchases.forEach((p: any) => {
        const status = p.status || 'unknown';
        const amount = parseFloat(p.amount || '0');
        totalsByStatus[status] = (totalsByStatus[status] || 0) + amount;
        totalPurchased += amount;
      });

      return {
        shop,
        purchases,
        summary: {
          totalPurchased,
          totalsByStatus,
          blockchainBalance: 0, // Will be set by calling code
          balanceError: null, // Will be set by calling code
          unmintedAmount: (totalsByStatus['completed'] || 0) + (totalsByStatus['pending'] || 0) // Base calculation
        }
      };
    } catch (error) {
      logger.error('Error fetching shop purchase debug info:', error);
      throw new Error('Failed to fetch shop purchase debug info');
    }
  }
}