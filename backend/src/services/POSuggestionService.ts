// backend/src/services/POSuggestionService.ts
import { logger } from '../utils/logger';
import { getSharedPool } from '../utils/database-pool';
import { eventBus, createDomainEvent } from '../events/EventBus';

const pool = getSharedPool();

// ============================================================================
// INTERFACES
// ============================================================================

export interface VendorComparison {
  vendorId: string;
  vendorName: string;
  unitCost: number;
  totalCost: number;
  leadTimeDays: number;
  estimatedDeliveryDate: Date;
  historicalPerformanceScore?: number; // 0-100, based on past order reliability
  isPreferred: boolean;
  isBestValue: boolean; // Lowest cost
  isFastestDelivery: boolean; // Shortest lead time
  notes?: string;
}

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
  // NEW: Vendor comparison data
  vendorComparisons?: VendorComparison[];
  recommendedVendorId?: string; // Best vendor based on cost, lead time, and performance
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
      await eventBus.publish(createDomainEvent(
        'inventory:suggestions_generated',
        shopId,
        { shopId, count: suggestions.length },
        'POSuggestionService'
      ));

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
    // Check if suggestion already exists for this item
    // 1. Pending suggestions that haven't expired
    // 2. Approved suggestions from last 7 days (without PO or with pending PO)
    // 3. Approved suggestions that have a PO created
    const existingQuery = `
      SELECT id, status, purchase_order_id FROM purchase_order_suggestions
      WHERE shop_id = $1 AND item_id = $2
        AND (
          (status = 'pending' AND expires_at > CURRENT_TIMESTAMP)
          OR (status = 'approved' AND approved_at > CURRENT_TIMESTAMP - INTERVAL '7 days')
          OR (status = 'approved' AND purchase_order_id IS NOT NULL)
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const existingResult = await pool.query(existingQuery, [shopId, item.id]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      if (existing.status === 'approved' && existing.purchase_order_id) {
        logger.info(`Approved suggestion with PO already exists for item ${item.id}, skipping`);
      } else if (existing.status === 'approved') {
        logger.info(`Recently approved suggestion exists for item ${item.id}, skipping`);
      } else {
        logger.info(`Pending suggestion already exists for item ${item.id}, skipping`);
      }

      // Return existing suggestion instead of creating duplicate
      return this.getSuggestionById(existing.id);
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

    // Get vendor comparisons for this item
    const vendorComparisons = await this.getVendorComparisonsForItem(
      shopId,
      item.id,
      analytics.suggestedQuantity
    );

    // Get recommended vendor
    const recommendedVendorId = vendorComparisons.length > 0
      ? this.getRecommendedVendor(vendorComparisons)
      : item.vendor_id;

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
      // NEW: Vendor comparison data
      vendorComparisons: vendorComparisons.length > 0 ? vendorComparisons : undefined,
      recommendedVendorId,
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
      await eventBus.publish(createDomainEvent(
        'inventory:suggestion_approved',
        suggestionId,
        { suggestionId, userId, itemId: suggestion.itemId },
        'POSuggestionService'
      ));

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
      await eventBus.publish(createDomainEvent(
        'inventory:suggestion_rejected',
        suggestionId,
        { suggestionId, userId, reason },
        'POSuggestionService'
      ));

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
   * Get vendor comparisons for an item
   * Compares all vendors that can supply this item
   */
  async getVendorComparisonsForItem(
    shopId: string,
    itemId: string,
    suggestedQuantity: number
  ): Promise<VendorComparison[]> {
    try {
      // Get all possible vendors for this item
      // We'll check: 1) Assigned vendor, 2) Vendors that have supplied this item before
      const vendorsQuery = `
        SELECT DISTINCT
          v.id as vendor_id,
          v.name as vendor_name,
          v.lead_time_days,
          v.preferred,
          i.cost as unit_cost
        FROM inventory_vendors v
        LEFT JOIN inventory_items i ON i.vendor_id = v.id AND i.id = $1
        WHERE v.shop_id = $2
          AND v.deleted_at IS NULL
          AND v.status = 'active'
          AND (
            i.id IS NOT NULL  -- This vendor is assigned to the item
            OR EXISTS (       -- Or this vendor has supplied this item before
              SELECT 1 FROM purchase_orders po
              INNER JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
              WHERE po.vendor_id = v.id AND poi.inventory_item_id = $1
            )
          )
        ORDER BY v.preferred DESC, v.name ASC
      `;

      const vendorsResult = await pool.query(vendorsQuery, [itemId, shopId]);

      if (vendorsResult.rows.length === 0) {
        return [];
      }

      const comparisons: VendorComparison[] = [];

      for (const vendorRow of vendorsResult.rows) {
        const unitCost = parseFloat(vendorRow.unit_cost || 0);
        const totalCost = unitCost * suggestedQuantity;
        const leadTimeDays = vendorRow.lead_time_days || 7;

        // Calculate estimated delivery date
        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + leadTimeDays);

        // Get historical performance score
        const performanceScore = await this.calculateVendorPerformanceScore(
          shopId,
          vendorRow.vendor_id
        );

        comparisons.push({
          vendorId: vendorRow.vendor_id,
          vendorName: vendorRow.vendor_name,
          unitCost,
          totalCost,
          leadTimeDays,
          estimatedDeliveryDate,
          historicalPerformanceScore: performanceScore,
          isPreferred: vendorRow.preferred,
          isBestValue: false, // Will be set below
          isFastestDelivery: false, // Will be set below
        });
      }

      // Mark best value (lowest total cost)
      const lowestCost = Math.min(...comparisons.map(c => c.totalCost));
      comparisons.forEach(c => {
        if (c.totalCost === lowestCost) c.isBestValue = true;
      });

      // Mark fastest delivery (shortest lead time)
      const shortestLeadTime = Math.min(...comparisons.map(c => c.leadTimeDays));
      comparisons.forEach(c => {
        if (c.leadTimeDays === shortestLeadTime) c.isFastestDelivery = true;
      });

      // Sort by recommendation priority:
      // 1. Preferred vendors first
      // 2. Best value
      // 3. Fastest delivery
      // 4. Highest performance score
      comparisons.sort((a, b) => {
        if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
        if (a.isBestValue !== b.isBestValue) return a.isBestValue ? -1 : 1;
        if (a.isFastestDelivery !== b.isFastestDelivery) return a.isFastestDelivery ? -1 : 1;
        return (b.historicalPerformanceScore || 0) - (a.historicalPerformanceScore || 0);
      });

      return comparisons;
    } catch (error) {
      logger.error('Error getting vendor comparisons:', error);
      return [];
    }
  }

  /**
   * Calculate historical performance score for a vendor (0-100)
   * Based on: on-time delivery, order completion rate, and quality issues
   */
  private async calculateVendorPerformanceScore(
    shopId: string,
    vendorId: string
  ): Promise<number> {
    try {
      const query = `
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'received' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'received' AND received_date <= expected_delivery_date THEN 1 END) as on_time_deliveries,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
        FROM purchase_orders
        WHERE shop_id = $1
          AND vendor_id = $2
          AND created_at >= NOW() - INTERVAL '12 months'  -- Last 12 months
      `;

      const result = await pool.query(query, [shopId, vendorId]);
      const stats = result.rows[0];

      const totalOrders = parseInt(stats.total_orders || '0');

      // Not enough data
      if (totalOrders < 3) {
        return 70; // Neutral score for new vendors
      }

      const completedOrders = parseInt(stats.completed_orders || '0');
      const onTimeDeliveries = parseInt(stats.on_time_deliveries || '0');
      const cancelledOrders = parseInt(stats.cancelled_orders || '0');

      // Calculate metrics
      const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 0;
      const onTimeRate = completedOrders > 0 ? onTimeDeliveries / completedOrders : 0;
      const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;

      // Score calculation (0-100)
      let score = 50; // Base score

      // Completion rate (0-30 points)
      score += completionRate * 30;

      // On-time delivery rate (0-40 points)
      score += onTimeRate * 40;

      // Penalty for cancellations (up to -20 points)
      score -= cancellationRate * 20;

      // Ensure score is between 0-100
      return Math.max(0, Math.min(100, Math.round(score)));
    } catch (error) {
      logger.error('Error calculating vendor performance score:', error);
      return 70; // Default neutral score
    }
  }

  /**
   * Get recommended vendor ID based on comparisons
   * Priority: 1) Preferred, 2) Best value with good performance, 3) Fastest delivery
   */
  private getRecommendedVendor(comparisons: VendorComparison[]): string | undefined {
    if (comparisons.length === 0) return undefined;

    // First check for preferred vendor
    const preferred = comparisons.find(c => c.isPreferred);
    if (preferred) return preferred.vendorId;

    // Then check for best value with decent performance (>60)
    const bestValueGoodPerformance = comparisons.find(
      c => c.isBestValue && (c.historicalPerformanceScore || 0) >= 60
    );
    if (bestValueGoodPerformance) return bestValueGoodPerformance.vendorId;

    // Otherwise, just pick the first one (highest priority from sorting)
    return comparisons[0].vendorId;
  }

  /**
   * Assess the accuracy of a suggestion
   * Mark whether the suggestion correctly identified a need
   */
  async assessSuggestionAccuracy(
    suggestionId: string,
    wasAccurate: boolean,
    notes: string,
    actualQuantityOrdered?: number,
    orderTimingDaysOffset?: number
  ): Promise<void> {
    try {
      // Get the suggestion details
      const suggestion = await this.getSuggestionById(suggestionId);

      // Calculate accuracy score (0-100)
      let score = 0;

      // Base accuracy (0-40 points): Was the suggestion actually needed?
      if (wasAccurate) {
        score += 40;
      }

      // Quantity accuracy (0-30 points): How close was the suggested quantity?
      if (actualQuantityOrdered && suggestion.suggestedQuantity > 0) {
        const quantityRatio = actualQuantityOrdered / suggestion.suggestedQuantity;
        // Perfect if within ±20%
        if (quantityRatio >= 0.8 && quantityRatio <= 1.2) {
          score += 30;
        } else if (quantityRatio >= 0.6 && quantityRatio <= 1.4) {
          score += 20;
        } else if (quantityRatio >= 0.4 && quantityRatio <= 1.6) {
          score += 10;
        }
      } else if (wasAccurate) {
        // If no quantity data but was accurate, give partial credit
        score += 15;
      }

      // Timing accuracy (0-30 points): Was it ordered within the suggested window?
      if (orderTimingDaysOffset !== undefined) {
        const absOffset = Math.abs(orderTimingDaysOffset);
        if (absOffset <= 2) {
          score += 30; // Ordered within 2 days of suggestion
        } else if (absOffset <= 7) {
          score += 20; // Within a week
        } else if (absOffset <= 14) {
          score += 10; // Within two weeks
        }
      } else if (wasAccurate) {
        // If no timing data but was accurate, give partial credit
        score += 15;
      }

      // Update the suggestion with accuracy assessment
      const updateQuery = `
        UPDATE purchase_order_suggestions
        SET
          was_accurate = $1,
          actual_need_assessment_date = CURRENT_TIMESTAMP,
          actual_need_assessment_notes = $2,
          suggestion_accuracy_score = $3
        WHERE id = $4
      `;

      await pool.query(updateQuery, [wasAccurate, notes, score, suggestionId]);

      logger.info(`Assessed suggestion ${suggestionId} accuracy: ${wasAccurate} (score: ${score})`);

      // Trigger metrics recalculation for the shop
      await this.updateAccuracyMetrics(suggestion.shopId);

      // Emit event
      await eventBus.publish(createDomainEvent(
        'inventory:suggestion_accuracy_assessed',
        suggestionId,
        { suggestionId, wasAccurate, score, shopId: suggestion.shopId },
        'POSuggestionService'
      ));
    } catch (error) {
      logger.error('Error assessing suggestion accuracy:', error);
      throw error;
    }
  }

  /**
   * Get accuracy metrics for a shop over a specific period
   */
  async getAccuracyMetrics(
    shopId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    totalSuggestions: number;
    approvedSuggestions: number;
    rejectedSuggestions: number;
    expiredSuggestions: number;
    suggestionsWithPO: number;
    accurateSuggestions: number;
    inaccurateSuggestions: number;
    pendingAssessment: number;
    averageAccuracyScore: number;
    trend: 'improving' | 'stable' | 'declining';
  }> {
    try {
      // Get metrics for current period
      const currentMetricsQuery = `
        SELECT
          COUNT(*) as total_suggestions,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_suggestions,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_suggestions,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_suggestions,
          COUNT(CASE WHEN purchase_order_id IS NOT NULL THEN 1 END) as suggestions_with_po,
          COUNT(CASE WHEN was_accurate = true THEN 1 END) as accurate_suggestions,
          COUNT(CASE WHEN was_accurate = false THEN 1 END) as inaccurate_suggestions,
          COUNT(CASE WHEN was_accurate IS NULL THEN 1 END) as pending_assessment,
          COALESCE(AVG(suggestion_accuracy_score), 0) as average_accuracy_score
        FROM purchase_order_suggestions
        WHERE shop_id = $1
          AND created_at >= $2
          AND created_at <= $3
      `;

      const currentResult = await pool.query(currentMetricsQuery, [
        shopId,
        periodStart,
        periodEnd,
      ]);

      const currentMetrics = currentResult.rows[0];

      // Get previous period metrics for trend calculation
      const periodDuration = periodEnd.getTime() - periodStart.getTime();
      const prevPeriodStart = new Date(periodStart.getTime() - periodDuration);
      const prevPeriodEnd = periodStart;

      const prevMetricsQuery = `
        SELECT COALESCE(AVG(suggestion_accuracy_score), 0) as average_accuracy_score
        FROM purchase_order_suggestions
        WHERE shop_id = $1
          AND created_at >= $2
          AND created_at < $3
          AND suggestion_accuracy_score IS NOT NULL
      `;

      const prevResult = await pool.query(prevMetricsQuery, [
        shopId,
        prevPeriodStart,
        prevPeriodEnd,
      ]);

      const prevAvgScore = parseFloat(prevResult.rows[0]?.average_accuracy_score || '0');
      const currentAvgScore = parseFloat(currentMetrics.average_accuracy_score);

      // Determine trend
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (prevAvgScore > 0) {
        const scoreDiff = currentAvgScore - prevAvgScore;
        if (scoreDiff > 5) trend = 'improving';
        else if (scoreDiff < -5) trend = 'declining';
      }

      return {
        totalSuggestions: parseInt(currentMetrics.total_suggestions),
        approvedSuggestions: parseInt(currentMetrics.approved_suggestions),
        rejectedSuggestions: parseInt(currentMetrics.rejected_suggestions),
        expiredSuggestions: parseInt(currentMetrics.expired_suggestions),
        suggestionsWithPO: parseInt(currentMetrics.suggestions_with_po),
        accurateSuggestions: parseInt(currentMetrics.accurate_suggestions),
        inaccurateSuggestions: parseInt(currentMetrics.inaccurate_suggestions),
        pendingAssessment: parseInt(currentMetrics.pending_assessment),
        averageAccuracyScore: currentAvgScore,
        trend,
      };
    } catch (error) {
      logger.error('Error getting accuracy metrics:', error);
      throw error;
    }
  }

  /**
   * Auto-assess expired suggestions
   * Run this as a scheduled task (e.g., weekly)
   */
  async autoAssessSuggestionAccuracy(): Promise<number> {
    try {
      // Find expired suggestions that haven't been assessed yet
      const expiredQuery = `
        SELECT
          s.id,
          s.shop_id,
          s.item_id,
          s.suggested_quantity,
          s.status,
          s.expires_at,
          i.stock_quantity as current_stock,
          i.low_stock_threshold
        FROM purchase_order_suggestions s
        INNER JOIN inventory_items i ON s.item_id = i.id
        WHERE s.status IN ('expired', 'rejected')
          AND s.was_accurate IS NULL
          AND s.expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days'  -- At least a week old
        ORDER BY s.expires_at ASC
        LIMIT 100  -- Process in batches
      `;

      const result = await pool.query(expiredQuery);
      let assessed = 0;

      for (const suggestion of result.rows) {
        // Check if item actually stocked out after suggestion expired
        const stockoutQuery = `
          SELECT COUNT(*) as stockout_count
          FROM inventory_adjustments
          WHERE item_id = $1
            AND shop_id = $2
            AND created_at >= $3
            AND created_at <= CURRENT_TIMESTAMP
            AND quantity_after = 0
            AND adjustment_type IN ('sale', 'service_completion')
        `;

        const stockoutResult = await pool.query(stockoutQuery, [
          suggestion.item_id,
          suggestion.shop_id,
          suggestion.expires_at,
        ]);

        const didStockout = parseInt(stockoutResult.rows[0].stockout_count) > 0;

        // Determine accuracy based on what happened
        let wasAccurate = false;
        let notes = '';
        let score = 0;

        if (suggestion.status === 'expired') {
          if (didStockout) {
            // Suggestion was accurate - item did stockout
            wasAccurate = true;
            notes = 'Auto-assessed: Item stocked out after suggestion expired. Suggestion was accurate.';
            score = 80; // High score - predicted a real need
          } else if (suggestion.current_stock > suggestion.low_stock_threshold) {
            // Item is now well-stocked, suggestion may have been unnecessary
            wasAccurate = false;
            notes = 'Auto-assessed: Item did not stockout and is now well-stocked. Suggestion may have been premature.';
            score = 40; // Lower score - may have been unnecessary
          } else {
            // Item is still low but didn't stockout yet
            wasAccurate = true;
            notes = 'Auto-assessed: Item remained low in stock but no stockout occurred. Moderate accuracy.';
            score = 60; // Moderate score - suggestion was reasonable
          }
        } else if (suggestion.status === 'rejected') {
          if (didStockout) {
            // Rejection was wrong - should have been approved
            wasAccurate = true;
            notes = 'Auto-assessed: Suggestion was rejected but item stocked out. Rejection was a mistake.';
            score = 90; // Very accurate - predicted a real problem
          } else {
            // Rejection was correct
            wasAccurate = false;
            notes = 'Auto-assessed: Suggestion was rejected and no stockout occurred. Rejection was correct.';
            score = 30; // Suggestion was not needed
          }
        }

        // Update the suggestion
        await pool.query(
          `UPDATE purchase_order_suggestions
           SET was_accurate = $1,
               actual_need_assessment_date = CURRENT_TIMESTAMP,
               actual_need_assessment_notes = $2,
               suggestion_accuracy_score = $3
           WHERE id = $4`,
          [wasAccurate, notes, score, suggestion.id]
        );

        assessed++;
      }

      if (assessed > 0) {
        logger.info(`Auto-assessed ${assessed} expired/rejected suggestions`);

        // Update metrics for all affected shops
        const affectedShops = [...new Set(result.rows.map(s => s.shop_id))];
        for (const shopId of affectedShops) {
          await this.updateAccuracyMetrics(shopId);
        }
      }

      return assessed;
    } catch (error) {
      logger.error('Error auto-assessing suggestion accuracy:', error);
      throw error;
    }
  }

  /**
   * Update accuracy metrics for a shop
   * This updates/creates the aggregate metrics in suggestion_accuracy_metrics table
   */
  private async updateAccuracyMetrics(shopId: string): Promise<void> {
    try {
      // Calculate weekly metrics (last 7 days)
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      const weekMetrics = await this.getAccuracyMetrics(shopId, weekStart, weekEnd);

      // Upsert into metrics table
      const upsertQuery = `
        INSERT INTO suggestion_accuracy_metrics (
          shop_id, period_start, period_end,
          total_suggestions, approved_suggestions, rejected_suggestions,
          expired_suggestions, suggestions_with_po,
          accurate_suggestions, inaccurate_suggestions, pending_assessment,
          average_accuracy_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (shop_id, period_start, period_end)
        DO UPDATE SET
          total_suggestions = EXCLUDED.total_suggestions,
          approved_suggestions = EXCLUDED.approved_suggestions,
          rejected_suggestions = EXCLUDED.rejected_suggestions,
          expired_suggestions = EXCLUDED.expired_suggestions,
          suggestions_with_po = EXCLUDED.suggestions_with_po,
          accurate_suggestions = EXCLUDED.accurate_suggestions,
          inaccurate_suggestions = EXCLUDED.inaccurate_suggestions,
          pending_assessment = EXCLUDED.pending_assessment,
          average_accuracy_score = EXCLUDED.average_accuracy_score,
          updated_at = CURRENT_TIMESTAMP
      `;

      await pool.query(upsertQuery, [
        shopId,
        weekStart,
        weekEnd,
        weekMetrics.totalSuggestions,
        weekMetrics.approvedSuggestions,
        weekMetrics.rejectedSuggestions,
        weekMetrics.expiredSuggestions,
        weekMetrics.suggestionsWithPO,
        weekMetrics.accurateSuggestions,
        weekMetrics.inaccurateSuggestions,
        weekMetrics.pendingAssessment,
        weekMetrics.averageAccuracyScore,
      ]);

      logger.debug(`Updated accuracy metrics for shop ${shopId}`);
    } catch (error) {
      logger.error('Error updating accuracy metrics:', error);
      // Don't throw - this is a background operation
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
