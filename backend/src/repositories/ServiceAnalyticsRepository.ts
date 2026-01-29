// backend/src/repositories/ServiceAnalyticsRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ShopServiceMetrics {
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalRcnRedeemed: number;
  totalRcnDiscountUsd: number;
  averageOrderValue: number;
  averageRating: number;
  totalReviews: number;
  totalFavorites: number;
}

export interface ServicePerformance {
  serviceId: string;
  serviceName: string;
  category: string;
  priceUsd: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
  favoriteCount: number;
  rcnRedeemed: number;
  rcnDiscountUsd: number;
  conversionRate: number; // percentage of views that result in orders
}

export interface OrderTrend {
  date: string;
  orderCount: number;
  revenue: number;
  rcnDiscountUsd: number;
}

export interface CategoryPerformance {
  category: string;
  serviceCount: number;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  averagePrice: number;
}

export interface PlatformServiceMetrics {
  totalShopsWithServices: number;
  totalActiveServices: number;
  totalOrders: number;
  totalRevenue: number;
  totalRcnRedeemed: number;
  totalRcnDiscountUsd: number;
  averageServicePrice: number;
  averageOrderValue: number;
  topCategories: CategoryPerformance[];
}

export interface TopPerformingShop {
  shopId: string;
  shopName: string;
  activeServices: number;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
}

export interface BookingAnalytics {
  summary: {
    totalBookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    avgLeadTimeDays: number;
    rescheduledCount: number;
    avgRescheduleCount: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  busiestDays: Array<{ dayOfWeek: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  bookingTrends: Array<{ date: string; count: number }>;
}

export class ServiceAnalyticsRepository extends BaseRepository {

  /**
   * Get overall metrics for a specific shop's services
   */
  async getShopMetrics(shopId: string): Promise<ShopServiceMetrics> {
    try {
      const query = `
        WITH service_stats AS (
          SELECT
            COUNT(*) as total_services,
            SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_services,
            SUM(CASE WHEN active = false THEN 1 ELSE 0 END) as inactive_services,
            COALESCE(AVG(average_rating), 0) as avg_rating,
            COALESCE(SUM(review_count), 0) as total_reviews,
            (SELECT COUNT(*) FROM service_favorites sf WHERE sf.service_id IN (
              SELECT service_id FROM shop_services WHERE shop_id = $1
            )) as total_favorites
          FROM shop_services
          WHERE shop_id = $1
        ),
        order_stats AS (
          SELECT
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_redeemed ELSE 0 END), 0) as total_rcn_redeemed,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_discount_usd ELSE 0 END), 0) as total_rcn_discount,
            COALESCE(AVG(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE NULL END), 0) as avg_order_value
          FROM service_orders
          WHERE shop_id = $1
        )
        SELECT
          ss.total_services,
          ss.active_services,
          ss.inactive_services,
          os.total_orders,
          os.completed_orders,
          os.total_revenue,
          os.total_rcn_redeemed,
          os.total_rcn_discount,
          os.avg_order_value,
          ss.avg_rating,
          ss.total_reviews,
          ss.total_favorites
        FROM service_stats ss
        CROSS JOIN order_stats os
      `;

      const result = await this.pool.query(query, [shopId]);

      if (result.rows.length === 0) {
        return {
          totalServices: 0,
          activeServices: 0,
          inactiveServices: 0,
          totalOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
          totalRcnRedeemed: 0,
          totalRcnDiscountUsd: 0,
          averageOrderValue: 0,
          averageRating: 0,
          totalReviews: 0,
          totalFavorites: 0
        };
      }

      const row = result.rows[0];
      return {
        totalServices: parseInt(row.total_services) || 0,
        activeServices: parseInt(row.active_services) || 0,
        inactiveServices: parseInt(row.inactive_services) || 0,
        totalOrders: parseInt(row.total_orders) || 0,
        completedOrders: parseInt(row.completed_orders) || 0,
        totalRevenue: parseFloat(row.total_revenue) || 0,
        totalRcnRedeemed: parseFloat(row.total_rcn_redeemed) || 0,
        totalRcnDiscountUsd: parseFloat(row.total_rcn_discount) || 0,
        averageOrderValue: parseFloat(row.avg_order_value) || 0,
        averageRating: parseFloat(row.avg_rating) || 0,
        totalReviews: parseInt(row.total_reviews) || 0,
        totalFavorites: parseInt(row.total_favorites) || 0
      };
    } catch (error) {
      logger.error('Error getting shop metrics:', error);
      throw new Error('Failed to get shop metrics');
    }
  }

  /**
   * Get performance metrics for individual services
   */
  async getServicePerformance(shopId: string, limit: number = 10): Promise<ServicePerformance[]> {
    try {
      const query = `
        SELECT
          s.service_id,
          s.service_name,
          s.category,
          s.price_usd,
          COALESCE(COUNT(DISTINCT o.order_id), 0) as total_orders,
          COALESCE(SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_orders,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(s.average_rating, 0) as average_rating,
          COALESCE(s.review_count, 0) as review_count,
          COALESCE(COUNT(DISTINCT f.customer_address), 0) as favorite_count,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.rcn_redeemed ELSE 0 END), 0) as rcn_redeemed,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.rcn_discount_usd ELSE 0 END), 0) as rcn_discount_usd,
          CASE
            WHEN COUNT(DISTINCT o.order_id) > 0 AND COUNT(DISTINCT f.customer_address) > 0
            THEN (COUNT(DISTINCT o.order_id)::float / COUNT(DISTINCT f.customer_address)) * 100
            ELSE 0
          END as conversion_rate
        FROM shop_services s
        LEFT JOIN service_orders o ON s.service_id = o.service_id
        LEFT JOIN service_favorites f ON s.service_id = f.service_id
        WHERE s.shop_id = $1
        GROUP BY s.service_id, s.service_name, s.category, s.price_usd, s.average_rating, s.review_count
        ORDER BY total_revenue DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [shopId, limit]);

      return result.rows.map(row => ({
        serviceId: row.service_id,
        serviceName: row.service_name,
        category: row.category,
        priceUsd: parseFloat(row.price_usd),
        totalOrders: parseInt(row.total_orders),
        completedOrders: parseInt(row.completed_orders),
        totalRevenue: parseFloat(row.total_revenue),
        averageRating: parseFloat(row.average_rating),
        reviewCount: parseInt(row.review_count),
        favoriteCount: parseInt(row.favorite_count),
        rcnRedeemed: parseFloat(row.rcn_redeemed),
        rcnDiscountUsd: parseFloat(row.rcn_discount_usd),
        conversionRate: parseFloat(row.conversion_rate)
      }));
    } catch (error) {
      logger.error('Error getting service performance:', error);
      throw new Error('Failed to get service performance');
    }
  }

  /**
   * Get order trends over time (daily aggregation)
   */
  async getOrderTrends(shopId: string, days: number = 30): Promise<OrderTrend[]> {
    try {
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE 0 END), 0) as revenue,
          COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_discount_usd ELSE 0 END), 0) as rcn_discount_usd
        FROM service_orders
        WHERE shop_id = $1
          AND created_at >= NOW() - INTERVAL '1 day' * $2
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const result = await this.pool.query(query, [shopId, days]);

      return result.rows.map(row => ({
        date: row.date,
        orderCount: parseInt(row.order_count),
        revenue: parseFloat(row.revenue),
        rcnDiscountUsd: parseFloat(row.rcn_discount_usd)
      }));
    } catch (error) {
      logger.error('Error getting order trends:', error);
      throw new Error('Failed to get order trends');
    }
  }

  /**
   * Get category performance for a shop
   */
  async getShopCategoryPerformance(shopId: string): Promise<CategoryPerformance[]> {
    try {
      const query = `
        SELECT
          s.category,
          COUNT(DISTINCT s.service_id) as service_count,
          COALESCE(COUNT(DISTINCT o.order_id), 0) as total_orders,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(AVG(s.average_rating), 0) as average_rating,
          COALESCE(AVG(s.price_usd), 0) as average_price
        FROM shop_services s
        LEFT JOIN service_orders o ON s.service_id = o.service_id
        WHERE s.shop_id = $1
        GROUP BY s.category
        ORDER BY total_revenue DESC
      `;

      const result = await this.pool.query(query, [shopId]);

      return result.rows.map(row => ({
        category: row.category,
        serviceCount: parseInt(row.service_count),
        totalOrders: parseInt(row.total_orders),
        totalRevenue: parseFloat(row.total_revenue),
        averageRating: parseFloat(row.average_rating),
        averagePrice: parseFloat(row.average_price)
      }));
    } catch (error) {
      logger.error('Error getting shop category performance:', error);
      throw new Error('Failed to get shop category performance');
    }
  }

  /**
   * Get platform-wide service metrics (Admin only)
   */
  async getPlatformMetrics(): Promise<PlatformServiceMetrics> {
    try {
      const metricsQuery = `
        WITH service_stats AS (
          SELECT
            COUNT(DISTINCT shop_id) as shops_with_services,
            COUNT(*) FILTER (WHERE active = true) as active_services,
            COALESCE(AVG(price_usd), 0) as avg_service_price
          FROM shop_services
        ),
        order_stats AS (
          SELECT
            COUNT(*) as total_orders,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_redeemed ELSE 0 END), 0) as total_rcn_redeemed,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_discount_usd ELSE 0 END), 0) as total_rcn_discount,
            COALESCE(AVG(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE NULL END), 0) as avg_order_value
          FROM service_orders
        )
        SELECT
          ss.shops_with_services,
          ss.active_services,
          os.total_orders,
          os.total_revenue,
          os.total_rcn_redeemed,
          os.total_rcn_discount,
          ss.avg_service_price,
          os.avg_order_value
        FROM service_stats ss
        CROSS JOIN order_stats os
      `;

      const result = await this.pool.query(metricsQuery);
      const row = result.rows[0];

      const topCategories = await this.getPlatformCategoryPerformance(5);

      return {
        totalShopsWithServices: parseInt(row.shops_with_services) || 0,
        totalActiveServices: parseInt(row.active_services) || 0,
        totalOrders: parseInt(row.total_orders) || 0,
        totalRevenue: parseFloat(row.total_revenue) || 0,
        totalRcnRedeemed: parseFloat(row.total_rcn_redeemed) || 0,
        totalRcnDiscountUsd: parseFloat(row.total_rcn_discount) || 0,
        averageServicePrice: parseFloat(row.avg_service_price) || 0,
        averageOrderValue: parseFloat(row.avg_order_value) || 0,
        topCategories
      };
    } catch (error) {
      logger.error('Error getting platform metrics:', error);
      throw new Error('Failed to get platform metrics');
    }
  }

  /**
   * Get platform-wide category performance
   */
  async getPlatformCategoryPerformance(limit: number = 10): Promise<CategoryPerformance[]> {
    try {
      const query = `
        SELECT
          s.category,
          COUNT(DISTINCT s.service_id) as service_count,
          COALESCE(COUNT(DISTINCT o.order_id), 0) as total_orders,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(AVG(s.average_rating), 0) as average_rating,
          COALESCE(AVG(s.price_usd), 0) as average_price
        FROM shop_services s
        LEFT JOIN service_orders o ON s.service_id = o.service_id
        WHERE s.active = true
        GROUP BY s.category
        ORDER BY total_revenue DESC
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);

      return result.rows.map(row => ({
        category: row.category,
        serviceCount: parseInt(row.service_count),
        totalOrders: parseInt(row.total_orders),
        totalRevenue: parseFloat(row.total_revenue),
        averageRating: parseFloat(row.average_rating),
        averagePrice: parseFloat(row.average_price)
      }));
    } catch (error) {
      logger.error('Error getting platform category performance:', error);
      throw new Error('Failed to get platform category performance');
    }
  }

  /**
   * Get top performing shops in the marketplace
   */
  async getTopPerformingShops(limit: number = 10): Promise<TopPerformingShop[]> {
    try {
      const query = `
        SELECT
          s.shop_id,
          sh.name as shop_name,
          COUNT(DISTINCT s.service_id) FILTER (WHERE s.active = true) as active_services,
          COALESCE(COUNT(DISTINCT o.order_id), 0) as total_orders,
          COALESCE(SUM(CASE WHEN o.status IN ('paid', 'completed') THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(AVG(s.average_rating), 0) as average_rating
        FROM shop_services s
        INNER JOIN shops sh ON s.shop_id = sh.shop_id
        LEFT JOIN service_orders o ON s.service_id = o.service_id
        WHERE sh.active = true
        GROUP BY s.shop_id, sh.name
        HAVING COUNT(DISTINCT s.service_id) FILTER (WHERE s.active = true) > 0
        ORDER BY total_revenue DESC
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);

      return result.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        activeServices: parseInt(row.active_services),
        totalOrders: parseInt(row.total_orders),
        totalRevenue: parseFloat(row.total_revenue),
        averageRating: parseFloat(row.average_rating)
      }));
    } catch (error) {
      logger.error('Error getting top performing shops:', error);
      throw new Error('Failed to get top performing shops');
    }
  }

  /**
   * Get order trends for platform (Admin only)
   */
  async getPlatformOrderTrends(days: number = 30): Promise<OrderTrend[]> {
    try {
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE 0 END), 0) as revenue,
          COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN rcn_discount_usd ELSE 0 END), 0) as rcn_discount_usd
        FROM service_orders
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const result = await this.pool.query(query, [days]);

      return result.rows.map(row => ({
        date: row.date,
        orderCount: parseInt(row.order_count),
        revenue: parseFloat(row.revenue),
        rcnDiscountUsd: parseFloat(row.rcn_discount_usd)
      }));
    } catch (error) {
      logger.error('Error getting platform order trends:', error);
      throw new Error('Failed to get platform order trends');
    }
  }

  /**
   * Get group performance analytics for a shop
   */
  async getGroupPerformanceAnalytics(shopId: string): Promise<{
    summary: {
      totalServicesLinked: number;
      totalGroupsActive: number;
      totalGroupTokensIssued: number;
      totalBookingsFromGroups: number;
    };
    groupBreakdown: Array<{
      groupId: string;
      groupName: string;
      customTokenSymbol: string;
      icon: string;
      servicesLinked: number;
      totalBookings: number;
      totalRevenue: number;
      tokensIssued: number;
      conversionRate: number;
    }>;
    servicesLinked: Array<{
      serviceId: string;
      serviceName: string;
      groups: Array<{
        groupId: string;
        groupName: string;
        customTokenSymbol: string;
        tokenRewardPercentage: number;
        bonusMultiplier: number;
      }>;
      bookings: number;
      revenue: number;
    }>;
  }> {
    try {
      // Get summary statistics
      const summaryQuery = `
        SELECT
          COUNT(DISTINCT sga.service_id) as total_services_linked,
          COUNT(DISTINCT sga.group_id) as total_groups_active,
          COALESCE(SUM(
            CASE
              WHEN so.status IN ('paid', 'completed') THEN
                (so.total_amount * (sga.token_reward_percentage / 100) * sga.bonus_multiplier)
              ELSE 0
            END
          ), 0) as total_group_tokens_issued,
          COUNT(DISTINCT so.order_id) as total_bookings_from_groups
        FROM service_group_availability sga
        INNER JOIN shop_services s ON sga.service_id = s.service_id
        LEFT JOIN service_orders so ON s.service_id = so.service_id
        WHERE s.shop_id = $1 AND sga.active = true
      `;

      const summaryResult = await this.pool.query(summaryQuery, [shopId]);
      const summary = summaryResult.rows[0];

      // Get group breakdown
      const groupQuery = `
        SELECT
          asg.group_id,
          asg.group_name,
          asg.custom_token_symbol,
          asg.icon,
          COUNT(DISTINCT sga.service_id) as services_linked,
          COUNT(DISTINCT so.order_id) as total_bookings,
          COALESCE(SUM(CASE WHEN so.status IN ('paid', 'completed') THEN so.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(
            CASE
              WHEN so.status IN ('paid', 'completed') THEN
                (so.total_amount * (sga.token_reward_percentage / 100) * sga.bonus_multiplier)
              ELSE 0
            END
          ), 0) as tokens_issued
        FROM affiliate_shop_groups asg
        INNER JOIN service_group_availability sga ON asg.group_id = sga.group_id
        INNER JOIN shop_services s ON sga.service_id = s.service_id
        LEFT JOIN service_orders so ON s.service_id = so.service_id
        WHERE s.shop_id = $1 AND sga.active = true
        GROUP BY asg.group_id, asg.group_name, asg.custom_token_symbol, asg.icon
        ORDER BY total_bookings DESC, total_revenue DESC
      `;

      const groupResult = await this.pool.query(groupQuery, [shopId]);

      // Get services linked to groups
      const servicesQuery = `
        SELECT
          s.service_id,
          s.service_name,
          json_agg(json_build_object(
            'groupId', asg.group_id,
            'groupName', asg.group_name,
            'customTokenSymbol', asg.custom_token_symbol,
            'tokenRewardPercentage', sga.token_reward_percentage,
            'bonusMultiplier', sga.bonus_multiplier
          )) as groups,
          COUNT(DISTINCT so.order_id) as bookings,
          COALESCE(SUM(CASE WHEN so.status IN ('paid', 'completed') THEN so.total_amount ELSE 0 END), 0) as revenue
        FROM shop_services s
        INNER JOIN service_group_availability sga ON s.service_id = sga.service_id
        INNER JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
        LEFT JOIN service_orders so ON s.service_id = so.service_id
        WHERE s.shop_id = $1 AND sga.active = true
        GROUP BY s.service_id, s.service_name
        ORDER BY bookings DESC, revenue DESC
      `;

      const servicesResult = await this.pool.query(servicesQuery, [shopId]);

      return {
        summary: {
          totalServicesLinked: parseInt(summary.total_services_linked) || 0,
          totalGroupsActive: parseInt(summary.total_groups_active) || 0,
          totalGroupTokensIssued: parseFloat(summary.total_group_tokens_issued) || 0,
          totalBookingsFromGroups: parseInt(summary.total_bookings_from_groups) || 0
        },
        groupBreakdown: groupResult.rows.map(row => ({
          groupId: row.group_id,
          groupName: row.group_name,
          customTokenSymbol: row.custom_token_symbol,
          icon: row.icon || '🎁',
          servicesLinked: parseInt(row.services_linked),
          totalBookings: parseInt(row.total_bookings),
          totalRevenue: parseFloat(row.total_revenue),
          tokensIssued: parseFloat(row.tokens_issued),
          conversionRate: parseInt(row.services_linked) > 0
            ? (parseInt(row.total_bookings) / parseInt(row.services_linked)) * 100
            : 0
        })),
        servicesLinked: servicesResult.rows.map(row => ({
          serviceId: row.service_id,
          serviceName: row.service_name,
          groups: row.groups || [],
          bookings: parseInt(row.bookings),
          revenue: parseFloat(row.revenue)
        }))
      };
    } catch (error) {
      logger.error('Error getting group performance analytics:', error);
      throw new Error('Failed to get group performance analytics');
    }
  }

  /**
   * Get booking analytics for a shop
   */
  async getBookingAnalytics(shopId: string, trendDays: number): Promise<BookingAnalytics> {
    try {
      const safeTrendDays = Math.max(1, Math.min(Math.floor(Number(trendDays) || 30), 365));

      // Run all queries in parallel
      const [statusResult, busiestDaysResult, peakHoursResult, cancellationResult, trendsResult, summaryResult] = await Promise.all([
        // a) Status breakdown
        this.pool.query(
          `SELECT status, COUNT(*)::int as count FROM service_orders WHERE shop_id = $1 AND booking_date IS NOT NULL GROUP BY status`,
          [shopId]
        ),
        // b) Busiest days
        this.pool.query(
          `SELECT EXTRACT(DOW FROM booking_date)::int as day_of_week, COUNT(*)::int as count FROM service_orders WHERE shop_id = $1 AND booking_date IS NOT NULL GROUP BY day_of_week ORDER BY day_of_week`,
          [shopId]
        ),
        // c) Peak hours
        this.pool.query(
          `SELECT EXTRACT(HOUR FROM booking_time_slot::time)::int as hour, COUNT(*)::int as count FROM service_orders WHERE shop_id = $1 AND booking_time_slot IS NOT NULL GROUP BY hour ORDER BY hour`,
          [shopId]
        ),
        // d) Cancellation reasons
        this.pool.query(
          `SELECT COALESCE(cancellation_reason, 'Not specified') as reason, COUNT(*)::int as count FROM service_orders WHERE shop_id = $1 AND status = 'cancelled' AND booking_date IS NOT NULL GROUP BY reason ORDER BY count DESC LIMIT 10`,
          [shopId]
        ),
        // e) Booking trends
        this.pool.query(
          `SELECT booking_date::date as date, COUNT(*)::int as count FROM service_orders WHERE shop_id = $1 AND booking_date IS NOT NULL AND booking_date >= NOW() - INTERVAL '${safeTrendDays} days' GROUP BY date ORDER BY date`,
          [shopId]
        ),
        // f) Summary stats
        this.pool.query(
          `SELECT
            COUNT(*)::int as total_bookings,
            COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
            COUNT(*) FILTER (WHERE status = 'no_show')::int as no_shows,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled,
            AVG(EXTRACT(EPOCH FROM (booking_date - created_at)) / 86400)::float as avg_lead_time_days,
            COUNT(*) FILTER (WHERE reschedule_count > 0)::int as rescheduled_count,
            AVG(reschedule_count) FILTER (WHERE reschedule_count > 0)::float as avg_reschedule_count
          FROM service_orders WHERE shop_id = $1 AND booking_date IS NOT NULL`,
          [shopId]
        )
      ]);

      const s = summaryResult.rows[0];
      const totalBookings = s.total_bookings || 0;

      return {
        summary: {
          totalBookings,
          completed: s.completed || 0,
          noShows: s.no_shows || 0,
          cancelled: s.cancelled || 0,
          completionRate: totalBookings > 0 ? parseFloat(((s.completed / totalBookings) * 100).toFixed(2)) : 0,
          noShowRate: totalBookings > 0 ? parseFloat(((s.no_shows / totalBookings) * 100).toFixed(2)) : 0,
          cancellationRate: totalBookings > 0 ? parseFloat(((s.cancelled / totalBookings) * 100).toFixed(2)) : 0,
          avgLeadTimeDays: parseFloat((s.avg_lead_time_days || 0).toFixed(2)),
          rescheduledCount: s.rescheduled_count || 0,
          avgRescheduleCount: parseFloat((s.avg_reschedule_count || 0).toFixed(2))
        },
        statusBreakdown: statusResult.rows.map(row => ({
          status: row.status,
          count: row.count
        })),
        busiestDays: busiestDaysResult.rows.map(row => ({
          dayOfWeek: row.day_of_week,
          count: row.count
        })),
        peakHours: peakHoursResult.rows.map(row => ({
          hour: row.hour,
          count: row.count
        })),
        cancellationReasons: cancellationResult.rows.map(row => ({
          reason: row.reason,
          count: row.count
        })),
        bookingTrends: trendsResult.rows.map(row => ({
          date: row.date,
          count: row.count
        }))
      };
    } catch (error) {
      logger.error('Error getting booking analytics:', error);
      throw new Error('Failed to get booking analytics');
    }
  }
}
