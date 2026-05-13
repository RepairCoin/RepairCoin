// backend/src/repositories/PurchaseOrderRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  shopId: string;
  vendorId: string | null;
  vendorName: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  receivedDate: Date | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes: string | null;
  trackingNumber: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  inventoryItemId: string | null;
  itemName: string;
  itemSku: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderData {
  shopId: string;
  vendorId: string | null;
  vendorName: string;
  orderDate?: Date;
  expectedDeliveryDate?: Date | null;
  notes?: string | null;
  createdBy: string;
  items: Array<{
    inventoryItemId: string | null;
    itemName: string;
    itemSku: string | null;
    quantity: number;
    unitCost: number;
  }>;
}

export interface UpdatePurchaseOrderData {
  vendorId?: string | null;
  vendorName?: string;
  status?: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  expectedDeliveryDate?: Date | null;
  notes?: string | null;
  trackingNumber?: string | null;
}

export class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Generate a unique PO number
   */
  private async generatePONumber(shopId: string): Promise<string> {
    const year = new Date().getFullYear();
    const query = `
      SELECT COUNT(*) as count
      FROM purchase_orders
      WHERE shop_id = $1
        AND EXTRACT(YEAR FROM order_date) = $2
    `;

    const result = await this.pool.query(query, [shopId, year]);
    const count = parseInt(result.rows[0].count) + 1;
    const paddedCount = count.toString().padStart(4, '0');

    return `PO-${year}-${paddedCount}`;
  }

  /**
   * Create a new purchase order with items
   */
  async createPurchaseOrder(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    return await this.withTransaction(async (client) => {
      // Generate PO number
      const poNumber = await this.generatePONumber(data.shopId);

      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
      const total = subtotal; // For now, no tax or shipping

      // Insert purchase order
      const poQuery = `
        INSERT INTO purchase_orders (
          po_number, shop_id, vendor_id, vendor_name,
          order_date, expected_delivery_date,
          subtotal, tax, shipping, total,
          notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const poValues = [
        poNumber,
        data.shopId,
        data.vendorId,
        data.vendorName,
        data.orderDate || new Date(),
        data.expectedDeliveryDate || null,
        subtotal,
        0, // tax
        0, // shipping
        total,
        data.notes || null,
        data.createdBy
      ];

      const poResult = await client.query(poQuery, poValues);
      const po = this.mapSnakeToCamel(poResult.rows[0]);

      // Insert purchase order items
      for (const item of data.items) {
        const lineTotal = item.quantity * item.unitCost;

        const itemQuery = `
          INSERT INTO purchase_order_items (
            po_id, inventory_item_id, item_name, item_sku,
            quantity_ordered, quantity_received, unit_cost, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const itemValues = [
          po.id,
          item.inventoryItemId,
          item.itemName,
          item.itemSku,
          item.quantity,
          0, // quantity_received
          item.unitCost,
          lineTotal
        ];

        await client.query(itemQuery, itemValues);
      }

      logger.info(`Purchase order created: ${poNumber}`, { poId: po.id, shopId: data.shopId });

      return await this.getPurchaseOrderById(po.id);
    });
  }

  /**
   * Get purchase order by ID with items
   */
  async getPurchaseOrderById(poId: string): Promise<PurchaseOrder> {
    const poQuery = `
      SELECT *
      FROM purchase_orders
      WHERE id = $1
    `;

    const poResult = await this.pool.query(poQuery, [poId]);

    if (poResult.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const po = this.mapSnakeToCamel(poResult.rows[0]);

    // Get items
    const itemsQuery = `
      SELECT *
      FROM purchase_order_items
      WHERE po_id = $1
      ORDER BY created_at ASC
    `;

    const itemsResult = await this.pool.query(itemsQuery, [poId]);
    po.items = itemsResult.rows.map(row => this.mapSnakeToCamel(row));

    return po;
  }

  /**
   * Get all purchase orders for a shop
   */
  async getPurchaseOrders(
    shopId: string,
    options: {
      status?: string;
      vendorId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ orders: PurchaseOrder[]; total: number; }> {
    const { status, vendorId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['shop_id = $1'];
    const values: Array<string | number> = [shopId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (vendorId) {
      conditions.push(`vendor_id = $${paramIndex++}`);
      values.push(vendorId);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM purchase_orders WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    // Get orders
    const query = `
      SELECT po.*, v.name as vendor_name
      FROM purchase_orders po
      LEFT JOIN inventory_vendors v ON po.vendor_id = v.id
      WHERE ${whereClause}
      ORDER BY po.order_date DESC, po.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await this.pool.query(query, [...values, limit, offset]);
    const orders = result.rows.map(row => this.mapSnakeToCamel(row));

    // Get items for each order
    for (const order of orders) {
      const itemsQuery = `
        SELECT *
        FROM purchase_order_items
        WHERE po_id = $1
        ORDER BY created_at ASC
      `;

      const itemsResult = await this.pool.query(itemsQuery, [order.id]);
      order.items = itemsResult.rows.map(row => this.mapSnakeToCamel(row));
    }

    return { orders, total };
  }

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(poId: string, data: UpdatePurchaseOrderData): Promise<PurchaseOrder> {
    const updates: string[] = [];
    const values: Array<string | Date | null> = [];
    let paramIndex = 1;

    if (data.vendorId !== undefined) {
      updates.push(`vendor_id = $${paramIndex++}`);
      values.push(data.vendorId);
    }

    if (data.vendorName !== undefined) {
      updates.push(`vendor_name = $${paramIndex++}`);
      values.push(data.vendorName);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.expectedDeliveryDate !== undefined) {
      updates.push(`expected_delivery_date = $${paramIndex++}`);
      values.push(data.expectedDeliveryDate);
    }

    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (data.trackingNumber !== undefined) {
      updates.push(`tracking_number = $${paramIndex++}`);
      values.push(data.trackingNumber);
    }

    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    values.push(poId);

    const query = `
      UPDATE purchase_orders
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    logger.info(`Purchase order updated: ${poId}`);

    return await this.getPurchaseOrderById(poId);
  }

  /**
   * Receive items from purchase order
   */
  async receiveItems(
    poId: string,
    items: Array<{ itemId: string; quantityReceived: number; }>
  ): Promise<PurchaseOrder> {
    return await this.withTransaction(async (client) => {
      // Update purchase order item quantities
      for (const item of items) {
        const query = `
          UPDATE purchase_order_items
          SET quantity_received = quantity_received + $1
          WHERE id = $2 AND po_id = $3
          RETURNING quantity_ordered, quantity_received, inventory_item_id
        `;

        const result = await client.query(query, [item.quantityReceived, item.itemId, poId]);

        if (result.rows.length === 0) {
          throw new Error(`Purchase order item not found: ${item.itemId}`);
        }

        const poItem = result.rows[0];

        // Update inventory stock if item is linked
        if (poItem.inventory_item_id) {
          const updateStockQuery = `
            UPDATE inventory_items
            SET stock_quantity = stock_quantity + $1
            WHERE id = $2
          `;

          await client.query(updateStockQuery, [item.quantityReceived, poItem.inventory_item_id]);

          // Create adjustment record
          const adjustmentQuery = `
            INSERT INTO inventory_adjustments (
              item_id, shop_id, quantity_change,
              previous_quantity, new_quantity,
              adjustment_type, reason, reference_type, reference_id,
              adjusted_by
            )
            SELECT
              $1,
              i.shop_id,
              $2,
              i.stock_quantity - $2,
              i.stock_quantity,
              'restock',
              'Received from purchase order',
              'purchase_order',
              $3,
              $4
            FROM inventory_items i
            WHERE i.id = $1
          `;

          await client.query(adjustmentQuery, [
            poItem.inventory_item_id,
            item.quantityReceived,
            poId,
            'system'
          ]);
        }
      }

      // Check if all items are fully received
      const checkQuery = `
        SELECT
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE quantity_received >= quantity_ordered) as received_items
        FROM purchase_order_items
        WHERE po_id = $1
      `;

      const checkResult = await client.query(checkQuery, [poId]);
      const { total_items, received_items } = checkResult.rows[0];

      // Update PO status
      let newStatus = 'partially_received';
      let receivedDate = null;

      if (parseInt(received_items) === parseInt(total_items)) {
        newStatus = 'received';
        receivedDate = new Date();
      }

      const updateQuery = `
        UPDATE purchase_orders
        SET status = $1, received_date = $2
        WHERE id = $3
      `;

      await client.query(updateQuery, [newStatus, receivedDate, poId]);

      logger.info(`Purchase order items received: ${poId}`, { itemsReceived: items.length });

      return await this.getPurchaseOrderById(poId);
    });
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(poId: string): Promise<PurchaseOrder> {
    const query = `
      UPDATE purchase_orders
      SET status = 'cancelled'
      WHERE id = $1 AND status IN ('draft', 'sent', 'confirmed')
      RETURNING *
    `;

    const result = await this.pool.query(query, [poId]);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found or cannot be cancelled');
    }

    logger.info(`Purchase order cancelled: ${poId}`);

    return await this.getPurchaseOrderById(poId);
  }

  /**
   * Delete purchase order (only if draft)
   */
  async deletePurchaseOrder(poId: string): Promise<void> {
    const query = `
      DELETE FROM purchase_orders
      WHERE id = $1 AND status = 'draft'
    `;

    const result = await this.pool.query(query, [poId]);

    if (result.rowCount === 0) {
      throw new Error('Purchase order not found or cannot be deleted (only draft orders can be deleted)');
    }

    logger.info(`Purchase order deleted: ${poId}`);
  }

  /**
   * Get purchase order summary statistics
   */
  async getPurchaseOrderStats(shopId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    pendingOrders: number;
    receivedOrders: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        COUNT(*) FILTER (WHERE status IN ('sent', 'confirmed', 'partially_received')) as pending_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders
      FROM purchase_orders
      WHERE shop_id = $1
    `;

    const result = await this.pool.query(query, [shopId]);
    const stats = result.rows[0];

    return {
      totalOrders: parseInt(stats.total_orders),
      totalSpent: parseFloat(stats.total_spent),
      pendingOrders: parseInt(stats.pending_orders),
      receivedOrders: parseInt(stats.received_orders)
    };
  }
}
