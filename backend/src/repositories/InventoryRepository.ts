// backend/src/repositories/InventoryRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';
import { PoolClient } from 'pg';

// ============================================================================
// INTERFACES
// ============================================================================

export interface InventoryItem {
  id: string;
  shopId: string;
  categoryId?: string;
  vendorId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  images: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface InventoryItemWithDetails extends InventoryItem {
  categoryName?: string;
  vendorName?: string;
  availableQuantity: number;
}

export interface InventoryCategory {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface InventoryVendor {
  id: string;
  shopId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface InventoryAdjustment {
  id: string;
  itemId: string;
  shopId: string;
  adjustmentType: AdjustmentType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  notes?: string;
  adjustedBy?: string;
  createdAt: Date;
}

export type InventoryStatus = 'available' | 'low_stock' | 'out_of_stock' | 'discontinued';
export type AdjustmentType = 'manual' | 'purchase' | 'sale' | 'return' | 'damage' | 'loss' | 'recount' | 'transfer';

export interface CreateInventoryItemParams {
  shopId: string;
  categoryId?: string;
  vendorId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateInventoryItemParams {
  categoryId?: string;
  vendorId?: string;
  name?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  lowStockThreshold?: number;
  status?: InventoryStatus;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface InventoryFilters {
  shopId: string;
  categoryId?: string;
  vendorId?: string;
  status?: InventoryStatus;
  search?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  sortBy?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'newest' | 'oldest';
}

export interface CreateCategoryParams {
  shopId: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

export interface UpdateCategoryParams {
  name?: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

export interface CreateVendorParams {
  shopId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateVendorParams {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface AdjustStockParams {
  itemId: string;
  shopId: string;
  adjustmentType: AdjustmentType;
  quantityChange: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  notes?: string;
  adjustedBy?: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class InventoryRepository extends BaseRepository {

  // ==========================================================================
  // INVENTORY ITEMS
  // ==========================================================================

  /**
   * Create a new inventory item
   */
  async createItem(params: CreateInventoryItemParams): Promise<InventoryItem> {
    try {
      const query = `
        INSERT INTO inventory_items (
          shop_id, category_id, vendor_id, name, description, sku, barcode,
          price, cost, stock_quantity, low_stock_threshold, images, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        params.shopId,
        params.categoryId || null,
        params.vendorId || null,
        params.name,
        params.description || null,
        params.sku || null,
        params.barcode || null,
        params.price,
        params.cost || null,
        params.stockQuantity || 0,
        params.lowStockThreshold || 5,
        JSON.stringify(params.images || []),
        JSON.stringify(params.metadata || {})
      ];

      const result = await this.pool.query(query, values);
      return this.mapSnakeToCamel(result.rows[0]) as InventoryItem;
    } catch (error: any) {
      logger.error('Error creating inventory item:', error);
      throw error;
    }
  }

  /**
   * Get inventory item by ID
   */
  async getItemById(itemId: string, shopId: string): Promise<InventoryItem | null> {
    try {
      const query = `
        SELECT * FROM inventory_items
        WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [itemId, shopId]);

      if (result.rows.length === 0) return null;
      return this.mapSnakeToCamel(result.rows[0]) as InventoryItem;
    } catch (error: any) {
      logger.error('Error fetching inventory item:', error);
      throw error;
    }
  }

  /**
   * Get inventory item by SKU
   */
  async getItemBySku(sku: string, shopId: string): Promise<InventoryItem | null> {
    try {
      const query = `
        SELECT * FROM inventory_items
        WHERE sku = $1 AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [sku, shopId]);

      if (result.rows.length === 0) return null;
      return this.mapSnakeToCamel(result.rows[0]) as InventoryItem;
    } catch (error: any) {
      logger.error('Error fetching inventory item by SKU:', error);
      throw error;
    }
  }

  /**
   * Get inventory items with filters and pagination
   */
  async getItems(
    filters: InventoryFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<InventoryItemWithDetails>> {
    try {
      const conditions: string[] = ['ii.deleted_at IS NULL', 'ii.shop_id = $1'];
      const values: any[] = [filters.shopId];
      let paramIndex = 2;

      // Build WHERE clause
      if (filters.categoryId) {
        conditions.push(`ii.category_id = $${paramIndex}`);
        values.push(filters.categoryId);
        paramIndex++;
      }

      if (filters.vendorId) {
        conditions.push(`ii.vendor_id = $${paramIndex}`);
        values.push(filters.vendorId);
        paramIndex++;
      }

      if (filters.status) {
        conditions.push(`ii.status = $${paramIndex}`);
        values.push(filters.status);
        paramIndex++;
      }

      if (filters.lowStock) {
        conditions.push('ii.stock_quantity <= ii.low_stock_threshold AND ii.stock_quantity > 0');
      }

      if (filters.outOfStock) {
        conditions.push('ii.stock_quantity = 0');
      }

      if (filters.search) {
        conditions.push(`(
          ii.name ILIKE $${paramIndex} OR
          ii.description ILIKE $${paramIndex} OR
          ii.sku ILIKE $${paramIndex} OR
          ii.barcode ILIKE $${paramIndex}
        )`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Build ORDER BY clause
      let orderBy = 'ii.created_at DESC';
      switch (filters.sortBy) {
        case 'name_asc':
          orderBy = 'ii.name ASC';
          break;
        case 'name_desc':
          orderBy = 'ii.name DESC';
          break;
        case 'price_asc':
          orderBy = 'ii.price ASC';
          break;
        case 'price_desc':
          orderBy = 'ii.price DESC';
          break;
        case 'stock_asc':
          orderBy = 'ii.stock_quantity ASC';
          break;
        case 'stock_desc':
          orderBy = 'ii.stock_quantity DESC';
          break;
        case 'oldest':
          orderBy = 'ii.created_at ASC';
          break;
        case 'newest':
        default:
          orderBy = 'ii.created_at DESC';
          break;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM inventory_items ii
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult = await this.pool.query(countQuery, values);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated items
      const offset = this.getPaginationOffset(page, limit);
      const query = `
        SELECT
          ii.*,
          ic.name AS category_name,
          iv.name AS vendor_name,
          (ii.stock_quantity - ii.reserved_quantity) AS available_quantity
        FROM inventory_items ii
        LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
        LEFT JOIN inventory_vendors iv ON ii.vendor_id = iv.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await this.pool.query(query, values);

      return {
        items: result.rows.map(row => this.mapSnakeToCamel(row)) as InventoryItemWithDetails[],
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          hasMore: offset + result.rows.length < totalItems
        }
      };
    } catch (error: any) {
      logger.error('Error fetching inventory items:', error);
      throw error;
    }
  }

  /**
   * Update inventory item
   */
  async updateItem(
    itemId: string,
    shopId: string,
    params: UpdateInventoryItemParams
  ): Promise<InventoryItem> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build SET clause dynamically
      if (params.categoryId !== undefined) {
        updates.push(`category_id = $${paramIndex}`);
        values.push(params.categoryId);
        paramIndex++;
      }
      if (params.vendorId !== undefined) {
        updates.push(`vendor_id = $${paramIndex}`);
        values.push(params.vendorId);
        paramIndex++;
      }
      if (params.name) {
        updates.push(`name = $${paramIndex}`);
        values.push(params.name);
        paramIndex++;
      }
      if (params.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(params.description);
        paramIndex++;
      }
      if (params.sku !== undefined) {
        updates.push(`sku = $${paramIndex}`);
        values.push(params.sku);
        paramIndex++;
      }
      if (params.barcode !== undefined) {
        updates.push(`barcode = $${paramIndex}`);
        values.push(params.barcode);
        paramIndex++;
      }
      if (params.price !== undefined) {
        updates.push(`price = $${paramIndex}`);
        values.push(params.price);
        paramIndex++;
      }
      if (params.cost !== undefined) {
        updates.push(`cost = $${paramIndex}`);
        values.push(params.cost);
        paramIndex++;
      }
      if (params.lowStockThreshold !== undefined) {
        updates.push(`low_stock_threshold = $${paramIndex}`);
        values.push(params.lowStockThreshold);
        paramIndex++;
      }
      if (params.status) {
        updates.push(`status = $${paramIndex}`);
        values.push(params.status);
        paramIndex++;
      }
      if (params.images) {
        updates.push(`images = $${paramIndex}`);
        values.push(JSON.stringify(params.images));
        paramIndex++;
      }
      if (params.metadata) {
        updates.push(`metadata = $${paramIndex}`);
        values.push(JSON.stringify(params.metadata));
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE inventory_items
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND shop_id = $${paramIndex + 1} AND deleted_at IS NULL
        RETURNING *
      `;

      values.push(itemId, shopId);
      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      return this.mapSnakeToCamel(result.rows[0]) as InventoryItem;
    } catch (error: any) {
      logger.error('Error updating inventory item:', error);
      throw error;
    }
  }

  /**
   * Soft delete inventory item
   */
  async deleteItem(itemId: string, shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE inventory_items
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [itemId, shopId]);

      if (result.rowCount === 0) {
        throw new Error('Inventory item not found');
      }
    } catch (error: any) {
      logger.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  /**
   * Bulk delete inventory items
   */
  async bulkDeleteItems(itemIds: string[], shopId: string): Promise<number> {
    try {
      const query = `
        UPDATE inventory_items
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1) AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [itemIds, shopId]);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error bulk deleting inventory items:', error);
      throw error;
    }
  }

  /**
   * Bulk update inventory items
   */
  async bulkUpdateItems(
    itemIds: string[],
    shopId: string,
    params: UpdateInventoryItemParams
  ): Promise<number> {
    try {
      const updates: string[] = [];
      const values: any[] = [itemIds, shopId];
      let paramIndex = 3;

      // Build SET clause similar to updateItem
      if (params.categoryId !== undefined) {
        updates.push(`category_id = $${paramIndex}`);
        values.push(params.categoryId);
        paramIndex++;
      }
      if (params.status) {
        updates.push(`status = $${paramIndex}`);
        values.push(params.status);
        paramIndex++;
      }
      // Add more fields as needed

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE inventory_items
        SET ${updates.join(', ')}
        WHERE id = ANY($1) AND shop_id = $2 AND deleted_at IS NULL
      `;

      const result = await this.pool.query(query, values);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error bulk updating inventory items:', error);
      throw error;
    }
  }

  // ==========================================================================
  // STOCK ADJUSTMENTS
  // ==========================================================================

  /**
   * Adjust stock quantity for an item
   * This method handles the transaction and creates an adjustment record
   */
  async adjustStock(params: AdjustStockParams): Promise<InventoryAdjustment> {
    return this.withTransaction(async (client: PoolClient) => {
      try {
        // Get current item
        const itemQuery = `
          SELECT stock_quantity FROM inventory_items
          WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const itemResult = await client.query(itemQuery, [params.itemId, params.shopId]);

        if (itemResult.rows.length === 0) {
          throw new Error('Inventory item not found');
        }

        const quantityBefore = itemResult.rows[0].stock_quantity;
        const quantityAfter = quantityBefore + params.quantityChange;

        if (quantityAfter < 0) {
          throw new Error('Insufficient stock quantity');
        }

        // Update stock quantity
        const updateQuery = `
          UPDATE inventory_items
          SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND shop_id = $3
        `;
        await client.query(updateQuery, [quantityAfter, params.itemId, params.shopId]);

        // Create adjustment record
        const adjustmentQuery = `
          INSERT INTO inventory_adjustments (
            item_id, shop_id, adjustment_type, quantity_change,
            quantity_before, quantity_after, reference_type, reference_id,
            reason, notes, adjusted_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const adjustmentValues = [
          params.itemId,
          params.shopId,
          params.adjustmentType,
          params.quantityChange,
          quantityBefore,
          quantityAfter,
          params.referenceType || null,
          params.referenceId || null,
          params.reason || null,
          params.notes || null,
          params.adjustedBy || null
        ];

        const adjustmentResult = await client.query(adjustmentQuery, adjustmentValues);
        return this.mapSnakeToCamel(adjustmentResult.rows[0]) as InventoryAdjustment;
      } catch (error: any) {
        logger.error('Error adjusting stock:', error);
        throw error;
      }
    });
  }

  /**
   * Get adjustment history for an item
   */
  async getItemAdjustments(
    itemId: string,
    shopId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<InventoryAdjustment>> {
    try {
      const countQuery = `
        SELECT COUNT(*) FROM inventory_adjustments
        WHERE item_id = $1 AND shop_id = $2
      `;
      const countResult = await this.pool.query(countQuery, [itemId, shopId]);
      const totalItems = parseInt(countResult.rows[0].count);

      const offset = this.getPaginationOffset(page, limit);
      const query = `
        SELECT * FROM inventory_adjustments
        WHERE item_id = $1 AND shop_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await this.pool.query(query, [itemId, shopId, limit, offset]);

      return {
        items: result.rows.map(row => this.mapSnakeToCamel(row)) as InventoryAdjustment[],
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          hasMore: offset + result.rows.length < totalItems
        }
      };
    } catch (error: any) {
      logger.error('Error fetching item adjustments:', error);
      throw error;
    }
  }

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  /**
   * Create inventory category
   */
  async createCategory(params: CreateCategoryParams): Promise<InventoryCategory> {
    try {
      const query = `
        INSERT INTO inventory_categories (shop_id, name, description, icon, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        params.shopId,
        params.name,
        params.description || null,
        params.icon || null,
        params.displayOrder || 0
      ];

      const result = await this.pool.query(query, values);
      return this.mapSnakeToCamel(result.rows[0]) as InventoryCategory;
    } catch (error: any) {
      logger.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Get all categories for a shop
   */
  async getCategories(shopId: string): Promise<InventoryCategory[]> {
    try {
      const query = `
        SELECT * FROM inventory_categories
        WHERE shop_id = $1 AND deleted_at IS NULL
        ORDER BY display_order ASC, name ASC
      `;
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapSnakeToCamel(row)) as InventoryCategory[];
    } catch (error: any) {
      logger.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(
    categoryId: string,
    shopId: string,
    params: UpdateCategoryParams
  ): Promise<InventoryCategory> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.name) {
        updates.push(`name = $${paramIndex}`);
        values.push(params.name);
        paramIndex++;
      }
      if (params.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(params.description);
        paramIndex++;
      }
      if (params.icon !== undefined) {
        updates.push(`icon = $${paramIndex}`);
        values.push(params.icon);
        paramIndex++;
      }
      if (params.displayOrder !== undefined) {
        updates.push(`display_order = $${paramIndex}`);
        values.push(params.displayOrder);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE inventory_categories
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND shop_id = $${paramIndex + 1} AND deleted_at IS NULL
        RETURNING *
      `;

      values.push(categoryId, shopId);
      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Category not found');
      }

      return this.mapSnakeToCamel(result.rows[0]) as InventoryCategory;
    } catch (error: any) {
      logger.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId: string, shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE inventory_categories
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [categoryId, shopId]);

      if (result.rowCount === 0) {
        throw new Error('Category not found');
      }
    } catch (error: any) {
      logger.error('Error deleting category:', error);
      throw error;
    }
  }

  // ==========================================================================
  // VENDORS
  // ==========================================================================

  /**
   * Create vendor
   */
  async createVendor(params: CreateVendorParams): Promise<InventoryVendor> {
    try {
      const query = `
        INSERT INTO inventory_vendors (
          shop_id, name, contact_name, email, phone, address, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        params.shopId,
        params.name,
        params.contactName || null,
        params.email || null,
        params.phone || null,
        params.address || null,
        params.notes || null
      ];

      const result = await this.pool.query(query, values);
      return this.mapSnakeToCamel(result.rows[0]) as InventoryVendor;
    } catch (error: any) {
      logger.error('Error creating vendor:', error);
      throw error;
    }
  }

  /**
   * Get all vendors for a shop
   */
  async getVendors(shopId: string): Promise<InventoryVendor[]> {
    try {
      const query = `
        SELECT * FROM inventory_vendors
        WHERE shop_id = $1 AND deleted_at IS NULL
        ORDER BY name ASC
      `;
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapSnakeToCamel(row)) as InventoryVendor[];
    } catch (error: any) {
      logger.error('Error fetching vendors:', error);
      throw error;
    }
  }

  /**
   * Update vendor
   */
  async updateVendor(
    vendorId: string,
    shopId: string,
    params: UpdateVendorParams
  ): Promise<InventoryVendor> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.name) {
        updates.push(`name = $${paramIndex}`);
        values.push(params.name);
        paramIndex++;
      }
      if (params.contactName !== undefined) {
        updates.push(`contact_name = $${paramIndex}`);
        values.push(params.contactName);
        paramIndex++;
      }
      if (params.email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        values.push(params.email);
        paramIndex++;
      }
      if (params.phone !== undefined) {
        updates.push(`phone = $${paramIndex}`);
        values.push(params.phone);
        paramIndex++;
      }
      if (params.address !== undefined) {
        updates.push(`address = $${paramIndex}`);
        values.push(params.address);
        paramIndex++;
      }
      if (params.notes !== undefined) {
        updates.push(`notes = $${paramIndex}`);
        values.push(params.notes);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE inventory_vendors
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND shop_id = $${paramIndex + 1} AND deleted_at IS NULL
        RETURNING *
      `;

      values.push(vendorId, shopId);
      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Vendor not found');
      }

      return this.mapSnakeToCamel(result.rows[0]) as InventoryVendor;
    } catch (error: any) {
      logger.error('Error updating vendor:', error);
      throw error;
    }
  }

  /**
   * Delete vendor
   */
  async deleteVendor(vendorId: string, shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE inventory_vendors
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [vendorId, shopId]);

      if (result.rowCount === 0) {
        throw new Error('Vendor not found');
      }
    } catch (error: any) {
      logger.error('Error deleting vendor:', error);
      throw error;
    }
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get inventory statistics for a shop
   */
  async getInventoryStats(shopId: string): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalCategories: number;
    totalVendors: number;
  }> {
    try {
      const query = `
        SELECT
          COUNT(ii.id) as total_items,
          COALESCE(SUM(ii.price * ii.stock_quantity), 0) as total_value,
          COUNT(CASE WHEN ii.stock_quantity <= ii.low_stock_threshold AND ii.stock_quantity > 0 THEN 1 END) as low_stock_items,
          COUNT(CASE WHEN ii.stock_quantity = 0 THEN 1 END) as out_of_stock_items,
          (SELECT COUNT(*) FROM inventory_categories WHERE shop_id = $1 AND deleted_at IS NULL) as total_categories,
          (SELECT COUNT(*) FROM inventory_vendors WHERE shop_id = $1 AND deleted_at IS NULL) as total_vendors
        FROM inventory_items ii
        WHERE ii.shop_id = $1 AND ii.deleted_at IS NULL
      `;

      const result = await this.pool.query(query, [shopId]);
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error: any) {
      logger.error('Error fetching inventory stats:', error);
      throw error;
    }
  }
}
