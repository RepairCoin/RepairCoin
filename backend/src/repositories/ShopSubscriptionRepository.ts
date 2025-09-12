import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ShopSubscription {
  id?: number;
  shopId: string;
  status: 'pending' | 'active' | 'cancelled' | 'paused' | 'defaulted';
  monthlyAmount: number;
  subscriptionType: 'standard' | 'premium' | 'custom';
  billingMethod?: 'credit_card' | 'ach' | 'wire';
  billingReference?: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: Date;
  lastPaymentDate?: Date;
  isActive: boolean;
  enrolledAt: Date;
  activatedAt?: Date;
  cancelledAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  cancellationReason?: string;
  notes?: string;
  createdBy?: string;
}

export class ShopSubscriptionRepository extends BaseRepository {
  
  async createSubscription(subscription: Omit<ShopSubscription, 'id' | 'enrolledAt' | 'isActive'>): Promise<ShopSubscription> {
    try {
      const query = `
        INSERT INTO shop_subscriptions (
          shop_id, status, monthly_amount, subscription_type,
          billing_method, billing_reference, payments_made, total_paid,
          next_payment_date, created_by, notes, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        subscription.shopId,
        subscription.status || 'pending',
        subscription.monthlyAmount || 500,
        subscription.subscriptionType || 'standard',
        subscription.billingMethod,
        subscription.billingReference,
        subscription.paymentsMade || 0,
        subscription.totalPaid || 0,
        subscription.nextPaymentDate,
        subscription.createdBy,
        subscription.notes,
        true // is_active defaults to true
      ]);
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  async getActiveSubscriptionByShopId(shopId: string): Promise<ShopSubscription | null> {
    try {
      const query = `
        SELECT * FROM shop_subscriptions 
        WHERE shop_id = $1 AND status = 'active' AND is_active = true
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [shopId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting active subscription:', error);
      throw error;
    }
  }

  async getSubscriptionById(id: number): Promise<ShopSubscription | null> {
    try {
      const query = 'SELECT * FROM shop_subscriptions WHERE id = $1';
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting subscription by id:', error);
      throw error;
    }
  }

  async updateSubscriptionStatus(
    id: number, 
    status: 'active' | 'cancelled' | 'paused' | 'defaulted',
    additionalData?: {
      activatedAt?: Date;
      cancelledAt?: Date;
      pausedAt?: Date;
      resumedAt?: Date;
      cancellationReason?: string;
      isActive?: boolean;
    }
  ): Promise<ShopSubscription> {
    try {
      let query = 'UPDATE shop_subscriptions SET status = $1';
      const params: any[] = [status];
      let paramIndex = 2;
      
      // Handle is_active based on status
      if (status === 'cancelled' || status === 'defaulted') {
        query += `, is_active = false`;
      } else if (status === 'active') {
        query += `, is_active = true`;
      }
      
      if (additionalData) {
        if (additionalData.activatedAt) {
          query += `, activated_at = $${paramIndex}`;
          params.push(additionalData.activatedAt);
          paramIndex++;
        }
        if (additionalData.cancelledAt) {
          query += `, cancelled_at = $${paramIndex}`;
          params.push(additionalData.cancelledAt);
          paramIndex++;
        }
        if (additionalData.pausedAt) {
          query += `, paused_at = $${paramIndex}`;
          params.push(additionalData.pausedAt);
          paramIndex++;
        }
        if (additionalData.resumedAt) {
          query += `, resumed_at = $${paramIndex}`;
          params.push(additionalData.resumedAt);
          paramIndex++;
        }
        if (additionalData.cancellationReason) {
          query += `, cancellation_reason = $${paramIndex}`;
          params.push(additionalData.cancellationReason);
          paramIndex++;
        }
        if (additionalData.isActive !== undefined) {
          query += `, is_active = $${paramIndex}`;
          params.push(additionalData.isActive);
          paramIndex++;
        }
      }
      
      query += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(id);
      
      const result = await this.pool.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error updating subscription status:', error);
      throw error;
    }
  }

  async cancelSubscription(id: number, reason?: string): Promise<ShopSubscription> {
    return this.updateSubscriptionStatus(id, 'cancelled', {
      cancelledAt: new Date(),
      cancellationReason: reason || 'Cancelled by shop',
      isActive: false
    });
  }

  async pauseSubscription(id: number): Promise<ShopSubscription> {
    return this.updateSubscriptionStatus(id, 'paused', {
      pausedAt: new Date(),
      isActive: false
    });
  }

  async resumeSubscription(id: number): Promise<ShopSubscription> {
    return this.updateSubscriptionStatus(id, 'active', {
      resumedAt: new Date(),
      isActive: true
    });
  }

  async recordPayment(subscriptionId: number, amount: number, paymentDate: Date = new Date()): Promise<void> {
    try {
      const query = `
        UPDATE shop_subscriptions 
        SET payments_made = payments_made + 1,
            total_paid = total_paid + $1,
            last_payment_date = $2,
            next_payment_date = $2 + INTERVAL '1 month'
        WHERE id = $3
      `;
      
      await this.pool.query(query, [amount, paymentDate, subscriptionId]);
    } catch (error) {
      logger.error('Error recording subscription payment:', error);
      throw error;
    }
  }

  async getPendingSubscriptions(): Promise<ShopSubscription[]> {
    try {
      const query = `
        SELECT * FROM shop_subscriptions 
        WHERE status = 'pending'
        ORDER BY enrolled_at DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting pending subscriptions:', error);
      throw error;
    }
  }

  async getActiveSubscriptions(): Promise<ShopSubscription[]> {
    try {
      const query = `
        SELECT * FROM shop_subscriptions 
        WHERE status = 'active' AND is_active = true
        ORDER BY next_payment_date ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting active subscriptions:', error);
      throw error;
    }
  }

  async getOverduePayments(): Promise<ShopSubscription[]> {
    try {
      const query = `
        SELECT * FROM shop_subscriptions 
        WHERE status = 'active' 
        AND is_active = true
        AND next_payment_date < CURRENT_DATE
        ORDER BY next_payment_date ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting overdue payments:', error);
      throw error;
    }
  }

  // Check if shop can create subscription (no active subscription, no RCG)
  async canShopSubscribe(shopId: string): Promise<{ canSubscribe: boolean; reason?: string }> {
    try {
      // Check for active subscription
      const activeSubscription = await this.getActiveSubscriptionByShopId(shopId);
      if (activeSubscription) {
        return { canSubscribe: false, reason: 'Shop already has an active subscription' };
      }
      
      // Check RCG balance
      const shopQuery = 'SELECT rcg_balance FROM shops WHERE shop_id = $1';
      const shopResult = await this.pool.query(shopQuery, [shopId]);
      
      if (shopResult.rows.length > 0) {
        const rcgBalance = parseFloat(shopResult.rows[0].rcg_balance || '0');
        if (rcgBalance >= 10000) {
          return { 
            canSubscribe: false, 
            reason: 'Shop already qualified with RCG tokens. No subscription needed.' 
          };
        }
      }
      
      return { canSubscribe: true };
    } catch (error) {
      logger.error('Error checking subscription eligibility:', error);
      throw error;
    }
  }

  // Get subscription history for a shop
  async getShopSubscriptionHistory(shopId: string): Promise<ShopSubscription[]> {
    try {
      const query = `
        SELECT * FROM shop_subscriptions 
        WHERE shop_id = $1
        ORDER BY enrolled_at DESC
      `;
      
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting shop subscription history:', error);
      throw error;
    }
  }

  // Mark subscription as defaulted after missed payments
  async markAsDefaulted(subscriptionId: number, missedPayments: number): Promise<ShopSubscription> {
    try {
      return await this.updateSubscriptionStatus(subscriptionId, 'defaulted', {
        cancelledAt: new Date(),
        cancellationReason: `Defaulted after ${missedPayments} missed payments`,
        isActive: false
      });
    } catch (error) {
      logger.error('Error marking subscription as defaulted:', error);
      throw error;
    }
  }

  // Check for overdue subscriptions and default them (for cron job)
  async checkAndDefaultOverdueSubscriptions(gracePeriodDays: number = 7): Promise<number> {
    try {
      const query = `
        UPDATE shop_subscriptions 
        SET status = 'defaulted',
            is_active = false,
            cancelled_at = NOW(),
            cancellation_reason = 'Auto-defaulted due to overdue payments'
        WHERE status = 'active'
        AND is_active = true
        AND next_payment_date < CURRENT_DATE - INTERVAL '${gracePeriodDays} days'
        RETURNING id
      `;
      
      const result = await this.pool.query(query);
      
      // Update shop operational status for defaulted subscriptions
      if (result.rows.length > 0) {
        const defaultedIds = result.rows.map(r => r.id);
        await this.updateShopOperationalStatusForDefaulted(defaultedIds);
      }
      
      return result.rows.length;
    } catch (error) {
      logger.error('Error checking overdue subscriptions:', error);
      throw error;
    }
  }

  // Helper to update shop operational status
  private async updateShopOperationalStatusForDefaulted(subscriptionIds: number[]): Promise<void> {
    const query = `
      UPDATE shops 
      SET commitment_enrolled = false,
          operational_status = CASE 
            WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
            ELSE 'not_qualified'
          END
      WHERE shop_id IN (
        SELECT shop_id FROM shop_subscriptions WHERE id = ANY($1)
      )
    `;
    
    await this.pool.query(query, [subscriptionIds]);
  }

  protected mapSnakeToCamel(row: any): ShopSubscription {
    return {
      id: row.id,
      shopId: row.shop_id,
      status: row.status,
      monthlyAmount: parseFloat(row.monthly_amount),
      subscriptionType: row.subscription_type,
      billingMethod: row.billing_method,
      billingReference: row.billing_reference,
      paymentsMade: row.payments_made,
      totalPaid: parseFloat(row.total_paid),
      nextPaymentDate: row.next_payment_date,
      lastPaymentDate: row.last_payment_date,
      isActive: row.is_active,
      enrolledAt: row.enrolled_at,
      activatedAt: row.activated_at,
      cancelledAt: row.cancelled_at,
      pausedAt: row.paused_at,
      resumedAt: row.resumed_at,
      cancellationReason: row.cancellation_reason,
      notes: row.notes,
      createdBy: row.created_by
    };
  }
}