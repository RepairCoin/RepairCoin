// backend/src/domains/InventoryDomain/controllers/adjustmentController.ts
import { Request, Response } from 'express';
import { InventoryRepository } from '../../../repositories/InventoryRepository';
import { logger } from '../../../utils/logger';

const inventoryRepo = new InventoryRepository();

/**
 * Adjust stock quantity for an item
 */
export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const { adjustmentType, quantityChange, reason, notes, referenceType, referenceId } = req.body;

    // Validate required fields
    if (!adjustmentType) {
      res.status(400).json({ error: 'adjustmentType is required' });
      return;
    }

    if (quantityChange === undefined || quantityChange === null) {
      res.status(400).json({ error: 'quantityChange is required' });
      return;
    }

    if (typeof quantityChange !== 'number') {
      res.status(400).json({ error: 'quantityChange must be a number' });
      return;
    }

    const adjustment = await inventoryRepo.adjustStock({
      itemId,
      shopId,
      adjustmentType,
      quantityChange,
      reason,
      notes,
      referenceType,
      referenceId,
      adjustedBy: req.user?.address
    });

    res.json({ adjustment });
  } catch (error: any) {
    logger.error('Error adjusting stock:', error);

    if (error.message === 'Inventory item not found') {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    if (error.message === 'Insufficient stock quantity') {
      res.status(400).json({ error: 'Insufficient stock quantity' });
      return;
    }

    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

/**
 * Get adjustment history for an item
 */
export const getItemAdjustments = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await inventoryRepo.getItemAdjustments(itemId, shopId, page, limit);
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching item adjustments:', error);
    res.status(500).json({ error: 'Failed to fetch adjustment history' });
  }
};
