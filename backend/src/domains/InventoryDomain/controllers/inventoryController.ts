// backend/src/domains/InventoryDomain/controllers/inventoryController.ts
import { Request, Response } from 'express';
import { InventoryRepository } from '../../../repositories/InventoryRepository';
import { logger } from '../../../utils/logger';

const inventoryRepo = new InventoryRepository();

/**
 * Create new inventory item
 */
export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const item = await inventoryRepo.createItem({
      ...req.body,
      shopId
    });

    res.status(201).json({ item });
  } catch (error: any) {
    logger.error('Error creating inventory item:', error);

    if (error.message.includes('duplicate key') && error.message.includes('sku')) {
      res.status(400).json({ error: 'SKU already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to create inventory item' });
  }
};

/**
 * Get inventory item by ID
 */
export const getInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await inventoryRepo.getItemById(itemId, shopId);

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ item });
  } catch (error: any) {
    logger.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
};

/**
 * Get inventory items with filters and pagination
 */
export const getInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filters = {
      shopId,
      categoryId: req.query.categoryId as string,
      vendorId: req.query.vendorId as string,
      status: req.query.status as any,
      search: req.query.search as string,
      lowStock: req.query.lowStock === 'true',
      outOfStock: req.query.outOfStock === 'true',
      sortBy: req.query.sortBy as any
    };

    const result = await inventoryRepo.getItems(filters, page, limit);
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching inventory items:', error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
};

/**
 * Update inventory item
 */
export const updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await inventoryRepo.updateItem(itemId, shopId, req.body);

    res.json({ item });
  } catch (error: any) {
    logger.error('Error updating inventory item:', error);

    if (error.message === 'Inventory item not found') {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    if (error.message.includes('duplicate key') && error.message.includes('sku')) {
      res.status(400).json({ error: 'SKU already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to update inventory item' });
  }
};

/**
 * Delete inventory item
 */
export const deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    await inventoryRepo.deleteItem(itemId, shopId);

    res.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting inventory item:', error);

    if (error.message === 'Inventory item not found') {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
};

/**
 * Bulk delete inventory items
 */
export const bulkDeleteItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'itemIds must be a non-empty array' });
      return;
    }

    const deletedCount = await inventoryRepo.bulkDeleteItems(itemIds, shopId);

    res.json({
      message: `${deletedCount} item(s) deleted successfully`,
      deletedCount
    });
  } catch (error: any) {
    logger.error('Error bulk deleting inventory items:', error);
    res.status(500).json({ error: 'Failed to delete items' });
  }
};

/**
 * Bulk update inventory items
 */
export const bulkUpdateItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemIds, updates } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'itemIds must be a non-empty array' });
      return;
    }

    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'updates object must contain at least one field' });
      return;
    }

    const updatedCount = await inventoryRepo.bulkUpdateItems(itemIds, shopId, updates);

    res.json({
      message: `${updatedCount} item(s) updated successfully`,
      updatedCount
    });
  } catch (error: any) {
    logger.error('Error bulk updating inventory items:', error);
    res.status(500).json({ error: 'Failed to update items' });
  }
};

/**
 * Get inventory statistics
 */
export const getInventoryStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await inventoryRepo.getInventoryStats(shopId);
    res.json({ stats });
  } catch (error: any) {
    logger.error('Error fetching inventory stats:', error);
    res.status(500).json({ error: 'Failed to fetch inventory statistics' });
  }
};
