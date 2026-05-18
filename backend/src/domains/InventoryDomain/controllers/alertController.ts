// backend/src/domains/InventoryDomain/controllers/alertController.ts
import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getLowStockAlertService } from '../../../services/LowStockAlertService';
import { getLowStockAlertScheduler } from '../../../services/LowStockAlertScheduler';
import { getSharedPool } from '../../../utils/database-pool';

const pool = getSharedPool();

/**
 * Get low stock alert settings for a shop
 */
export async function getAlertSettings(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    // Query shop's alert settings including new digest preferences
    const query = `
      SELECT
        low_stock_alerts_enabled,
        low_stock_alert_email,
        low_stock_alert_frequency,
        low_stock_digest_mode,
        low_stock_digest_day_of_week,
        low_stock_digest_day_of_month,
        low_stock_digest_time,
        last_digest_sent_at,
        email
      FROM shops
      WHERE shop_id = $1
    `;

    const result = await pool.query(query, [shopId]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
      return;
    }

    const shop = result.rows[0];

    res.json({
      success: true,
      data: {
        enabled: shop.low_stock_alerts_enabled ?? true,
        email: shop.low_stock_alert_email || shop.email,
        frequency: shop.low_stock_alert_frequency || 'daily',
        digestMode: shop.low_stock_digest_mode || 'daily',
        digestDayOfWeek: shop.low_stock_digest_day_of_week || 1,
        digestDayOfMonth: shop.low_stock_digest_day_of_month || 1,
        digestTime: shop.low_stock_digest_time || '09:00',
        lastDigestSentAt: shop.last_digest_sent_at
      }
    });
  } catch (error) {
    logger.error('Error fetching alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert settings'
    });
  }
}

/**
 * Update low stock alert settings for a shop
 */
export async function updateAlertSettings(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const {
      enabled,
      email,
      frequency,
      digestMode,
      digestDayOfWeek,
      digestDayOfMonth,
      digestTime
    } = req.body;

    // Validate inputs
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'Invalid enabled value'
      });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
      return;
    }

    if (frequency && !['daily', 'weekly'].includes(frequency)) {
      res.status(400).json({
        success: false,
        message: 'Invalid frequency. Must be "daily" or "weekly"'
      });
      return;
    }

    if (digestMode && !['immediate', 'daily', 'weekly', 'monthly'].includes(digestMode)) {
      res.status(400).json({
        success: false,
        message: 'Invalid digest mode. Must be "immediate", "daily", "weekly", or "monthly"'
      });
      return;
    }

    if (digestDayOfWeek !== undefined && (digestDayOfWeek < 0 || digestDayOfWeek > 6)) {
      res.status(400).json({
        success: false,
        message: 'Invalid day of week. Must be 0-6 (0=Sunday, 6=Saturday)'
      });
      return;
    }

    if (digestDayOfMonth !== undefined && (digestDayOfMonth < 1 || digestDayOfMonth > 28)) {
      res.status(400).json({
        success: false,
        message: 'Invalid day of month. Must be 1-28'
      });
      return;
    }

    if (digestTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(digestTime)) {
      res.status(400).json({
        success: false,
        message: 'Invalid time format. Must be HH:MM (24-hour format)'
      });
      return;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: Array<boolean | string | number> = [];
    let paramIndex = 1;

    if (enabled !== undefined) {
      updates.push(`low_stock_alerts_enabled = $${paramIndex++}`);
      values.push(enabled);
    }

    if (email) {
      updates.push(`low_stock_alert_email = $${paramIndex++}`);
      values.push(email);
    }

    if (frequency) {
      updates.push(`low_stock_alert_frequency = $${paramIndex++}`);
      values.push(frequency);
    }

    if (digestMode) {
      updates.push(`low_stock_digest_mode = $${paramIndex++}`);
      values.push(digestMode);
    }

    if (digestDayOfWeek !== undefined) {
      updates.push(`low_stock_digest_day_of_week = $${paramIndex++}`);
      values.push(digestDayOfWeek);
    }

    if (digestDayOfMonth !== undefined) {
      updates.push(`low_stock_digest_day_of_month = $${paramIndex++}`);
      values.push(digestDayOfMonth);
    }

    if (digestTime) {
      updates.push(`low_stock_digest_time = $${paramIndex++}`);
      values.push(digestTime);
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
      return;
    }

    values.push(shopId);

    const query = `
      UPDATE shops
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE shop_id = $${paramIndex}
      RETURNING
        low_stock_alerts_enabled,
        low_stock_alert_email,
        low_stock_alert_frequency,
        low_stock_digest_mode,
        low_stock_digest_day_of_week,
        low_stock_digest_day_of_month,
        low_stock_digest_time
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
      return;
    }

    const updated = result.rows[0];

    res.json({
      success: true,
      message: 'Alert settings updated successfully',
      data: {
        enabled: updated.low_stock_alerts_enabled,
        email: updated.low_stock_alert_email,
        frequency: updated.low_stock_alert_frequency,
        digestMode: updated.low_stock_digest_mode,
        digestDayOfWeek: updated.low_stock_digest_day_of_week,
        digestDayOfMonth: updated.low_stock_digest_day_of_month,
        digestTime: updated.low_stock_digest_time
      }
    });

    logger.info(`Low stock alert settings updated for shop ${shopId}`);
  } catch (error) {
    logger.error('Error updating alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert settings'
    });
  }
}

/**
 * Manually trigger low stock check for a specific shop
 */
export async function triggerManualCheck(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    const alertService = getLowStockAlertService();
    const result = await alertService.checkShopNow(shopId);

    res.json({
      success: true,
      message: result.emailSent
        ? `Low stock alert sent for ${result.itemsCount} items`
        : result.itemsCount > 0
          ? `Found ${result.itemsCount} low stock items, but email was not sent (recently alerted)`
          : 'No low stock items found',
      data: result
    });

    logger.info(`Manual low stock check triggered for shop ${shopId}`);
  } catch (error) {
    logger.error('Error triggering manual check:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to trigger manual check'
    });
  }
}

/**
 * Get low stock items for a shop (without sending email)
 */
export async function getLowStockItems(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    const query = `
      SELECT
        i.id,
        i.name,
        i.sku,
        i.barcode,
        i.stock_quantity,
        i.low_stock_threshold,
        i.status,
        i.price,
        c.name as category_name,
        v.name as vendor_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN inventory_vendors v ON i.vendor_id = v.id
      WHERE i.shop_id = $1
        AND i.deleted_at IS NULL
        AND (
          i.stock_quantity <= i.low_stock_threshold
          OR i.stock_quantity = 0
        )
      ORDER BY
        CASE WHEN i.stock_quantity = 0 THEN 0 ELSE 1 END,
        i.stock_quantity ASC,
        i.name ASC
    `;

    const result = await pool.query(query, [shopId]);

    const outOfStock = result.rows.filter(item => item.stock_quantity === 0);
    const lowStock = result.rows.filter(item => item.stock_quantity > 0);

    res.json({
      success: true,
      data: {
        items: result.rows,
        summary: {
          total: result.rows.length,
          outOfStock: outOfStock.length,
          lowStock: lowStock.length
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
}

/**
 * Get scheduler status (admin only)
 */
export async function getSchedulerStatus(req: Request, res: Response): Promise<void> {
  try {
    const scheduler = getLowStockAlertScheduler();
    const status = scheduler.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduler status'
    });
  }
}

/**
 * Run scheduler check now (admin only)
 */
export async function runSchedulerNow(req: Request, res: Response): Promise<void> {
  try {
    const scheduler = getLowStockAlertScheduler();
    const results = await scheduler.runAlertCheck();

    const successCount = results.filter(r => r.emailSent).length;
    const errorCount = results.filter(r => r.error).length;

    res.json({
      success: true,
      message: `Alert check completed: ${successCount} emails sent, ${errorCount} errors`,
      data: {
        totalShops: results.length,
        emailsSent: successCount,
        errors: errorCount,
        results
      }
    });
  } catch (error) {
    logger.error('Error running scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run scheduler'
    });
  }
}
