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
   */
  async checkAndSendAlerts(): Promise<LowStockAlertResult[]> {
    logger.info('Starting low stock alert check...');
    const results: LowStockAlertResult[] = [];

    try {
      // Get all shops with email addresses and active subscriptions
      const shopsQuery = `
        SELECT
          s.shop_id,
          s.name,
          s.email,
          s.subscription_active
        FROM shops s
        WHERE s.email IS NOT NULL
          AND s.email != ''
          AND s.subscription_active = true
          AND s.operational_status = 'active'
          AND s.suspended_at IS NULL
      `;

      const shopsResult = await pool.query(shopsQuery);

      for (const shop of shopsResult.rows) {
        try {
          const result = await this.checkShopLowStock(
            shop.shop_id,
            shop.name,
            shop.email
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
   * Check a specific shop for low stock items and send alert if needed
   */
  async checkShopLowStock(
    shopId: string,
    shopName: string,
    shopEmail: string
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

      // Send email alert
      await this.sendLowStockEmail(shopEmail, shopName, itemsToAlert);

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
          items: itemsToAlert
        },
        timestamp: new Date()
      });

      logger.info(`Low stock alert sent to ${shopEmail} for ${itemsToAlert.length} items`);

      return {
        shopId,
        shopName,
        shopEmail,
        itemsCount: itemsToAlert.length,
        emailSent: true
      };
    } catch (error) {
      logger.error(`Error checking low stock for shop ${shopId}:`, error);
      throw error;
    }
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
