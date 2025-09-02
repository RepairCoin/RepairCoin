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
          WHERE status = 'completed'
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
        totalSupply: parseFloat(row.total_supply),
        circulatingSupply: parseFloat(row.circulating_supply),
        availableSupply: parseFloat(row.available_supply),
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
        WHERE status = 'completed'
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
}