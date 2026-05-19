// backend/src/services/POSuggestionService.ts
import { logger } from '../utils/logger';
import { getSharedPool } from '../utils/database-pool';
import { eventBus } from '../events/EventBus';

const pool = getSharedPool();

// ============================================================================
// INTERFACES
// ============================================================================

export interface POSuggestion {
  id: string;
  shopId: string;
  itemId: string;
  itemName: string;
  itemSku?: string;
  vendorId?: string;
  vendorName?: string;
  suggestedQuantity: number;
  currentStock: number;
  avgDailyUsage: number;
  daysUntilStockout?: number;
  daysOfSupply?: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  reason: string;
  estimatedStockoutDate?: Date;
  reorderPoint?: number;
  safetyStock?: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'ordered';
  createdAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  orderedAt?: Date;
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  purchaseOrderId?: string;
}

export interface SuggestionFilters {
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'ordered';
  minPriority?: number;
}

export interface UsageAnalytics {
  itemId: string;
  avgDailyUsage: number;
  stockQuantity: number;
  daysUntilStockout: number;
  suggestedQuantity: number;
  reorderPoint: number;
  safetyStock: number;
}

// ============================================================================
// PO SUGGESTION SERVICE
// ============================================================================

export class POSuggestionService {
  /**
   * Generate PO suggestions for a shop based on usage analytics
   */
  async generateSuggestions(shopId: string): Promise<POSuggestion[]> {
    try {
      logger.info(`Generating PO suggestions for shop ${shopId}`);

      // Step 1: Get items that need reordering (low stock or approaching stockout)
      const itemsNeedingReorder = await this.getItemsNeedingReorder(shopId);

      if (itemsNeedingReorder.length === 0) {
        logger.info(`No items need reordering for shop ${shopId}`);
        return [];
      }

      // Step 2: Calculate usage analytics for each item
      const suggestions: POSuggestion[] = [];

      for (const item of itemsNeedingReorder) {
        const analytics = await this.calculateUsageAnalytics(shopId, item);

        if (analytics.suggestedQuantity > 0) {
          const suggestion = await this.createSuggestion(shopId, item, analytics);
          suggestions.push(suggestion);
        }
      }

      logger.info(`Generated ${suggestions.length} PO suggestions for shop ${shopId}`);

      // Emit event
      eventBus.emit('inventory:suggestions_generated', {
        shopId,
        count: suggestions.length,
        timestamp: new Date(),
      });

      return suggestions;
    } catch (error) {
      logger.error('Error generating PO suggestions:', error);
      throw error;
    }
  }

  /**
   * Get items that are low on stock or approaching stockout
   */
  private async getItemsNeedingReorder(shopId: string): Promise<Array<{
    id: string;
    name: string;
    sku?: string;
    stock_quantity: number;
    low_stock_threshold: number;
    vendor_id?: string;
    vendor_name?: string;
    vendor_lead_time_days?: number;
    price: number;
    cost?: number;
  }>> {
    const query = `
      SELECT
        i.id,
        i.name,
        i.sku,
        i.stock_quantity,
        i.low_stock_threshold,
        i.vendor_id,
        i.price,
        i.cost,
        v.name as vendor_name,
        v.lead_time_days as vendor_lead_time_days
      FROM inventory_items i
      LEFT JOIN inventory_vendors v ON i.vendor_id = v.id
      WHERE i.shop_id = $1
        AND i.deleted_at IS NULL
        AND i.status != 'discontinued'
        AND (
          i.stock_quantity <= i.low_stock_threshold
          OR i.stock_quantity <= 10  -- Also consider items with very low stock
        )
      ORDER BY i.stock_quantity ASC, i.name ASC
    `;

    const result = await pool.query(query, [shopId]);
    return result.rows;
  }

  /**
   * Calculate usage analytics for an item
   */
  private async calculateUsageAnalytics(
    shopId: string,
    item: {
      id: string;
      stock_quantity: number;
      low_stock_threshold: number;
      vendor_lead_time_days?: number;
    }
  ): Promise<UsageAnalytics> {
    // Calculate average daily usage from last 30 days
    const usageQuery = `
      SELECT COALESCE(
        ABS(SUM(quantity_change)) / NULLIF(30, 0), 0
      ) as avg_daily_usage,
      COUNT(*) as transaction_count
      FROM inventory_adjustments
      WHERE item_id = $1 AND shop_id = $2
        AND adjustment_type IN ('sale', 'service_completion', 'damage', 'loss')
        AND created_at >= NOW() - INTERVAL '30 days'
        AND quantity_change < 0
    `;

    const usageResult = await pool.query(usageQuery, [item.id, shopId]);
    const avgDailyUsage = parseFloat(usageResult.rows[0]?.avg_daily_usage || '0');
    const transactionCount = parseInt(usageResult.rows[0]?.transaction_count || '0');

    // If no usage data, use threshold as baseline
    const effectiveUsage = avgDailyUsage > 0 ? avgDailyUsage : item.low_stock_threshold / 30;

    // Calculate days until stockout
    const daysUntilStockout = effectiveUsage > 0 ? item.stock_quantity / effectiveUsage : 999;

    // Calculate safety stock (7 days of usage or threshold, whichever is higher)
    const safetyStock = Math.max(
      Math.ceil(effectiveUsage * 7),
      item.low_stock_threshold
    );

    // Calculate reorder point (lead time + safety stock)
    const leadTimeDays = item.vendor_lead_time_days || 7;
    const reorderPoint = Math.ceil(effectiveUsage * leadTimeDays) + safetyStock;

    // Suggested quantity: 30-60 days of supply (default 45 days)
    let suggestedQuantity: number;

    if (transactionCount < 5) {
      // Not enough usage data: order threshold * 2
      suggestedQuantity = Math.max(item.low_stock_threshold * 2, 20);
    } else if (daysUntilStockout <= 7) {
      // Critical: 60 days supply
      suggestedQuantity = Math.ceil(effectiveUsage * 60);
    } else if (daysUntilStockout <= 15) {
      // High urgency: 45 days supply
      suggestedQuantity = Math.ceil(effectiveUsage * 45);
    } else {
      // Normal: 30 days supply
      suggestedQuantity = Math.ceil(effectiveUsage * 30);
    }

    // Ensure minimum order quantity
    suggestedQuantity = Math.max(suggestedQuantity, 10);

    return {
      itemId: item.id,
      avgDailyUsage: effectiveUsage,
      stockQuantity: item.stock_quantity,
      daysUntilStockout: Math.floor(daysUntilStockout),
      suggestedQuantity,
      reorderPoint,
      safetyStock,
    };
  }

  /**
   * Create a PO suggestion record
   */
  private async createSuggestion(
    shopId: string,
    item: {
      id: string;
      name: string;
      sku?: string;
      stock_quantity: number;
      vendor_id?: string;
      vendor_name?: string;
      vendor_lead_time_days?: number;
    },
    analytics: UsageAnalytics
  ): Promise<POSuggestion> {
    // Check if suggestion already exists for this item (pending status)
    const existingQuery = `
      SELECT id FROM purchase_order_suggestions
      WHERE shop_id = $1 AND item_id = $2
        AND status = 'pending'
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;

    const existingResult = await pool.query(existingQuery, [shopId, item.id]);

    if (existingResult.rows.length > 0) {
      logger.info(`Suggestion already exists for item ${item.id}, skipping`);
      // Return existing suggestion instead of creating duplicate
      return this.getSuggestionById(existingResult.rows[0].id);
    }

    // Calculate urgency
    const urgency = this.calculateUrgency(analytics.daysUntilStockout);

    // Calculate priority score (0-100)
    const priorityScore = this.calculatePriorityScore(
      analytics.daysUntilStockout,
      item.stock_quantity,
      analytics.avgDailyUsage
    );

    // Generate human-readable reason
    const reason = this.generateReason(item, analytics, urgency);

    // Calculate estimated stockout date
    const estimatedStockoutDate = analytics.daysUntilStockout < 999
      ? new Date(Date.now() + analytics.daysUntilStockout * 24 * 60 * 60 * 1000)
      : undefined;

    // Calculate days of supply for suggested quantity
    const daysOfSupply = analytics.avgDailyUsage > 0
      ? Math.floor(analytics.suggestedQuantity / analytics.avgDailyUsage)
      : undefined;

    // Insert suggestion
    const insertQuery = `
      INSERT INTO purchase_order_suggestions (
        shop_id, item_id, vendor_id,
        suggested_quantity, current_stock, avg_daily_usage,
        days_until_stockout, days_of_supply,
        urgency, priority_score, reason,
        estimated_stockout_date, reorder_point, safety_stock,
        status, created_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')
      RETURNING id, created_at, expires_at
    `;

    const result = await pool.query(insertQuery, [
      shopId,
      item.id,
      item.vendor_id || null,
      analytics.suggestedQuantity,
      item.stock_quantity,
      analytics.avgDailyUsage,
      analytics.daysUntilStockout < 999 ? analytics.daysUntilStockout : null,
      daysOfSupply || null,
      urgency,
      priorityScore,
      reason,
      estimatedStockoutDate || null,
      analytics.reorderPoint,
      analytics.safetyStock,
      'pending',
    ]);

    const suggestionId = result.rows[0].id;

    logger.info(`Created PO suggestion ${suggestionId} for item ${item.name}`);

    return {
      id: suggestionId,
      shopId,
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      vendorId: item.vendor_id,
      vendorName: item.vendor_name,
      suggestedQuantity: analytics.suggestedQuantity,
      currentStock: item.stock_quantity,
      avgDailyUsage: analytics.avgDailyUsage,
      daysUntilStockout: analytics.daysUntilStockout,
      daysOfSupply,
      urgency,
      priorityScore,
      reason,
      estimatedStockoutDate,
      reorderPoint: analytics.reorderPoint,
      safetyStock: analytics.safetyStock,
      status: 'pending',
      createdAt: result.rows[0].created_at,
      expiresAt: result.rows[0].expires_at,
    };
  }

  /**
   * Calculate urgency level based on days until stockout
   */
  private calculateUrgency(daysUntilStockout: number): 'low' | 'medium' | 'high' | 'critical' {
    if (daysUntilStockout <= 7) return 'critical';
    if (daysUntilStockout <= 15) return 'high';
    if (daysUntilStockout <= 30) return 'medium';
    return 'low';
  }

  /**
   * Calculate priority score (0-100)
   * Higher score = higher priority
   */
  private calculatePriorityScore(
    daysUntilStockout: number,
    currentStock: number,
    avgDailyUsage: number
  ): number {
    let score = 50; // Base score

    // Urgency factor (0-40 points)
    if (daysUntilStockout <= 3) score += 40;
    else if (daysUntilStockout <= 7) score += 30;
    else if (daysUntilStockout <= 14) score += 20;
    else if (daysUntilStockout <= 30) score += 10;

    // Stock level factor (0-30 points)
    if (currentStock === 0) score += 30;
    else if (currentStock <= 5) score += 20;
    else if (currentStock <= 10) score += 10;

    // Usage velocity factor (0-30 points)
    if (avgDailyUsage >= 10) score += 30;
    else if (avgDailyUsage >= 5) score += 20;
    else if (avgDailyUsage >= 1) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate human-readable reason for suggestion
   */
  private generateReason(
    item: { name: string; stock_quantity: number },
    analytics: UsageAnalytics,
    urgency: string
  ): string {
    const parts: string[] = [];

    // Stock status
    if (item.stock_quantity === 0) {
      parts.push('Item is out of stock');
    } else if (item.stock_quantity <= 5) {
      parts.push(`Only ${item.stock_quantity} units remaining`);
    } else {
      parts.push(`Current stock: ${item.stock_quantity} units`);
    }

    // Usage trend
    if (analytics.avgDailyUsage > 0) {
      parts.push(`Average usage: ${analytics.avgDailyUsage.toFixed(1)} units/day`);
    }

    // Stockout prediction
    if (analytics.daysUntilStockout < 999) {
      if (urgency === 'critical') {
        parts.push(`Will run out in ${analytics.daysUntilStockout} days`);
      } else {
        parts.push(`Estimated ${analytics.daysUntilStockout} days until stockout`);
      }
    }

    // Recommendation
    const daysOfSupply = Math.floor(analytics.suggestedQuantity / Math.max(analytics.avgDailyUsage, 1));
    parts.push(`Ordering ${analytics.suggestedQuantity} units provides ~${daysOfSupply} days of supply`);

    return parts.join('. ') + '.';
  }

  /**
   * Get suggestions for a shop with optional filtering
   */
  async getSuggestions(shopId: string, filters?: SuggestionFilters): Promise<POSuggestion[]> {
    try {
      let query = `
        SELECT
          s.*,
          i.name as item_name,
          i.sku as item_sku,
          v.name as vendor_name
        FROM purchase_order_suggestions s
        INNER JOIN inventory_items i ON s.item_id = i.id
        LEFT JOIN inventory_vendors v ON s.vendor_id = v.id
        WHERE s.shop_id = $1
      `;

      const params: Array<string | number> = [shopId];
      let paramIndex = 2;

      // Apply filters
      if (filters?.status) {
        query += ` AND s.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters?.urgency) {
        query += ` AND s.urgency = $${paramIndex}`;
        params.push(filters.urgency);
        paramIndex++;
      }

      if (filters?.minPriority !== undefined) {
        query += ` AND s.priority_score >= $${paramIndex}`;
        params.push(filters.minPriority);
        paramIndex++;
      }

      query += ` ORDER BY s.priority_score DESC, s.created_at DESC`;

      const result = await pool.query(query, params);

      return result.rows.map(this.mapRowToSuggestion);
    } catch (error) {
      logger.error('Error getting PO suggestions:', error);
      throw error;
    }
  }

  /**
   * Get a single suggestion by ID
   */
  private async getSuggestionById(id: string): Promise<POSuggestion> {
    const query = `
      SELECT
        s.*,
        i.name as item_name,
        i.sku as item_sku,
        v.name as vendor_name
      FROM purchase_order_suggestions s
      INNER JOIN inventory_items i ON s.item_id = i.id
      LEFT JOIN inventory_vendors v ON s.vendor_id = v.id
      WHERE s.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error(`Suggestion not found: ${id}`);
    }

    return this.mapRowToSuggestion(result.rows[0]);
  }

  /**
   * Approve a suggestion (optionally auto-create PO)
   */
  async approveSuggestion(
    suggestionId: string,
    userId: string,
    autoCreatePO: boolean = false
  ): Promise<{ suggestion: POSuggestion; purchaseOrderId?: string }> {
    try {
      // Update suggestion status
      const updateQuery = `
        UPDATE purchase_order_suggestions
        SET status = 'approved',
            approved_at = CURRENT_TIMESTAMP,
            approved_by = $2
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [suggestionId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Suggestion not found or already processed');
      }

      const suggestion = await this.getSuggestionById(suggestionId);

      logger.info(`Approved PO suggestion ${suggestionId} by ${userId}`);

      // Emit event
      eventBus.emit('inventory:suggestion_approved', {
        suggestionId,
        userId,
        itemId: suggestion.itemId,
        timestamp: new Date(),
      });

      // Auto-create PO if requested
      let purchaseOrderId: string | undefined;
      if (autoCreatePO && suggestion.vendorId) {
        purchaseOrderId = await this.createPOFromSuggestion(suggestion, userId);

        // Update suggestion with PO ID
        await pool.query(
          `UPDATE purchase_order_suggestions SET purchase_order_id = $1 WHERE id = $2`,
          [purchaseOrderId, suggestionId]
        );

        logger.info(`Auto-created PO ${purchaseOrderId} from suggestion ${suggestionId}`);
      }

      return { suggestion, purchaseOrderId };
    } catch (error) {
      logger.error('Error approving suggestion:', error);
      throw error;
    }
  }

  /**
   * Create a purchase order from an approved suggestion
   */
  private async createPOFromSuggestion(suggestion: POSuggestion, userId: string): Promise<string> {
    const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository').PurchaseOrderRepository;
    const poRepository = new PurchaseOrderRepository();

    // Get item details
    const itemQuery = `SELECT * FROM inventory_items WHERE id = $1`;
    const itemResult = await pool.query(itemQuery, [suggestion.itemId]);

    if (itemResult.rows.length === 0) {
      throw new Error(`Item not found: ${suggestion.itemId}`);
    }

    const item = itemResult.rows[0];

    // Get vendor details
    const vendorQuery = `SELECT * FROM inventory_vendors WHERE id = $1`;
    const vendorResult = await pool.query(vendorQuery, [suggestion.vendorId]);

    if (vendorResult.rows.length === 0) {
      throw new Error(`Vendor not found: ${suggestion.vendorId}`);
    }

    const vendor = vendorResult.rows[0];

    // Calculate expected delivery date based on lead time
    const expectedDeliveryDate = new Date();
    if (vendor.lead_time_days) {
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + vendor.lead_time_days);
    } else {
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7); // Default 7 days
    }

    // Create PO data
    const poData = {
      shopId: suggestion.shopId,
      vendorId: suggestion.vendorId,
      vendorName: vendor.name,
      orderDate: new Date(),
      expectedDeliveryDate,
      notes: `Auto-generated from PO suggestion. Reason: ${suggestion.reason}. Priority: ${suggestion.priorityScore}/100.`,
      createdBy: userId,
      items: [
        {
          inventoryItemId: suggestion.itemId,
          itemName: item.name,
          itemSku: item.sku || null,
          quantity: suggestion.suggestedQuantity,
          unitCost: item.cost || 0,
        },
      ],
    };

    // Create the PO
    const purchaseOrder = await poRepository.createPurchaseOrder(poData);

    return purchaseOrder.id;
  }

  /**
   * Reject a suggestion with reason
   */
  async rejectSuggestion(suggestionId: string, reason: string, userId: string): Promise<POSuggestion> {
    try {
      const updateQuery = `
        UPDATE purchase_order_suggestions
        SET status = 'rejected',
            rejected_at = CURRENT_TIMESTAMP,
            rejected_by = $2,
            rejection_reason = $3
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [suggestionId, userId, reason]);

      if (result.rows.length === 0) {
        throw new Error('Suggestion not found or already processed');
      }

      const suggestion = await this.getSuggestionById(suggestionId);

      logger.info(`Rejected PO suggestion ${suggestionId} by ${userId}: ${reason}`);

      // Emit event
      eventBus.emit('inventory:suggestion_rejected', {
        suggestionId,
        userId,
        reason,
        timestamp: new Date(),
      });

      return suggestion;
    } catch (error) {
      logger.error('Error rejecting suggestion:', error);
      throw error;
    }
  }

  /**
   * Expire old suggestions (run as scheduled task)
   */
  async expireOldSuggestions(): Promise<number> {
    try {
      const query = `
        UPDATE purchase_order_suggestions
        SET status = 'expired'
        WHERE status = 'pending'
          AND expires_at <= CURRENT_TIMESTAMP
        RETURNING id
      `;

      const result = await pool.query(query);
      const count = result.rows.length;

      if (count > 0) {
        logger.info(`Expired ${count} old PO suggestions`);
      }

      return count;
    } catch (error) {
      logger.error('Error expiring old suggestions:', error);
      throw error;
    }
  }

  /**
   * Map database row to POSuggestion object
   */
  private mapRowToSuggestion(row: any): POSuggestion {
    return {
      id: row.id,
      shopId: row.shop_id,
      itemId: row.item_id,
      itemName: row.item_name,
      itemSku: row.item_sku,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      suggestedQuantity: row.suggested_quantity,
      currentStock: row.current_stock,
      avgDailyUsage: parseFloat(row.avg_daily_usage),
      daysUntilStockout: row.days_until_stockout,
      daysOfSupply: row.days_of_supply,
      urgency: row.urgency,
      priorityScore: row.priority_score,
      reason: row.reason,
      estimatedStockoutDate: row.estimated_stockout_date,
      reorderPoint: row.reorder_point,
      safetyStock: row.safety_stock,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      approvedAt: row.approved_at,
      rejectedAt: row.rejected_at,
      orderedAt: row.ordered_at,
      rejectionReason: row.rejection_reason,
      approvedBy: row.approved_by,
      rejectedBy: row.rejected_by,
      purchaseOrderId: row.purchase_order_id,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let poSuggestionServiceInstance: POSuggestionService | null = null;

export function getPOSuggestionService(): POSuggestionService {
  if (!poSuggestionServiceInstance) {
    poSuggestionServiceInstance = new POSuggestionService();
  }
  return poSuggestionServiceInstance;
}
