// backend/src/domains/shop/routes/reports.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireShopOwnership } from '../../../middleware/auth';
import { ShopMetricsService } from '../../../services/ShopMetricsService';
import { EmailService } from '../../../services/EmailService';
import { shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';

const router = Router();
const metricsService = new ShopMetricsService();
const emailService = new EmailService();
const pool = getSharedPool();

/**
 * GET /api/shops/reports/settings
 * Get report settings for authenticated shop
 */
router.get('/settings', authMiddleware, requireShopOwnership, async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID not found' });
    }

    // Get report preferences from shop_email_preferences
    const query = `
      SELECT
        daily_digest,
        weekly_report,
        weekly_report_day,
        monthly_report,
        monthly_report_day
      FROM shop_email_preferences
      WHERE shop_id = $1
    `;

    const result = await pool.query(query, [shopId]);

    if (result.rows.length === 0) {
      // Create default preferences if they don't exist
      const insertQuery = `
        INSERT INTO shop_email_preferences (shop_id, daily_digest, weekly_report, monthly_report)
        VALUES ($1, false, false, false)
        RETURNING daily_digest, weekly_report, weekly_report_day, monthly_report, monthly_report_day
      `;
      const insertResult = await pool.query(insertQuery, [shopId]);
      const prefs = insertResult.rows[0];

      return res.json({
        success: true,
        data: {
          dailyDigest: {
            enabled: prefs.daily_digest,
            sendTime: '18:00' // Default 6 PM UTC
          },
          weeklyReport: {
            enabled: prefs.weekly_report,
            dayOfWeek: prefs.weekly_report_day || 'monday'
          },
          monthlyReport: {
            enabled: prefs.monthly_report,
            dayOfMonth: prefs.monthly_report_day || 1
          }
        }
      });
    }

    const prefs = result.rows[0];

    res.json({
      success: true,
      data: {
        dailyDigest: {
          enabled: prefs.daily_digest,
          sendTime: '18:00' // Currently fixed, can be made configurable later
        },
        weeklyReport: {
          enabled: prefs.weekly_report,
          dayOfWeek: prefs.weekly_report_day || 'monday'
        },
        monthlyReport: {
          enabled: prefs.monthly_report,
          dayOfMonth: prefs.monthly_report_day || 1
        }
      }
    });
  } catch (error: any) {
    logger.error('Error fetching report settings:', error);
    res.status(500).json({ error: 'Failed to fetch report settings' });
  }
});

/**
 * PUT /api/shops/reports/settings
 * Update report settings for authenticated shop
 */
router.put('/settings', authMiddleware, requireShopOwnership, async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { dailyDigest, weeklyReport, monthlyReport } = req.body;

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID not found' });
    }

    // Validate inputs
    if (weeklyReport?.dayOfWeek) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (!validDays.includes(weeklyReport.dayOfWeek.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid day of week' });
      }
    }

    if (monthlyReport?.dayOfMonth) {
      const day = parseInt(monthlyReport.dayOfMonth);
      if (isNaN(day) || day < 1 || day > 28) {
        return res.status(400).json({ error: 'Day of month must be between 1 and 28' });
      }
    }

    // Update preferences
    const updateQuery = `
      UPDATE shop_email_preferences
      SET
        daily_digest = COALESCE($2, daily_digest),
        weekly_report = COALESCE($3, weekly_report),
        weekly_report_day = COALESCE($4, weekly_report_day),
        monthly_report = COALESCE($5, monthly_report),
        monthly_report_day = COALESCE($6, monthly_report_day),
        updated_at = NOW()
      WHERE shop_id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      shopId,
      dailyDigest?.enabled !== undefined ? dailyDigest.enabled : null,
      weeklyReport?.enabled !== undefined ? weeklyReport.enabled : null,
      weeklyReport?.dayOfWeek?.toLowerCase() || null,
      monthlyReport?.enabled !== undefined ? monthlyReport.enabled : null,
      monthlyReport?.dayOfMonth || null
    ]);

    if (result.rows.length === 0) {
      // Create preferences if they don't exist
      const insertQuery = `
        INSERT INTO shop_email_preferences (
          shop_id, daily_digest, weekly_report, weekly_report_day, monthly_report, monthly_report_day
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      await pool.query(insertQuery, [
        shopId,
        dailyDigest?.enabled || false,
        weeklyReport?.enabled || false,
        weeklyReport?.dayOfWeek?.toLowerCase() || 'monday',
        monthlyReport?.enabled || false,
        monthlyReport?.dayOfMonth || 1
      ]);
    }

    logger.info('Report settings updated', { shopId, settings: req.body });

    res.json({
      success: true,
      message: 'Report settings updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating report settings:', error);
    res.status(500).json({ error: 'Failed to update report settings' });
  }
});

/**
 * POST /api/shops/reports/preview/:type
 * Generate preview of report with sample data
 */
router.post('/preview/:type', authMiddleware, requireShopOwnership, async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { type } = req.params;

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID not found' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type. Must be daily, weekly, or monthly' });
    }

    // Get shop details
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    let previewData: any = {};

    if (type === 'daily') {
      // Get yesterday's data for preview
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const dateLabel = yesterday.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const stats = await metricsService.getDailyStats(shopId, dateStr);
      previewData = {
        shopName: shop.name,
        date: dateLabel,
        stats
      };
    } else if (type === 'weekly') {
      // Get last week's data for preview
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - 1);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekEndLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const weeklyData = await metricsService.getWeeklyStats(shopId, weekEndStr);

      previewData = {
        shopName: shop.name,
        weekStart: weekStartLabel,
        weekEnd: weekEndLabel,
        stats: weeklyData,
        topServices: weeklyData.topServices,
        customerInsights: weeklyData.customerInsights
      };
    } else if (type === 'monthly') {
      // Get last month's data for preview
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthLabel = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthStr = lastMonth.toISOString().slice(0, 7);

      const monthlyData = await metricsService.getMonthlyStats(shopId, monthStr);

      previewData = {
        shopName: shop.name,
        monthLabel,
        stats: monthlyData,
        topServices: monthlyData.topServices.map((service: any, index: number) => ({
          rank: index + 1,
          name: service.name,
          bookings: service.bookings,
          revenue: service.revenue
        })),
        topCustomers: monthlyData.topCustomers
      };
    }

    res.json({
      success: true,
      data: previewData
    });
  } catch (error: any) {
    logger.error('Error generating report preview:', error);
    res.status(500).json({ error: 'Failed to generate report preview' });
  }
});

/**
 * POST /api/shops/reports/test/:type
 * Send test report email
 */
router.post('/test/:type', authMiddleware, requireShopOwnership, async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { type } = req.params;
    const { recipientEmail } = req.body;

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID not found' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type. Must be daily, weekly, or monthly' });
    }

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Get shop details
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    let sent = false;

    if (type === 'daily') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const dateLabel = yesterday.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const stats = await metricsService.getDailyStats(shopId, dateStr);
      sent = await emailService.sendShopDailyDigest(recipientEmail, shopId, {
        shopName: shop.name,
        date: dateLabel,
        stats
      });
    } else if (type === 'weekly') {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - 1);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekEndLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const weeklyData = await metricsService.getWeeklyStats(shopId, weekEndStr);

      sent = await emailService.sendShopWeeklyReport(recipientEmail, shopId, {
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
      });
    } else if (type === 'monthly') {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthLabel = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthStr = lastMonth.toISOString().slice(0, 7);

      const monthlyData = await metricsService.getMonthlyStats(shopId, monthStr);

      sent = await emailService.sendShopMonthlyReport(recipientEmail, shopId, {
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
      });
    }

    if (sent) {
      logger.info(`Test ${type} report sent`, { shopId, recipientEmail });
      res.json({
        success: true,
        message: `Test ${type} report sent to ${recipientEmail}`
      });
    } else {
      logger.error(`Failed to send test ${type} report`, { shopId, recipientEmail });
      res.status(500).json({ error: 'Failed to send test report email' });
    }
  } catch (error: any) {
    logger.error('Error sending test report:', error);
    res.status(500).json({ error: 'Failed to send test report' });
  }
});

export default router;
