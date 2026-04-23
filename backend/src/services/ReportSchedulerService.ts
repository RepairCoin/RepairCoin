// backend/src/services/ReportSchedulerService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { ShopMetricsService } from './ShopMetricsService';
import { getSharedPool } from '../utils/database-pool';

export interface ReportScheduleStats {
  timestamp: Date;
  dailyDigestsSent: number;
  weeklyReportsSent: number;
  monthlyReportsSent: number;
  errors: string[];
}

export class ReportSchedulerService {
  private emailService: EmailService;
  private metricsService: ShopMetricsService;
  private pool = getSharedPool();
  private lastDailyRunDate: string | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.emailService = new EmailService();
    this.metricsService = new ShopMetricsService();
  }

  /**
   * Main entry point - called by scheduler every hour
   */
  async processScheduledReports(): Promise<ReportScheduleStats> {
    if (this.isRunning) {
      logger.info('Report scheduler already running, skipping this execution');
      return {
        timestamp: new Date(),
        dailyDigestsSent: 0,
        weeklyReportsSent: 0,
        monthlyReportsSent: 0,
        errors: ['Scheduler already running']
      };
    }

    this.isRunning = true;
    const stats: ReportScheduleStats = {
      timestamp: new Date(),
      dailyDigestsSent: 0,
      weeklyReportsSent: 0,
      monthlyReportsSent: 0,
      errors: []
    };

    try {
      logger.info('Report scheduler starting', { timestamp: stats.timestamp });

      const now = new Date();
      const hour = now.getUTCHours();

      // Daily digests - run once per day at configured hour (default 18:00 UTC = 6 PM)
      if (this.shouldRunDailyDigests(now)) {
        logger.info('Running daily digests');
        const count = await this.sendDailyDigests();
        stats.dailyDigestsSent = count;
        logger.info(`Daily digests sent: ${count}`);
      }

      // Weekly reports - run at 9 AM UTC
      if (hour === 9) {
        logger.info('Running weekly reports');
        const count = await this.sendWeeklyReports();
        stats.weeklyReportsSent = count;
        logger.info(`Weekly reports sent: ${count}`);
      }

      // Monthly reports - run at 9 AM UTC
      if (hour === 9) {
        logger.info('Running monthly reports');
        const count = await this.sendMonthlyReports();
        stats.monthlyReportsSent = count;
        logger.info(`Monthly reports sent: ${count}`);
      }

      logger.info('Report scheduler completed', stats);
    } catch (error: any) {
      logger.error('Report scheduler failed:', error);
      stats.errors.push(error.message);
    } finally {
      this.isRunning = false;
    }

    return stats;
  }

  /**
   * Send daily digests to all shops with preference enabled
   */
  private async sendDailyDigests(): Promise<number> {
    try {
      // Get yesterday's date (digest is for previous day's activity)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const dateLabel = yesterday.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Query shops with daily_digest = true AND email exists
      const query = `
        SELECT s.shop_id, s.name, s.email
        FROM shops s
        JOIN shop_email_preferences sep ON s.shop_id = sep.shop_id
        WHERE sep.daily_digest = true
          AND s.email IS NOT NULL
          AND s.email != ''
          AND s.subscription_status = 'active'
      `;

      const result = await this.pool.query(query);
      const shops = result.rows;

      logger.info(`Found ${shops.length} shops for daily digest`);

      let sentCount = 0;

      for (const shop of shops) {
        try {
          // Get stats for yesterday
          const stats = await this.metricsService.getDailyStats(shop.shop_id, dateStr);

          // Send email
          const sent = await this.emailService.sendShopDailyDigest(
            shop.email,
            shop.shop_id,
            {
              shopName: shop.name,
              date: dateLabel,
              stats
            }
          );

          if (sent) {
            sentCount++;
            logger.info(`Daily digest sent to ${shop.name} (${shop.shop_id})`);
          }
        } catch (error: any) {
          logger.error(`Failed to send daily digest to ${shop.name}:`, error);
        }
      }

      return sentCount;
    } catch (error) {
      logger.error('Error in sendDailyDigests:', error);
      throw error;
    }
  }

  /**
   * Send weekly reports to shops where today matches their chosen day
   */
  private async sendWeeklyReports(): Promise<number> {
    try {
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // Week end is yesterday (report for last 7 days ending yesterday)
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - 1);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Week start is 7 days before week end
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekEndLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Query shops WHERE weekly_report = true AND weekly_report_day = today
      const query = `
        SELECT s.shop_id, s.name, s.email
        FROM shops s
        JOIN shop_email_preferences sep ON s.shop_id = sep.shop_id
        WHERE sep.weekly_report = true
          AND sep.weekly_report_day = $1
          AND s.email IS NOT NULL
          AND s.email != ''
          AND s.subscription_status = 'active'
      `;

      const result = await this.pool.query(query, [dayOfWeek]);
      const shops = result.rows;

      logger.info(`Found ${shops.length} shops for weekly report (${dayOfWeek})`);

      let sentCount = 0;

      for (const shop of shops) {
        try {
          // Get weekly stats
          const weeklyData = await this.metricsService.getWeeklyStats(shop.shop_id, weekEndStr);

          // Send email
          const sent = await this.emailService.sendShopWeeklyReport(
            shop.email,
            shop.shop_id,
            {
              shopName: shop.name,
              weekStart: weekStartLabel,
              weekEnd: weekEndLabel,
              stats: {
                bookingsCount: weeklyData.bookingsCount,
                bookingsTrend: weeklyData.bookingsTrend,
                revenue: weeklyData.revenue,
                revenueTrend: weeklyData.revenueTrend,
                completedCount: weeklyData.completedCount,
                completedTrend: weeklyData.completedTrend,
                avgRating: weeklyData.avgRating,
                ratingTrend: weeklyData.ratingTrend,
                completionRate: weeklyData.completionRate,
                noShowRate: weeklyData.noShowRate,
                cancellationRate: weeklyData.cancellationRate
              },
              topServices: weeklyData.topServices,
              customerInsights: weeklyData.customerInsights
            }
          );

          if (sent) {
            sentCount++;
            logger.info(`Weekly report sent to ${shop.name} (${shop.shop_id})`);
          }
        } catch (error: any) {
          logger.error(`Failed to send weekly report to ${shop.name}:`, error);
        }
      }

      return sentCount;
    } catch (error) {
      logger.error('Error in sendWeeklyReports:', error);
      throw error;
    }
  }

  /**
   * Send monthly reports to shops where today matches their chosen day
   */
  private async sendMonthlyReports(): Promise<number> {
    try {
      const today = new Date();
      const dayOfMonth = today.getDate();

      // Get previous month
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthLabel = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthStr = lastMonth.toISOString().slice(0, 7); // YYYY-MM format

      // Query shops WHERE monthly_report = true AND monthly_report_day = dayOfMonth
      const query = `
        SELECT s.shop_id, s.name, s.email
        FROM shops s
        JOIN shop_email_preferences sep ON s.shop_id = sep.shop_id
        WHERE sep.monthly_report = true
          AND sep.monthly_report_day = $1
          AND s.email IS NOT NULL
          AND s.email != ''
          AND s.subscription_status = 'active'
      `;

      const result = await this.pool.query(query, [dayOfMonth]);
      const shops = result.rows;

      logger.info(`Found ${shops.length} shops for monthly report (day ${dayOfMonth})`);

      let sentCount = 0;

      for (const shop of shops) {
        try {
          // Get monthly stats
          const monthlyData = await this.metricsService.getMonthlyStats(shop.shop_id, monthStr);

          // Send email
          const sent = await this.emailService.sendShopMonthlyReport(
            shop.email,
            shop.shop_id,
            {
              shopName: shop.name,
              monthLabel,
              stats: {
                bookingsCount: monthlyData.bookingsCount,
                bookingsTrend: monthlyData.bookingsTrend,
                revenue: monthlyData.revenue,
                revenueTrend: monthlyData.revenueTrend,
                completedCount: monthlyData.completedCount,
                completedTrend: monthlyData.completedTrend,
                avgRating: monthlyData.avgRating,
                ratingTrend: monthlyData.ratingTrend,
                completionRate: monthlyData.completionRate,
                noShowRate: monthlyData.noShowRate,
                cancellationRate: monthlyData.cancellationRate,
                avgOrderValue: monthlyData.avgOrderValue,
                rcnIssued: monthlyData.rcnIssued,
                rcnIssuedUsd: monthlyData.rcnIssuedUsd,
                peakDays: monthlyData.peakDays,
                avgResponseTime: monthlyData.avgResponseTime,
                customerRetention: monthlyData.customerRetention,
                retentionTrend: monthlyData.retentionTrend
              },
              topServices: monthlyData.topServices.map((service, index) => ({
                rank: index + 1,
                name: service.name,
                bookings: service.bookings,
                revenue: service.revenue
              })),
              topCustomers: monthlyData.topCustomers
            }
          );

          if (sent) {
            sentCount++;
            logger.info(`Monthly report sent to ${shop.name} (${shop.shop_id})`);
          }
        } catch (error: any) {
          logger.error(`Failed to send monthly report to ${shop.name}:`, error);
        }
      }

      return sentCount;
    } catch (error) {
      logger.error('Error in sendMonthlyReports:', error);
      throw error;
    }
  }

  /**
   * Check if daily digests should run now
   */
  private shouldRunDailyDigests(now: Date): boolean {
    const currentDate = now.toISOString().split('T')[0];
    const hour = now.getUTCHours();
    const targetHour = parseInt(process.env.DAILY_DIGEST_HOUR_UTC || '18', 10);

    // Run once per day at target hour
    if (hour === targetHour && this.lastDailyRunDate !== currentDate) {
      this.lastDailyRunDate = currentDate;
      return true;
    }

    return false;
  }

  /**
   * Start the scheduler (called on app startup)
   */
  start(): void {
    logger.info('Report scheduler service initialized');
    // The actual scheduling is handled by the hourly cron job in app.ts
    // This method is here for consistency with other services
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    logger.info('Report scheduler service stopped');
    this.isRunning = false;
  }
}
