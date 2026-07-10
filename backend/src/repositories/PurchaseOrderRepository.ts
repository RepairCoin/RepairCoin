// backend/src/repositories/PurchaseOrderRepository.ts
import { PoolClient } from 'pg';
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
  // Branch this PO's stock is received into. NULL = the shop's primary, resolved at receive time.
  locationId?: string | null;
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
  locationId?: string | null;
}

export class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Generate a per-shop PO number (format: PO-YYYY-####).
   *
   * Scoped per shop (unique on shop_id + po_number, see migration 132), so two
   * shops can both hold PO-2026-0001. Uses MAX(seq)+1 not COUNT(*)+1 so gaps from
   * deletions never reuse a number; createPurchaseOrder retries on collision.
   * Runs on the transaction client so the read shares the insert's transaction.
   */
  private async generatePONumber(client: PoolClient, shopId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    // SPLIT_PART(po_number, '-', 3) extracts #### from PO-YYYY-####; LIKE limits to valid rows.
    const query = `
      SELECT COALESCE(MAX(CAST(SPLIT_PART(po_number, '-', 3) AS INTEGER)), 0) AS max_seq
      FROM purchase_orders
      WHERE shop_id = $1
        AND po_number LIKE $2
    `;

    const result = await client.query(query, [shopId, `${prefix}%`]);
    const nextSeq = parseInt(result.rows[0].max_seq, 10) + 1;

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new purchase order with items
   */
  async createPurchaseOrder(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    // Retry on the (rare) race where two concurrent inserts generate the same PO number.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.createPurchaseOrderOnce(data);
      } catch (error: any) {
        // 23505 = unique_violation; only the po_number collision is retryable.
        if (error?.code === '23505' && attempt < maxAttempts) {
          logger.warn(`PO number collision, retrying (${attempt}/${maxAttempts})`, { shopId: data.shopId });
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate a unique purchase order number after multiple attempts');
  }

  private async createPurchaseOrderOnce(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    return await this.withTransaction(async (client) => {
      // Generate PO number
      const poNumber = await this.generatePONumber(client, data.shopId);

      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
      const total = subtotal; // For now, no tax or shipping

      // Insert purchase order
      const poQuery = `
        INSERT INTO purchase_orders (
          po_number, shop_id, vendor_id, vendor_name,
          order_date, expected_delivery_date,
          subtotal, tax, shipping, total,
          notes, location_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        data.locationId || null,
        data.createdBy
      ];

      const poResult = await client.query(poQuery, poValues);
      const po = this.mapSnakeToCamel(poResult.rows[0]);

      // Insert purchase order items
      const items: PurchaseOrderItem[] = [];
      for (const item of data.items) {
        const lineTotal = item.quantity * item.unitCost;

        const itemQuery = `
          INSERT INTO purchase_order_items (
            po_id, inventory_item_id, item_name, item_sku,
            quantity_ordered, quantity_received, unit_cost, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
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

        const itemResult = await client.query(itemQuery, itemValues);
        items.push(this.mapSnakeToCamel(itemResult.rows[0]));
      }

      // Attach items to PO
      po.items = items;

      logger.info(`Purchase order created: ${poNumber}`, { poId: po.id, shopId: data.shopId });

      return po;
    });
  }

  /**
   * Get purchase order by ID with items
   */
  async getPurchaseOrderById(poId: string): Promise<PurchaseOrder> {
    const poQuery = `
      SELECT po.*, sl.name AS location_name
      FROM purchase_orders po
      LEFT JOIN shop_locations sl ON sl.id = po.location_id
      WHERE po.id = $1
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

    const conditions: string[] = ['po.shop_id = $1'];
    const values: Array<string | number> = [shopId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`po.status = $${paramIndex++}`);
      values.push(status);
    }

    if (vendorId) {
      conditions.push(`po.vendor_id = $${paramIndex++}`);
      values.push(vendorId);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM purchase_orders po WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    // Get orders
    const query = `
      SELECT po.*, sl.name AS location_name
      FROM purchase_orders po
      LEFT JOIN shop_locations sl ON sl.id = po.location_id
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

    if (data.locationId !== undefined) {
      updates.push(`location_id = $${paramIndex++}`);
      values.push(data.locationId);
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
      // Resolve which branch this PO receives into — its own location_id, else the shop's primary.
      const poMeta = await client.query(
        `SELECT po.location_id, po.shop_id, sl.id AS primary_location_id
         FROM purchase_orders po
         LEFT JOIN shop_locations sl ON sl.shop_id = po.shop_id AND sl.is_primary = true
         WHERE po.id = $1`,
        [poId]
      );
      const receiveLocationId: string | null =
        poMeta.rows[0]?.location_id || poMeta.rows[0]?.primary_location_id || null;

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
          if (receiveLocationId) {
            // Add to the branch's stock row (before/after are the branch's), then apply the same
            // delta to the item's cached shop-total.
            await client.query(
              `INSERT INTO inventory_item_stock (item_id, location_id, stock_quantity, reserved_quantity)
               VALUES ($1, $2, 0, 0) ON CONFLICT (item_id, location_id) DO NOTHING`,
              [poItem.inventory_item_id, receiveLocationId]
            );
            const branch = await client.query(
              `UPDATE inventory_item_stock
               SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP
               WHERE item_id = $2 AND location_id = $3
               RETURNING stock_quantity`,
              [item.quantityReceived, poItem.inventory_item_id, receiveLocationId]
            );
            await client.query(
              `UPDATE inventory_items SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [item.quantityReceived, poItem.inventory_item_id]
            );
            const after = branch.rows[0].stock_quantity;
            await client.query(
              `INSERT INTO inventory_adjustments (
                item_id, shop_id, location_id, quantity_change, quantity_before, quantity_after,
                adjustment_type, reason, reference_type, reference_id, adjusted_by
              )
              SELECT $1, i.shop_id, $2, $3, $4, $5, 'purchase', 'Received from purchase order',
                     'purchase_order', $6, 'system'
              FROM inventory_items i WHERE i.id = $1`,
              [poItem.inventory_item_id, receiveLocationId, item.quantityReceived, after - item.quantityReceived, after, poId]
            );
          } else {
            // Legacy path: no location resolvable — add to the item total directly.
            await client.query(
              `UPDATE inventory_items SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
              [item.quantityReceived, poItem.inventory_item_id]
            );
            await client.query(
              `INSERT INTO inventory_adjustments (
                item_id, shop_id, quantity_change, quantity_before, quantity_after,
                adjustment_type, reason, reference_type, reference_id, adjusted_by
              )
              SELECT $1, i.shop_id, $2, i.stock_quantity - $2, i.stock_quantity,
                     'purchase', 'Received from purchase order', 'purchase_order', $3, 'system'
              FROM inventory_items i WHERE i.id = $1`,
              [poItem.inventory_item_id, item.quantityReceived, poId]
            );
          }
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
    totalSpending: number;
    pendingOrders: number;
    receivedOrders: number;
    averageOrderValue: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total) FILTER (WHERE status != 'cancelled'), 0) as total_spending,
        COUNT(*) FILTER (WHERE status != 'cancelled') as billable_orders,
        COUNT(*) FILTER (WHERE status IN ('sent', 'confirmed', 'partially_received')) as pending_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders
      FROM purchase_orders
      WHERE shop_id = $1
    `;

    const result = await this.pool.query(query, [shopId]);
    const stats = result.rows[0];

    const billableOrders = parseInt(stats.billable_orders);
    const totalSpending = parseFloat(stats.total_spending);

    return {
      totalOrders: parseInt(stats.total_orders),
      totalSpending,
      pendingOrders: parseInt(stats.pending_orders),
      receivedOrders: parseInt(stats.received_orders),
      averageOrderValue: billableOrders > 0 ? totalSpending / billableOrders : 0
    };
  }
}
