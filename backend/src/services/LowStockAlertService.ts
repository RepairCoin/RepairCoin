// backend/src/services/LowStockAlertService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { getSharedPool } from '../utils/database-pool';
import { eventBus } from '../events/EventBus';

const pool = getSharedPool();

export interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  shopId: string;
  shopName: string;
  shopEmail: string;
}

export interface LowStockAlertResult {
  shopId: string;
  shopName: string;
  shopEmail: string;
  itemsCount: number;
  emailSent: boolean;
  error?: string;
  digestMode?: string;
  skippedReason?: string;
}

export interface ShopDigestPreferences {
  shopId: string;
  digestMode: 'immediate' | 'daily' | 'weekly' | 'monthly';
  digestDayOfWeek?: number;
  digestDayOfMonth?: number;
  digestTime: string;
  lastDigestSentAt?: Date;
}

export interface ItemWithUsage {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  category_name?: string;
  averageUsagePerDay?: number;
  estimatedDaysUntilStockout?: number;
  suggestedOrderQuantity?: number;
}

export class LowStockAlertService {
  private emailService: EmailService;
  private lastAlertTimestamp: Map<string, Date> = new Map(); // Track last alert per item
  private readonly ALERT_COOLDOWN_HOURS = 24; // Don't send same alert more than once per 24 hours

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Check all shops for low stock items and send email alerts
   * Respects digest mode preferences
   */
  async checkAndSendAlerts(): Promise<LowStockAlertResult[]> {
    logger.info('Starting low stock alert check...');
    const results: LowStockAlertResult[] = [];

    try {
      // Get all shops with email addresses, active subscriptions, and digest preferences
      const shopsQuery = `
        SELECT
          s.shop_id,
          s.name,
          s.email,
          s.subscription_active,
          s.low_stock_alerts_enabled,
          s.low_stock_digest_mode,
          s.low_stock_digest_day_of_week,
          s.low_stock_digest_day_of_month,
          s.low_stock_digest_time,
          s.last_digest_sent_at
        FROM shops s
        WHERE s.email IS NOT NULL
          AND s.email != ''
          AND s.subscription_active = true
          AND s.operational_status = 'active'
          AND s.suspended_at IS NULL
          AND (s.low_stock_alerts_enabled IS NULL OR s.low_stock_alerts_enabled = true)
      `;

      const shopsResult = await pool.query(shopsQuery);

      for (const shop of shopsResult.rows) {
        try {
          const digestPrefs: ShopDigestPreferences = {
            shopId: shop.shop_id,
            digestMode: shop.low_stock_digest_mode || 'daily',
            digestDayOfWeek: shop.low_stock_digest_day_of_week,
            digestDayOfMonth: shop.low_stock_digest_day_of_month,
            digestTime: shop.low_stock_digest_time || '09:00',
            lastDigestSentAt: shop.last_digest_sent_at
          };

          // Check if digest should be sent based on preferences
          if (!this.shouldSendDigest(digestPrefs)) {
            results.push({
              shopId: shop.shop_id,
              shopName: shop.name,
              shopEmail: shop.email,
              itemsCount: 0,
              emailSent: false,
              digestMode: digestPrefs.digestMode,
              skippedReason: 'Not scheduled time for digest'
            });
            continue;
          }

          const result = await this.checkShopLowStock(
            shop.shop_id,
            shop.name,
            shop.email,
            digestPrefs
          );
          results.push(result);
        } catch (error) {
          logger.error(`Error checking low stock for shop ${shop.shop_id}:`, error);
          results.push({
            shopId: shop.shop_id,
            shopName: shop.name,
            shopEmail: shop.email,
            itemsCount: 0,
            emailSent: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(`Low stock alert check complete. Processed ${results.length} shops`);
      return results;
    } catch (error) {
      logger.error('Error in low stock alert service:', error);
      throw error;
    }
  }

  /**
   * Check if digest should be sent based on shop preferences
   */
  private shouldSendDigest(prefs: ShopDigestPreferences): boolean {
    const now = new Date();
    const lastSent = prefs.lastDigestSentAt;

    switch (prefs.digestMode) {
      case 'immediate':
        // Old behavior - send if 24h cooldown passed
        return true; // Cooldown handled in checkShopLowStock

      case 'daily':
        // Send if digest_time matches and not sent today
        return this.isScheduledTime(now, prefs.digestTime) &&
               !this.wasSentToday(lastSent);

      case 'weekly':
        // Send if it's the right day of week and time
        return now.getDay() === (prefs.digestDayOfWeek || 1) &&
               this.isScheduledTime(now, prefs.digestTime) &&
               !this.wasSentThisWeek(lastSent);

      case 'monthly':
        // Send if it's the right day of month and time
        return now.getDate() === (prefs.digestDayOfMonth || 1) &&
               this.isScheduledTime(now, prefs.digestTime) &&
               !this.wasSentThisMonth(lastSent);

      default:
        return true;
    }
  }

  /**
   * Check if current time matches scheduled digest time (within 1 hour window)
   */
  private isScheduledTime(now: Date, scheduledTime: string): boolean {
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const nowHours = now.getHours();
    const nowMinutes = now.getMinutes();

    // Check if within 1-hour window of scheduled time
    // (Scheduler runs every hour, so this gives some flexibility)
    return nowHours === hours;
  }

  /**
   * Check if digest was sent today
   */
  private wasSentToday(lastSent?: Date): boolean {
    if (!lastSent) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentDate = new Date(lastSent);
    sentDate.setHours(0, 0, 0, 0);

    return sentDate.getTime() === today.getTime();
  }

  /**
   * Check if digest was sent this week
   */
  private wasSentThisWeek(lastSent?: Date): boolean {
    if (!lastSent) return false;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const sentDate = new Date(lastSent);

    return sentDate >= startOfWeek;
  }

  /**
   * Check if digest was sent this month
   */
  private wasSentThisMonth(lastSent?: Date): boolean {
    if (!lastSent) return false;

    const now = new Date();
    const sentDate = new Date(lastSent);

    return now.getMonth() === sentDate.getMonth() &&
           now.getFullYear() === sentDate.getFullYear();
  }

  /**
   * Check a specific shop for low stock items and send alert if needed
   */
  async checkShopLowStock(
    shopId: string,
    shopName: string,
    shopEmail: string,
    digestPrefs?: ShopDigestPreferences
  ): Promise<LowStockAlertResult> {
    try {
      // Query low stock items
      const query = `
        SELECT
          i.id,
          i.name,
          i.sku,
          i.stock_quantity,
          i.low_stock_threshold,
          c.name as category_name
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON i.category_id = c.id
        WHERE i.shop_id = $1
          AND i.deleted_at IS NULL
          AND i.status IN ('low_stock', 'out_of_stock')
          AND (
            i.stock_quantity <= i.low_stock_threshold
            OR i.stock_quantity = 0
          )
        ORDER BY i.stock_quantity ASC, i.name ASC
      `;

      const result = await pool.query(query, [shopId]);
      const lowStockItems = result.rows;

      if (lowStockItems.length === 0) {
        return {
          shopId,
          shopName,
          shopEmail,
          itemsCount: 0,
          emailSent: false
        };
      }

      // Filter out items that were alerted recently (cooldown period)
      const itemsToAlert = lowStockItems.filter(item => {
        const lastAlert = this.lastAlertTimestamp.get(`${shopId}:${item.id}`);
        if (!lastAlert) return true;

        const hoursSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastAlert >= this.ALERT_COOLDOWN_HOURS;
      });

      if (itemsToAlert.length === 0) {
        logger.info(`Shop ${shopId} has ${lowStockItems.length} low stock items, but all were alerted recently`);
        return {
          shopId,
          shopName,
          shopEmail,
          itemsCount: lowStockItems.length,
          emailSent: false
        };
      }

      // If digest mode is enabled (not immediate), send digest with usage analytics
      const isDigestMode = digestPrefs && digestPrefs.digestMode !== 'immediate';

      if (isDigestMode) {
        // Get usage analytics for all items
        const itemsWithUsage = await this.getItemsWithUsage(itemsToAlert, shopId);
        await this.sendDigestEmail(shopEmail, shopName, itemsWithUsage, digestPrefs!.digestMode);

        // Update last digest sent timestamp in database
        await pool.query(
          'UPDATE shops SET last_digest_sent_at = NOW() WHERE shop_id = $1',
          [shopId]
        );
      } else {
        // Send immediate alert (original behavior)
        await this.sendLowStockEmail(shopEmail, shopName, itemsToAlert);
      }

      // Update alert timestamps
      itemsToAlert.forEach(item => {
        this.lastAlertTimestamp.set(`${shopId}:${item.id}`, new Date());
      });

      // Emit event for notification system
      eventBus.publish({
        type: 'inventory:low_stock_alert',
        aggregateId: shopId,
        source: 'InventoryDomain',
        version: 1,
        data: {
          shopId,
          shopName,
          shopEmail,
          itemsCount: itemsToAlert.length,
          items: itemsToAlert,
          digestMode: digestPrefs?.digestMode || 'immediate'
        },
        timestamp: new Date()
      });

      logger.info(`Low stock alert sent to ${shopEmail} for ${itemsToAlert.length} items (mode: ${digestPrefs?.digestMode || 'immediate'})`);

      return {
        shopId,
        shopName,
        shopEmail,
        itemsCount: itemsToAlert.length,
        emailSent: true,
        digestMode: digestPrefs?.digestMode || 'immediate'
      };
    } catch (error) {
      logger.error(`Error checking low stock for shop ${shopId}:`, error);
      throw error;
    }
  }

  /**
   * Get usage analytics for items
   */
  private async getItemsWithUsage(
    items: Array<{id: string; name: string; sku: string; stock_quantity: number; low_stock_threshold: number; category_name?: string}>,
    shopId: string
  ): Promise<ItemWithUsage[]> {
    const itemsWithUsage: ItemWithUsage[] = [];

    for (const item of items) {
      // Calculate average usage per day (last 30 days)
      const usageQuery = `
        SELECT
          COALESCE(
            ABS(SUM(quantity_change)) / NULLIF(30, 0),
            0
          ) as avg_daily_usage
        FROM inventory_adjustments
        WHERE item_id = $1
          AND shop_id = $2
          AND adjustment_type IN ('sale', 'service_completion', 'damage', 'loss')
          AND created_at >= NOW() - INTERVAL '30 days'
          AND quantity_change < 0
      `;

      const usageResult = await pool.query(usageQuery, [item.id, shopId]);
      const avgUsage = parseFloat(usageResult.rows[0]?.avg_daily_usage || '0');

      // Calculate estimated days until stockout
      const daysUntilStockout = avgUsage > 0 ? item.stock_quantity / avgUsage : 999;

      // Suggested order quantity: 30 days supply (or double threshold, whichever is larger)
      const suggestedQty = Math.max(
        Math.ceil(avgUsage * 30),
        item.low_stock_threshold * 2
      );

      itemsWithUsage.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        stock_quantity: item.stock_quantity,
        low_stock_threshold: item.low_stock_threshold,
        category_name: item.category_name,
        averageUsagePerDay: avgUsage,
        estimatedDaysUntilStockout: daysUntilStockout,
        suggestedOrderQuantity: suggestedQty
      });
    }

    return itemsWithUsage;
  }

  /**
   * Send digest email with usage analytics
   */
  private async sendDigestEmail(
    shopEmail: string,
    shopName: string,
    items: ItemWithUsage[],
    digestMode: string
  ): Promise<void> {
    const outOfStockItems = items.filter(item => item.stock_quantity === 0);
    const criticalItems = items.filter(item => item.stock_quantity > 0 && item.stock_quantity <= item.low_stock_threshold * 0.5);
    const lowStockItems = items.filter(item => item.stock_quantity > item.low_stock_threshold * 0.5 && item.stock_quantity <= item.low_stock_threshold);

    const digestLabel = digestMode.charAt(0).toUpperCase() + digestMode.slice(1);
    const subject = `📦 ${digestLabel} Inventory Digest - ${items.length} ${items.length === 1 ? 'Item Needs' : 'Items Need'} Attention`;

    const itemsHtml = items.map(item => {
      const urgencyClass = item.stock_quantity === 0 ? 'critical' :
                          item.stock_quantity <= item.low_stock_threshold * 0.5 ? 'warning' : 'low';

      const statusBadge = item.stock_quantity === 0
        ? '<span style="background: #EF4444; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">OUT OF STOCK</span>'
        : item.stock_quantity <= item.low_stock_threshold * 0.5
        ? '<span style="background: #F59E0B; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">CRITICAL LOW</span>'
        : '<span style="background: #EAB308; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">LOW STOCK</span>';

      return `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 14px 10px;">
            <div style="font-weight: 600; color: #111827; font-size: 14px;">${item.name}</div>
            ${item.sku ? `<div style="font-size: 12px; color: #6B7280; margin-top: 3px;">SKU: ${item.sku}</div>` : ''}
            ${item.category_name ? `<div style="font-size: 12px; color: #6B7280;">Category: ${item.category_name}</div>` : ''}
          </td>
          <td style="padding: 14px 10px; text-align: center;">
            <span style="font-weight: 700; font-size: 16px; color: ${item.stock_quantity === 0 ? '#EF4444' : item.stock_quantity <= item.low_stock_threshold * 0.5 ? '#F59E0B' : '#EAB308'};">${item.stock_quantity}</span>
          </td>
          <td style="padding: 14px 10px; text-align: center;">
            <span style="color: #6B7280; font-size: 14px;">${item.averageUsagePerDay?.toFixed(1) || '0.0'}</span>
          </td>
          <td style="padding: 14px 10px; text-align: center;">
            <span style="color: ${item.estimatedDaysUntilStockout! < 7 ? '#EF4444' : '#6B7280'}; font-size: 14px; font-weight: ${item.estimatedDaysUntilStockout! < 7 ? '600' : '400'};">
              ${item.estimatedDaysUntilStockout! > 100 ? '99+' : Math.round(item.estimatedDaysUntilStockout!)} days
            </span>
          </td>
          <td style="padding: 14px 10px; text-align: center;">
            <div style="background: #DBEAFE; padding: 6px 10px; border-radius: 4px; display: inline-block;">
              <span style="color: #1E40AF; font-weight: 600; font-size: 13px;">📦 ${item.suggestedOrderQuantity} units</span>
            </div>
          </td>
          <td style="padding: 14px 10px; text-align: center;">
            ${statusBadge}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); padding: 35px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">📦 ${digestLabel} Inventory Digest</h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">RepairCoin Inventory Management</p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 17px;">
        Hi <strong>${shopName}</strong>,
      </p>

      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.7;">
        Your ${digestMode} inventory digest shows <strong style="color: #EF4444;">${items.length} ${items.length === 1 ? 'item' : 'items'}</strong>
        requiring attention. Here's a summary with recommended actions:
      </p>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
        ${outOfStockItems.length > 0 ? `
          <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 14px; border-radius: 6px;">
            <div style="color: #991B1B; font-size: 24px; font-weight: 700; margin-bottom: 4px;">${outOfStockItems.length}</div>
            <div style="color: #7F1D1D; font-size: 12px; font-weight: 500;">OUT OF STOCK</div>
          </div>
        ` : ''}
        ${criticalItems.length > 0 ? `
          <div style="background: #FED7AA; border-left: 4px solid #F59E0B; padding: 14px; border-radius: 6px;">
            <div style="color: #92400E; font-size: 24px; font-weight: 700; margin-bottom: 4px;">${criticalItems.length}</div>
            <div style="color: #78350F; font-size: 12px; font-weight: 500;">CRITICAL LOW</div>
          </div>
        ` : ''}
        ${lowStockItems.length > 0 ? `
          <div style="background: #FEF3C7; border-left: 4px solid #EAB308; padding: 14px; border-radius: 6px;">
            <div style="color: #854D0E; font-size: 24px; font-weight: 700; margin-bottom: 4px;">${lowStockItems.length}</div>
            <div style="color: #713F12; font-size: 12px; font-weight: 500;">LOW STOCK</div>
          </div>
        ` : ''}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 2px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
        <thead>
          <tr style="background: #F9FAFB;">
            <th style="padding: 14px 10px; text-align: left; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
            <th style="padding: 14px 10px; text-align: center; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Stock</th>
            <th style="padding: 14px 10px; text-align: center; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Avg Usage/Day</th>
            <th style="padding: 14px 10px; text-align: center; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Days Left</th>
            <th style="padding: 14px 10px; text-align: center; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Suggested Order</th>
            <th style="padding: 14px 10px; text-align: center; font-weight: 700; color: #374151; font-size: 13px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-left: 5px solid #3B82F6; padding: 20px; margin: 28px 0; border-radius: 8px;">
        <p style="margin: 0 0 12px 0; color: #1E40AF; font-weight: 700; font-size: 15px;">💡 Smart Recommendations:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1E3A8A; font-size: 14px; line-height: 2;">
          <li>Order quantities are based on your last 30 days of usage patterns</li>
          <li>Items marked "Critical Low" should be reordered immediately</li>
          <li>Consider creating purchase orders for items running out in < 7 days</li>
          <li>Review your low stock thresholds for frequently used items</li>
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 35px 0 25px 0;">
        <a href="https://repaircoin.ai/shop/inventory"
           style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">
          View Full Inventory Dashboard →
        </a>
      </div>

      <p style="margin: 25px 0 0 0; color: #9CA3AF; font-size: 13px; line-height: 1.6; text-align: center;">
        This ${digestMode} digest was automatically generated based on your inventory levels and usage patterns.
        You can adjust digest frequency and timing in your inventory settings.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 25px; color: #9CA3AF; font-size: 12px;">
      <p style="margin: 0 0 8px 0; font-weight: 500;">RepairCoin - Smart Inventory Management</p>
      <p style="margin: 0;">
        <a href="https://repaircoin.ai" style="color: #6366F1; text-decoration: none; font-weight: 600;">repaircoin.ai</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await (this.emailService as any).sendEmail(shopEmail, subject, html);
    logger.info(`Digest email sent to ${shopEmail} for shop ${shopName} (${digestMode} mode)`);
  }

  /**
   * Send low stock alert email
   */
  private async sendLowStockEmail(
    shopEmail: string,
    shopName: string,
    items: Array<{
      id: string;
      name: string;
      sku: string;
      stock_quantity: number;
      low_stock_threshold: number;
      category_name?: string;
    }>
  ): Promise<void> {
    const outOfStockItems = items.filter(item => item.stock_quantity === 0);
    const lowStockItems = items.filter(item => item.stock_quantity > 0);

    const subject = `⚠️ Low Stock Alert - ${items.length} ${items.length === 1 ? 'Item Needs' : 'Items Need'} Attention`;

    const itemsHtml = items.map(item => {
      const statusBadge = item.stock_quantity === 0
        ? '<span style="background: #EF4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">OUT OF STOCK</span>'
        : '<span style="background: #F59E0B; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">LOW STOCK</span>';

      return `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px 8px;">
            <div style="font-weight: 500; color: #111827;">${item.name}</div>
            ${item.sku ? `<div style="font-size: 12px; color: #6B7280; margin-top: 2px;">SKU: ${item.sku}</div>` : ''}
            ${item.category_name ? `<div style="font-size: 12px; color: #6B7280;">Category: ${item.category_name}</div>` : ''}
          </td>
          <td style="padding: 12px 8px; text-align: center;">
            <span style="font-weight: 600; color: ${item.stock_quantity === 0 ? '#EF4444' : '#F59E0B'};">${item.stock_quantity}</span>
          </td>
          <td style="padding: 12px 8px; text-align: center;">
            <span style="color: #6B7280;">${item.low_stock_threshold}</span>
          </td>
          <td style="padding: 12px 8px; text-align: center;">
            ${statusBadge}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FFCC00 0%, #FFB800 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; color: #1A1A1A; font-size: 24px; font-weight: 700;">⚠️ Low Stock Alert</h1>
      <p style="margin: 8px 0 0 0; color: #1A1A1A; font-size: 14px;">RepairCoin Inventory Management</p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px;">
        Hi <strong>${shopName}</strong>,
      </p>

      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        You have <strong style="color: #EF4444;">${items.length} ${items.length === 1 ? 'item' : 'items'}</strong>
        ${items.length === 1 ? 'that is' : 'that are'} running low on stock or out of stock:
      </p>

      ${outOfStockItems.length > 0 ? `
        <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0; color: #991B1B; font-weight: 500;">
            🚨 ${outOfStockItems.length} ${outOfStockItems.length === 1 ? 'item is' : 'items are'} completely out of stock
          </p>
        </div>
      ` : ''}

      ${lowStockItems.length > 0 ? `
        <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0; color: #92400E; font-weight: 500;">
            ⚠️ ${lowStockItems.length} ${lowStockItems.length === 1 ? 'item is' : 'items are'} below the low stock threshold
          </p>
        </div>
      ` : ''}

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #F9FAFB;">
            <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 2px solid #E5E7EB;">Item</th>
            <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 2px solid #E5E7EB;">Current Stock</th>
            <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 2px solid #E5E7EB;">Threshold</th>
            <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 2px solid #E5E7EB;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; color: #1E40AF; font-weight: 600; font-size: 14px;">💡 Recommended Actions:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1E3A8A; font-size: 14px; line-height: 1.8;">
          <li>Review your inventory and reorder items before they run out</li>
          <li>Consider adjusting low stock thresholds for frequently used items</li>
          <li>Check if any services are linked to out-of-stock items</li>
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0 20px 0;">
        <a href="https://repaircoin.ai/shop/inventory"
           style="display: inline-block; background: #FFCC00; color: #1A1A1A; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          View Inventory Dashboard
        </a>
      </div>

      <p style="margin: 20px 0 0 0; color: #6B7280; font-size: 14px; line-height: 1.6;">
        This alert was sent because your inventory items have reached or fallen below their low stock thresholds.
        You can adjust these settings in your inventory management dashboard.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">RepairCoin - Smart Inventory Management</p>
      <p style="margin: 0;">
        <a href="https://repaircoin.ai" style="color: #FFCC00; text-decoration: none;">repaircoin.ai</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Use type assertion to access the private sendEmail method
    await (this.emailService as any).sendEmail(shopEmail, subject, html);

    logger.info(`Low stock email sent to ${shopEmail} for shop ${shopName}`);
  }

  /**
   * Manually trigger low stock check for a specific shop
   */
  async checkShopNow(shopId: string): Promise<LowStockAlertResult> {
    const shopQuery = `
      SELECT name, email
      FROM shops
      WHERE shop_id = $1
        AND email IS NOT NULL
        AND email != ''
    `;

    const result = await pool.query(shopQuery, [shopId]);

    if (result.rows.length === 0) {
      throw new Error('Shop not found or has no email address');
    }

    const shop = result.rows[0];
    return await this.checkShopLowStock(shopId, shop.name, shop.email);
  }

  /**
   * Clear alert cooldown for testing purposes
   */
  clearAlertCooldown(shopId?: string, itemId?: string): void {
    if (shopId && itemId) {
      this.lastAlertTimestamp.delete(`${shopId}:${itemId}`);
    } else if (shopId) {
      // Clear all alerts for a shop
      for (const key of this.lastAlertTimestamp.keys()) {
        if (key.startsWith(`${shopId}:`)) {
          this.lastAlertTimestamp.delete(key);
        }
      }
    } else {
      // Clear all
      this.lastAlertTimestamp.clear();
    }
  }
}

// Singleton instance
let lowStockAlertService: LowStockAlertService | null = null;

export function getLowStockAlertService(): LowStockAlertService {
  if (!lowStockAlertService) {
    lowStockAlertService = new LowStockAlertService();
  }
  return lowStockAlertService;
}
