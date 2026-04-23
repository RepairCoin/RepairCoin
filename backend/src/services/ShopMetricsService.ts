// backend/src/services/ShopMetricsService.ts
import { getSharedPool } from '../utils/database-pool';
import { logger } from '../utils/logger';

export interface DailyStats {
  newBookings: number;
  newBookingsTrend: number;
  revenue: number;
  revenueTrend: number;
  newCustomers: number;
  newCustomersTrend: number;
  completedBookings: number;
  completedTrend: number;
  avgRating: number | null;
  ratingTrend: number;
  noShows: number;
  noShowsTrend: number;
  rcnIssued: number;
  rcnIssuedUsd: number;
  reviewsReceived: number;
  cancellations: number;
}

export interface WeeklyStats {
  bookingsCount: number;
  bookingsTrend: number;
  revenue: number;
  revenueTrend: number;
  completedCount: number;
  completedTrend: number;
  avgRating: number | null;
  ratingTrend: number;
  completionRate: number;
  noShowRate: number;
  cancellationRate: number;
}

export interface ServiceStat {
  name: string;
  bookings: number;
  revenue: number;
  percentage: number;
}

export interface CustomerInsights {
  newCustomers: number;
  repeatCustomers: number;
  satisfactionRate: number;
}

export interface MonthlyStats extends WeeklyStats {
  avgOrderValue: number;
  rcnIssued: number;
  rcnIssuedUsd: number;
  peakDays: string[];
  avgResponseTime: number;
  customerRetention: number;
  retentionTrend: number;
}

export interface CustomerStat {
  name: string;
  visits: number;
  totalSpent: number;
}

export interface WeeklyTrend {
  week: string;
  revenue: number;
  bookings: number;
}

export class ShopMetricsService {
  private pool = getSharedPool();

  /**
   * Get daily statistics for a specific date
   */
  async getDailyStats(shopId: string, date: string): Promise<DailyStats> {
    try {
      const targetDate = new Date(date);
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - 1);

      // Get current day stats
      const currentStats = await this.getDateRangeStats(
        shopId,
        targetDate.toISOString().split('T')[0],
        targetDate.toISOString().split('T')[0]
      );

      // Get previous day stats for comparison
      const previousStats = await this.getDateRangeStats(
        shopId,
        previousDate.toISOString().split('T')[0],
        previousDate.toISOString().split('T')[0]
      );

      return {
        newBookings: currentStats.bookings,
        newBookingsTrend: this.calculateTrend(currentStats.bookings, previousStats.bookings),
        revenue: currentStats.revenue,
        revenueTrend: this.calculateTrend(currentStats.revenue, previousStats.revenue),
        newCustomers: currentStats.newCustomers,
        newCustomersTrend: this.calculateTrend(currentStats.newCustomers, previousStats.newCustomers),
        completedBookings: currentStats.completed,
        completedTrend: this.calculateTrend(currentStats.completed, previousStats.completed),
        avgRating: currentStats.avgRating,
        ratingTrend: currentStats.avgRating && previousStats.avgRating
          ? currentStats.avgRating - previousStats.avgRating
          : 0,
        noShows: currentStats.noShows,
        noShowsTrend: this.calculateTrend(currentStats.noShows, previousStats.noShows),
        rcnIssued: currentStats.rcnIssued,
        rcnIssuedUsd: currentStats.rcnIssued * 0.10,
        reviewsReceived: currentStats.reviews,
        cancellations: currentStats.cancellations
      };
    } catch (error) {
      logger.error('Error getting daily stats:', error);
      throw error;
    }
  }

  /**
   * Get weekly statistics
   */
  async getWeeklyStats(shopId: string, weekEnd: string): Promise<WeeklyStats & { topServices: ServiceStat[]; customerInsights: CustomerInsights }> {
    try {
      const endDate = new Date(weekEnd);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6); // Last 7 days

      // Previous week for comparison
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 6);

      // Get current week stats
      const currentStats = await this.getDateRangeStats(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Get previous week stats
      const previousStats = await this.getDateRangeStats(
        shopId,
        prevStartDate.toISOString().split('T')[0],
        prevEndDate.toISOString().split('T')[0]
      );

      // Get top services
      const topServices = await this.getTopServices(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        3
      );

      // Get customer insights
      const customerInsights = await this.getCustomerInsights(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      const totalOrders = currentStats.bookings;
      const completionRate = totalOrders > 0 ? (currentStats.completed / totalOrders) * 100 : 0;
      const noShowRate = totalOrders > 0 ? (currentStats.noShows / totalOrders) * 100 : 0;
      const cancellationRate = totalOrders > 0 ? (currentStats.cancellations / totalOrders) * 100 : 0;

      return {
        bookingsCount: currentStats.bookings,
        bookingsTrend: this.calculateTrend(currentStats.bookings, previousStats.bookings),
        revenue: currentStats.revenue,
        revenueTrend: this.calculateTrend(currentStats.revenue, previousStats.revenue),
        completedCount: currentStats.completed,
        completedTrend: this.calculateTrend(currentStats.completed, previousStats.completed),
        avgRating: currentStats.avgRating,
        ratingTrend: currentStats.avgRating && previousStats.avgRating
          ? ((currentStats.avgRating - previousStats.avgRating) / previousStats.avgRating) * 100
          : 0,
        completionRate,
        noShowRate,
        cancellationRate,
        topServices,
        customerInsights
      };
    } catch (error) {
      logger.error('Error getting weekly stats:', error);
      throw error;
    }
  }

  /**
   * Get monthly statistics
   */
  async getMonthlyStats(shopId: string, month: string): Promise<MonthlyStats & { topServices: ServiceStat[]; topCustomers: CustomerStat[]; weeklyTrends: WeeklyTrend[] }> {
    try {
      // Parse month (format: "2026-04" or "April 2026")
      const monthDate = month.includes('-')
        ? new Date(month + '-01')
        : new Date(month);

      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      // Previous month for comparison
      const prevStartDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
      const prevEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0);

      // Get current month stats
      const currentStats = await this.getDateRangeStats(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Get previous month stats
      const previousStats = await this.getDateRangeStats(
        shopId,
        prevStartDate.toISOString().split('T')[0],
        prevEndDate.toISOString().split('T')[0]
      );

      // Get top 5 services
      const topServices = await this.getTopServices(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        5
      );

      // Get top 5 customers
      const topCustomers = await this.getTopCustomers(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        5
      );

      // Get weekly trends
      const weeklyTrends = await this.getWeeklyTrends(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Get peak days
      const peakDays = await this.getPeakDays(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Calculate retention
      const retention = await this.getCustomerRetention(
        shopId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      const prevRetention = await this.getCustomerRetention(
        shopId,
        prevStartDate.toISOString().split('T')[0],
        prevEndDate.toISOString().split('T')[0]
      );

      const totalOrders = currentStats.bookings;
      const completionRate = totalOrders > 0 ? (currentStats.completed / totalOrders) * 100 : 0;
      const noShowRate = totalOrders > 0 ? (currentStats.noShows / totalOrders) * 100 : 0;
      const cancellationRate = totalOrders > 0 ? (currentStats.cancellations / totalOrders) * 100 : 0;
      const avgOrderValue = currentStats.completed > 0 ? currentStats.revenue / currentStats.completed : 0;

      return {
        bookingsCount: currentStats.bookings,
        bookingsTrend: this.calculateTrend(currentStats.bookings, previousStats.bookings),
        revenue: currentStats.revenue,
        revenueTrend: this.calculateTrend(currentStats.revenue, previousStats.revenue),
        completedCount: currentStats.completed,
        completedTrend: this.calculateTrend(currentStats.completed, previousStats.completed),
        avgRating: currentStats.avgRating,
        ratingTrend: currentStats.avgRating && previousStats.avgRating
          ? ((currentStats.avgRating - previousStats.avgRating) / previousStats.avgRating) * 100
          : 0,
        completionRate,
        noShowRate,
        cancellationRate,
        avgOrderValue,
        rcnIssued: currentStats.rcnIssued,
        rcnIssuedUsd: currentStats.rcnIssued * 0.10,
        peakDays,
        avgResponseTime: 2.5, // TODO: Calculate from actual response time data
        customerRetention: retention,
        retentionTrend: this.calculateTrend(retention, prevRetention),
        topServices,
        topCustomers,
        weeklyTrends
      };
    } catch (error) {
      logger.error('Error getting monthly stats:', error);
      throw error;
    }
  }

  /**
   * Get stats for a date range (helper method)
   */
  private async getDateRangeStats(shopId: string, startDate: string, endDate: string) {
    const query = `
      SELECT
        COUNT(*) as bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancellations,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN rcn_rewarded ELSE 0 END), 0) as rcn_issued
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);
    const stats = result.rows[0];

    // Get new customers count
    const newCustomersQuery = `
      SELECT COUNT(DISTINCT customer_address) as new_customers
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
        AND customer_address IN (
          SELECT customer_address
          FROM service_orders
          WHERE shop_id = $1
          GROUP BY customer_address
          HAVING MIN(booking_date) >= $2 AND MIN(booking_date) <= $3
        )
    `;
    const newCustomersResult = await this.pool.query(newCustomersQuery, [shopId, startDate, endDate]);

    // Get average rating
    const ratingQuery = `
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM service_reviews
      WHERE shop_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `;
    const ratingResult = await this.pool.query(ratingQuery, [shopId, startDate, endDate]);

    return {
      bookings: parseInt(stats.bookings) || 0,
      completed: parseInt(stats.completed) || 0,
      noShows: parseInt(stats.no_shows) || 0,
      cancellations: parseInt(stats.cancellations) || 0,
      revenue: parseFloat(stats.revenue) || 0,
      rcnIssued: parseFloat(stats.rcn_issued) || 0,
      newCustomers: parseInt(newCustomersResult.rows[0]?.new_customers) || 0,
      avgRating: ratingResult.rows[0]?.avg_rating ? parseFloat(ratingResult.rows[0].avg_rating) : null,
      reviews: parseInt(ratingResult.rows[0]?.review_count) || 0
    };
  }

  /**
   * Get top services by bookings and revenue
   */
  private async getTopServices(shopId: string, startDate: string, endDate: string, limit: number): Promise<ServiceStat[]> {
    const query = `
      SELECT
        s.service_name as name,
        COUNT(o.order_id) as bookings,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as revenue
      FROM service_orders o
      JOIN services s ON o.service_id = s.service_id
      WHERE o.shop_id = $1
        AND o.booking_date >= $2
        AND o.booking_date <= $3
      GROUP BY s.service_id, s.service_name
      ORDER BY revenue DESC, bookings DESC
      LIMIT $4
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate, limit]);
    const totalRevenue = result.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0);

    return result.rows.map(row => ({
      name: row.name,
      bookings: parseInt(row.bookings),
      revenue: parseFloat(row.revenue),
      percentage: totalRevenue > 0 ? (parseFloat(row.revenue) / totalRevenue) * 100 : 0
    }));
  }

  /**
   * Get top customers by visits and spending
   */
  private async getTopCustomers(shopId: string, startDate: string, endDate: string, limit: number): Promise<CustomerStat[]> {
    const query = `
      SELECT
        COALESCE(c.name, c.email, o.customer_address) as name,
        COUNT(o.order_id) as visits,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as total_spent
      FROM service_orders o
      LEFT JOIN customers c ON o.customer_address = c.wallet_address
      WHERE o.shop_id = $1
        AND o.booking_date >= $2
        AND o.booking_date <= $3
      GROUP BY c.name, c.email, o.customer_address
      ORDER BY visits DESC, total_spent DESC
      LIMIT $4
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate, limit]);

    return result.rows.map(row => ({
      name: row.name || 'Unknown Customer',
      visits: parseInt(row.visits),
      totalSpent: parseFloat(row.total_spent)
    }));
  }

  /**
   * Get weekly trends for the month
   */
  private async getWeeklyTrends(shopId: string, startDate: string, endDate: string): Promise<WeeklyTrend[]> {
    const query = `
      SELECT
        DATE_TRUNC('week', booking_date) as week_start,
        COUNT(*) as bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
      GROUP BY DATE_TRUNC('week', booking_date)
      ORDER BY week_start
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);

    return result.rows.map(row => ({
      week: new Date(row.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: parseFloat(row.revenue),
      bookings: parseInt(row.bookings)
    }));
  }

  /**
   * Get peak booking days
   */
  private async getPeakDays(shopId: string, startDate: string, endDate: string): Promise<string[]> {
    const query = `
      SELECT
        TO_CHAR(booking_date, 'Day') as day_name,
        COUNT(*) as booking_count
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
      GROUP BY day_name
      ORDER BY booking_count DESC
      LIMIT 2
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);
    return result.rows.map(row => row.day_name.trim());
  }

  /**
   * Get customer insights
   */
  private async getCustomerInsights(shopId: string, startDate: string, endDate: string): Promise<CustomerInsights> {
    // New customers (first booking in this period)
    const newCustomersQuery = `
      SELECT COUNT(DISTINCT customer_address) as new_customers
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
        AND customer_address IN (
          SELECT customer_address
          FROM service_orders
          WHERE shop_id = $1
          GROUP BY customer_address
          HAVING MIN(booking_date) >= $2
        )
    `;
    const newResult = await this.pool.query(newCustomersQuery, [shopId, startDate, endDate]);
    const newCustomers = parseInt(newResult.rows[0]?.new_customers) || 0;

    // Repeat customers (had previous booking before this period)
    const repeatCustomersQuery = `
      SELECT COUNT(DISTINCT customer_address) as repeat_customers
      FROM service_orders
      WHERE shop_id = $1
        AND booking_date >= $2
        AND booking_date <= $3
        AND customer_address IN (
          SELECT customer_address
          FROM service_orders
          WHERE shop_id = $1
            AND booking_date < $2
        )
    `;
    const repeatResult = await this.pool.query(repeatCustomersQuery, [shopId, startDate, endDate]);
    const repeatCustomers = parseInt(repeatResult.rows[0]?.repeat_customers) || 0;

    // Satisfaction rate (4+ star reviews / total reviews)
    const satisfactionQuery = `
      SELECT
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as satisfied_reviews
      FROM service_reviews
      WHERE shop_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `;
    const satisfactionResult = await this.pool.query(satisfactionQuery, [shopId, startDate, endDate]);
    const totalReviews = parseInt(satisfactionResult.rows[0]?.total_reviews) || 0;
    const satisfiedReviews = parseInt(satisfactionResult.rows[0]?.satisfied_reviews) || 0;
    const satisfactionRate = totalReviews > 0 ? (satisfiedReviews / totalReviews) * 100 : 0;

    return {
      newCustomers,
      repeatCustomers,
      satisfactionRate
    };
  }

  /**
   * Get customer retention rate
   */
  private async getCustomerRetention(shopId: string, startDate: string, endDate: string): Promise<number> {
    // Get customers from previous period
    const prevPeriodStart = new Date(startDate);
    prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
    const prevPeriodEnd = new Date(startDate);
    prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);

    const retentionQuery = `
      WITH prev_customers AS (
        SELECT DISTINCT customer_address
        FROM service_orders
        WHERE shop_id = $1
          AND booking_date >= $2
          AND booking_date <= $3
      ),
      returned_customers AS (
        SELECT DISTINCT customer_address
        FROM service_orders
        WHERE shop_id = $1
          AND booking_date >= $4
          AND booking_date <= $5
          AND customer_address IN (SELECT customer_address FROM prev_customers)
      )
      SELECT
        (SELECT COUNT(*) FROM prev_customers) as prev_count,
        (SELECT COUNT(*) FROM returned_customers) as returned_count
    `;

    const result = await this.pool.query(retentionQuery, [
      shopId,
      prevPeriodStart.toISOString().split('T')[0],
      prevPeriodEnd.toISOString().split('T')[0],
      startDate,
      endDate
    ]);

    const prevCount = parseInt(result.rows[0]?.prev_count) || 0;
    const returnedCount = parseInt(result.rows[0]?.returned_count) || 0;

    return prevCount > 0 ? (returnedCount / prevCount) * 100 : 0;
  }

  /**
   * Calculate percentage trend
   */
  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }
}
