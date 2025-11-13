// backend/src/domains/admin/services/analytics/MetricsService.ts
import { treasuryRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';

/**
 * MetricsService
 * Handles enhanced analytics and metrics for the admin dashboard
 * Extracted from AdminService for better maintainability
 */
export class MetricsService {
  /**
   * Get comprehensive shop metrics including tier distribution and growth
   */
  async getShopMetrics() {
    try {
      const result = await treasuryRepository.query(`
        SELECT
          COUNT(*) FILTER (WHERE active = true AND verified = true) as active_shops,
          COUNT(*) FILTER (WHERE verified = false) as pending_shops,
          COUNT(*) FILTER (WHERE suspended_at IS NOT NULL) as suspended_shops,
          COUNT(*) as total_shops,
          COALESCE(SUM(total_tokens_issued), 0) as total_tokens_issued_by_shops,
          COALESCE(SUM(total_redemptions), 0) as total_redemptions_by_shops,
          COALESCE(SUM(purchased_rcn_balance), 0) as total_rcn_purchased,
          COALESCE(AVG(total_tokens_issued), 0) as avg_tokens_per_shop,
          COUNT(*) FILTER (WHERE rcg_tier = 'standard') as standard_tier_shops,
          COUNT(*) FILTER (WHERE rcg_tier = 'premium') as premium_tier_shops,
          COUNT(*) FILTER (WHERE rcg_tier = 'elite') as elite_tier_shops,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days') as new_shops_last_30_days,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days') as new_shops_last_7_days
        FROM shops
      `);

      const metrics = result.rows[0];

      return {
        activeShops: parseInt(metrics.active_shops || '0'),
        pendingShops: parseInt(metrics.pending_shops || '0'),
        suspendedShops: parseInt(metrics.suspended_shops || '0'),
        totalShops: parseInt(metrics.total_shops || '0'),
        totalTokensIssued: parseFloat(metrics.total_tokens_issued_by_shops || '0'),
        totalRedemptions: parseFloat(metrics.total_redemptions_by_shops || '0'),
        totalRcnPurchased: parseFloat(metrics.total_rcn_purchased || '0'),
        avgTokensPerShop: parseFloat(metrics.avg_tokens_per_shop || '0'),
        tierDistribution: {
          standard: parseInt(metrics.standard_tier_shops || '0'),
          premium: parseInt(metrics.premium_tier_shops || '0'),
          elite: parseInt(metrics.elite_tier_shops || '0')
        },
        growth: {
          last7Days: parseInt(metrics.new_shops_last_7_days || '0'),
          last30Days: parseInt(metrics.new_shops_last_30_days || '0')
        }
      };
    } catch (error) {
      logger.error('Error getting shop metrics:', error);
      throw new Error('Failed to retrieve shop metrics');
    }
  }

  /**
   * Get comprehensive customer metrics including tier distribution, referrals, and activity
   */
  async getCustomerMetrics() {
    try {
      const result = await treasuryRepository.query(`
        SELECT
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE is_active = true) as active_customers,
          COUNT(*) FILTER (WHERE suspended_at IS NOT NULL) as suspended_customers,
          COUNT(*) FILTER (WHERE tier = 'BRONZE') as bronze_customers,
          COUNT(*) FILTER (WHERE tier = 'SILVER') as silver_customers,
          COUNT(*) FILTER (WHERE tier = 'GOLD') as gold_customers,
          COALESCE(SUM(lifetime_earnings), 0) as total_lifetime_earnings,
          COALESCE(SUM(current_rcn_balance), 0) as total_current_balance,
          COALESCE(SUM(total_redemptions), 0) as total_customer_redemptions,
          COALESCE(AVG(lifetime_earnings), 0) as avg_lifetime_earnings,
          COALESCE(AVG(current_rcn_balance), 0) as avg_current_balance,
          COUNT(*) FILTER (WHERE referral_count > 0) as customers_with_referrals,
          COALESCE(SUM(referral_count), 0) as total_referrals,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days') as new_customers_last_30_days,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days') as new_customers_last_7_days,
          COUNT(*) FILTER (WHERE DATE(last_earned_date) >= CURRENT_DATE - INTERVAL '7 days') as active_last_7_days,
          COUNT(*) FILTER (WHERE DATE(last_earned_date) >= CURRENT_DATE - INTERVAL '30 days') as active_last_30_days
        FROM customers
      `);

      const metrics = result.rows[0];

      return {
        totalCustomers: parseInt(metrics.total_customers || '0'),
        activeCustomers: parseInt(metrics.active_customers || '0'),
        suspendedCustomers: parseInt(metrics.suspended_customers || '0'),
        tierDistribution: {
          bronze: parseInt(metrics.bronze_customers || '0'),
          silver: parseInt(metrics.silver_customers || '0'),
          gold: parseInt(metrics.gold_customers || '0')
        },
        totalLifetimeEarnings: parseFloat(metrics.total_lifetime_earnings || '0'),
        totalCurrentBalance: parseFloat(metrics.total_current_balance || '0'),
        totalRedemptions: parseFloat(metrics.total_customer_redemptions || '0'),
        averages: {
          lifetimeEarnings: parseFloat(metrics.avg_lifetime_earnings || '0'),
          currentBalance: parseFloat(metrics.avg_current_balance || '0')
        },
        referrals: {
          customersWithReferrals: parseInt(metrics.customers_with_referrals || '0'),
          totalReferrals: parseInt(metrics.total_referrals || '0')
        },
        growth: {
          newLast7Days: parseInt(metrics.new_customers_last_7_days || '0'),
          newLast30Days: parseInt(metrics.new_customers_last_30_days || '0'),
          activeLast7Days: parseInt(metrics.active_last_7_days || '0'),
          activeLast30Days: parseInt(metrics.active_last_30_days || '0')
        }
      };
    } catch (error) {
      logger.error('Error getting customer metrics:', error);
      throw new Error('Failed to retrieve customer metrics');
    }
  }

  /**
   * Get revenue metrics from RCN sales and subscriptions
   */
  async getRevenueMetrics() {
    try {
      // Get RCN purchase revenue
      const purchaseResult = await treasuryRepository.query(`
        SELECT
          COALESCE(SUM(total_cost), 0) as total_revenue,
          COALESCE(SUM(amount), 0) as total_rcn_sold,
          COUNT(*) as total_purchases,
          COALESCE(SUM(total_cost) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'), 0) as revenue_last_30_days,
          COALESCE(SUM(total_cost) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days'), 0) as revenue_last_7_days,
          COALESCE(SUM(total_cost) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) as revenue_today,
          COALESCE(AVG(total_cost), 0) as avg_purchase_value
        FROM shop_rcn_purchases
        WHERE status = 'completed'
      `);

      // Get subscription revenue (if applicable)
      const subscriptionResult = await treasuryRepository.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
          COUNT(*) FILTER (WHERE status = 'active') * 500 as monthly_recurring_revenue
        FROM shop_subscriptions
        WHERE status = 'active'
      `);

      const purchase = purchaseResult.rows[0];
      const subscription = subscriptionResult.rows[0];

      return {
        rcnSales: {
          totalRevenue: parseFloat(purchase.total_revenue || '0'),
          totalRcnSold: parseFloat(purchase.total_rcn_sold || '0'),
          totalPurchases: parseInt(purchase.total_purchases || '0'),
          avgPurchaseValue: parseFloat(purchase.avg_purchase_value || '0'),
          revenueToday: parseFloat(purchase.revenue_today || '0'),
          revenueLast7Days: parseFloat(purchase.revenue_last_7_days || '0'),
          revenueLast30Days: parseFloat(purchase.revenue_last_30_days || '0')
        },
        subscriptions: {
          activeSubscriptions: parseInt(subscription.active_subscriptions || '0'),
          monthlyRecurringRevenue: parseFloat(subscription.monthly_recurring_revenue || '0')
        },
        totalRevenue: parseFloat(purchase.total_revenue || '0') + parseFloat(subscription.monthly_recurring_revenue || '0')
      };
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      throw new Error('Failed to retrieve revenue metrics');
    }
  }

  /**
   * Get token metrics including circulation, minting, and redemption data
   */
  async getTokenMetrics() {
    try {
      // Get token transaction metrics
      const transactionResult = await treasuryRepository.query(`
        SELECT
          COUNT(*) as total_transactions,
          COUNT(*) FILTER (WHERE type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint')) as mint_transactions,
          COUNT(*) FILTER (WHERE type = 'redeem') as redeem_transactions,
          COALESCE(SUM(amount) FILTER (WHERE type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint')), 0) as total_minted,
          COALESCE(SUM(amount) FILTER (WHERE type = 'redeem'), 0) as total_redeemed,
          COALESCE(SUM(amount) FILTER (WHERE type = 'repair_reward'), 0) as repair_rewards,
          COALESCE(SUM(amount) FILTER (WHERE type = 'referral_reward'), 0) as referral_rewards,
          COALESCE(SUM(amount) FILTER (WHERE type = 'tier_bonus'), 0) as tier_bonuses,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days') as transactions_last_7_days,
          COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days') as transactions_last_30_days,
          COALESCE(SUM(amount) FILTER (WHERE type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint') AND DATE(created_at) = CURRENT_DATE), 0) as minted_today,
          COALESCE(SUM(amount) FILTER (WHERE type = 'redeem' AND DATE(created_at) = CURRENT_DATE), 0) as redeemed_today
        FROM transactions
      `);

      const metrics = transactionResult.rows[0];

      // Calculate circulation (minted - redeemed)
      const totalMinted = parseFloat(metrics.total_minted || '0');
      const totalRedeemed = parseFloat(metrics.total_redeemed || '0');
      const circulation = totalMinted - totalRedeemed;

      return {
        transactions: {
          total: parseInt(metrics.total_transactions || '0'),
          mints: parseInt(metrics.mint_transactions || '0'),
          redemptions: parseInt(metrics.redeem_transactions || '0'),
          last7Days: parseInt(metrics.transactions_last_7_days || '0'),
          last30Days: parseInt(metrics.transactions_last_30_days || '0')
        },
        tokens: {
          totalMinted: totalMinted,
          totalRedeemed: totalRedeemed,
          circulation: circulation,
          mintedToday: parseFloat(metrics.minted_today || '0'),
          redeemedToday: parseFloat(metrics.redeemed_today || '0')
        },
        breakdown: {
          repairRewards: parseFloat(metrics.repair_rewards || '0'),
          referralRewards: parseFloat(metrics.referral_rewards || '0'),
          tierBonuses: parseFloat(metrics.tier_bonuses || '0')
        },
        redemptionRate: totalMinted > 0 ? (totalRedeemed / totalMinted) * 100 : 0
      };
    } catch (error) {
      logger.error('Error getting token metrics:', error);
      throw new Error('Failed to retrieve token metrics');
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
