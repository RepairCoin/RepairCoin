import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface Referral {
  id: string;
  referralCode: string;
  referrerAddress: string;
  refereeAddress?: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  rewardTransactionId?: string;
  metadata?: any;
}

export interface RcnSource {
  id: number;
  customerAddress: string;
  sourceType: 'shop_repair' | 'referral_bonus' | 'tier_bonus' | 'promotion' | 'market_purchase';
  sourceShopId?: string;
  amount: number;
  transactionId?: string;
  transactionHash?: string;
  earnedAt: string;
  isRedeemable: boolean;
  metadata?: any;
}

export interface ReferralStats {
  referrerAddress: string;
  referrerName?: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarnedRcn: number;
  lastReferralDate?: string;
}

export class ReferralRepository extends BaseRepository {
  async createReferral(referrerAddress: string): Promise<Referral> {
    try {
      const query = `
        INSERT INTO referrals (
          referral_code, 
          referrer_address, 
          status, 
          expires_at
        ) VALUES (
          generate_referral_code(), 
          $1, 
          'pending', 
          CURRENT_TIMESTAMP + INTERVAL '30 days'
        )
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [referrerAddress]);
      const row = result.rows[0];
      
      return this.mapReferralFromDb(row);
    } catch (error) {
      logger.error('Error creating referral:', error);
      throw new Error('Failed to create referral');
    }
  }

  async getReferralByCode(code: string): Promise<Referral | null> {
    try {
      const query = `
        SELECT * FROM referrals 
        WHERE referral_code = $1 
        AND status = 'pending' 
        AND expires_at > CURRENT_TIMESTAMP
      `;
      
      const result = await this.pool.query(query, [code]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapReferralFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error getting referral by code:', error);
      throw new Error('Failed to get referral');
    }
  }

  async getReferralByReferrer(referrerAddress: string): Promise<Referral | null> {
    try {
      const query = `
        SELECT * FROM referrals 
        WHERE referrer_address = $1 
        AND status = 'pending' 
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [referrerAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapReferralFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error getting referral by referrer:', error);
      throw new Error('Failed to get referral');
    }
  }

  async completeReferral(
    referralCode: string, 
    refereeAddress: string,
    rewardTransactionId: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE referrals 
        SET referee_address = $1, 
            status = 'completed', 
            completed_at = CURRENT_TIMESTAMP,
            reward_transaction_id = $2
        WHERE referral_code = $3 
        AND status = 'pending'
      `;
      
      await this.pool.query(query, [
        refereeAddress, 
        rewardTransactionId, 
        referralCode
      ]);
      
      logger.info('Referral completed', { 
        referralCode, 
        refereeAddress, 
        rewardTransactionId 
      });
    } catch (error) {
      logger.error('Error completing referral:', error);
      throw new Error('Failed to complete referral');
    }
  }

  async getCustomerReferrals(customerAddress: string): Promise<Referral[]> {
    try {
      const query = `
        SELECT * FROM referrals 
        WHERE referrer_address = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [customerAddress]);
      
      return result.rows.map(row => this.mapReferralFromDb(row));
    } catch (error) {
      logger.error('Error getting customer referrals:', error);
      throw new Error('Failed to get customer referrals');
    }
  }

  async getReferralStats(limit: number = 10): Promise<ReferralStats[]> {
    try {
      const query = `
        SELECT * FROM referral_stats 
        ORDER BY successful_referrals DESC, total_earned_rcn DESC 
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        referrerAddress: row.referrer_address,
        referrerName: row.referrer_name,
        totalReferrals: parseInt(row.total_referrals),
        successfulReferrals: parseInt(row.successful_referrals),
        totalEarnedRcn: parseFloat(row.total_earned_rcn),
        lastReferralDate: row.last_referral_date
      }));
    } catch (error) {
      logger.error('Error getting referral stats:', error);
      throw new Error('Failed to get referral stats');
    }
  }

  async recordRcnSource(source: Omit<RcnSource, 'id' | 'earnedAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO customer_rcn_sources (
          customer_address, source_type, source_shop_id,
          amount, transaction_id, transaction_hash,
          is_redeemable, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await this.pool.query(query, [
        source.customerAddress,
        source.sourceType,
        source.sourceShopId,
        source.amount,
        source.transactionId,
        source.transactionHash,
        source.isRedeemable,
        JSON.stringify(source.metadata || {})
      ]);
      
      logger.info('RCN source recorded', {
        customerAddress: source.customerAddress,
        sourceType: source.sourceType,
        amount: source.amount
      });
    } catch (error) {
      logger.error('Error recording RCN source:', error);
      throw new Error('Failed to record RCN source');
    }
  }

  async getCustomerRcnSources(
    customerAddress: string,
    redeemableOnly: boolean = false
  ): Promise<RcnSource[]> {
    try {
      let query = `
        SELECT * FROM customer_rcn_sources 
        WHERE customer_address = $1
      `;
      
      if (redeemableOnly) {
        query += ' AND is_redeemable = true';
      }
      
      query += ' ORDER BY earned_at DESC';
      
      const result = await this.pool.query(query, [customerAddress]);
      
      return result.rows.map(row => ({
        id: row.id,
        customerAddress: row.customer_address,
        sourceType: row.source_type,
        sourceShopId: row.source_shop_id,
        amount: parseFloat(row.amount),
        transactionId: row.transaction_id,
        transactionHash: row.transaction_hash,
        earnedAt: row.earned_at,
        isRedeemable: row.is_redeemable,
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error('Error getting customer RCN sources:', error);
      throw new Error('Failed to get customer RCN sources');
    }
  }

  async getCustomerRcnBySource(customerAddress: string): Promise<{
    earned: number;
    marketBought: number;
    byShop: { [shopId: string]: number };
    byType: { [type: string]: number };
  }> {
    try {
      const query = `
        SELECT 
          source_type,
          source_shop_id,
          is_redeemable,
          SUM(amount) as total_amount
        FROM customer_rcn_sources
        WHERE customer_address = $1
        GROUP BY source_type, source_shop_id, is_redeemable
      `;
      
      const result = await this.pool.query(query, [customerAddress]);
      
      let earned = 0;
      let marketBought = 0;
      const byShop: { [shopId: string]: number } = {};
      const byType: { [type: string]: number } = {};
      
      result.rows.forEach(row => {
        const amount = parseFloat(row.total_amount);
        
        if (row.is_redeemable) {
          earned += amount;
        } else {
          marketBought += amount;
        }
        
        if (row.source_shop_id) {
          byShop[row.source_shop_id] = (byShop[row.source_shop_id] || 0) + amount;
        }
        
        byType[row.source_type] = (byType[row.source_type] || 0) + amount;
      });
      
      return { earned, marketBought, byShop, byType };
    } catch (error) {
      logger.error('Error getting customer RCN by source:', error);
      throw new Error('Failed to get customer RCN by source');
    }
  }

  async getHomeShop(customerAddress: string): Promise<string | null> {
    try {
      // Get the shop where customer earned the most RCN
      const query = `
        SELECT 
          source_shop_id,
          SUM(amount) as total_earned
        FROM customer_rcn_sources
        WHERE customer_address = $1
        AND source_shop_id IS NOT NULL
        AND is_redeemable = true
        GROUP BY source_shop_id
        ORDER BY total_earned DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [customerAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].source_shop_id;
    } catch (error) {
      logger.error('Error getting home shop:', error);
      throw new Error('Failed to get home shop');
    }
  }

  async updateCustomerHomeShop(customerAddress: string): Promise<void> {
    try {
      const homeShop = await this.getHomeShop(customerAddress);
      
      if (homeShop) {
        const updateQuery = `
          UPDATE customers 
          SET home_shop_id = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE address = $2
        `;
        
        await this.pool.query(updateQuery, [homeShop, customerAddress]);
        
        logger.info('Customer home shop updated', { 
          customerAddress, 
          homeShop 
        });
      }
    } catch (error) {
      logger.error('Error updating customer home shop:', error);
      throw new Error('Failed to update customer home shop');
    }
  }

  private mapReferralFromDb(row: any): Referral {
    return {
      id: row.id,
      referralCode: row.referral_code,
      referrerAddress: row.referrer_address,
      refereeAddress: row.referee_address,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      rewardTransactionId: row.reward_transaction_id,
      metadata: row.metadata
    };
  }
}