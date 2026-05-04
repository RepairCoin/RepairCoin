// backend/src/domains/InventoryDomain/controllers/categoryController.ts
import { Request, Response } from 'express';
import { InventoryRepository } from '../../../repositories/InventoryRepository';
import { logger } from '../../../utils/logger';

const inventoryRepo = new InventoryRepository();

/**
 * Create new category
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const category = await inventoryRepo.createCategory({
      ...req.body,
      shopId
    });

    res.status(201).json({ category });
  } catch (error: any) {
    logger.error('Error creating category:', error);

    if (error.message.includes('duplicate key') && error.message.includes('name')) {
      res.status(400).json({ error: 'Category name already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to create category' });
  }
};

/**
 * Get all categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const categories = await inventoryRepo.getCategories(shopId);
    res.json({ categories });
  } catch (error: any) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * Update category
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { categoryId } = req.params;
    const category = await inventoryRepo.updateCategory(categoryId, shopId, req.body);

    res.json({ category });
  } catch (error: any) {
    logger.error('Error updating category:', error);

    if (error.message === 'Category not found') {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (error.message.includes('duplicate key') && error.message.includes('name')) {
      res.status(400).json({ error: 'Category name already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to update category' });
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { categoryId } = req.params;
    await inventoryRepo.deleteCategory(categoryId, shopId);

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting category:', error);

    if (error.message === 'Category not found') {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to delete category' });
  }
};
