// backend/src/domains/InventoryDomain/controllers/vendorController.ts
import { Request, Response } from 'express';
import { InventoryRepository } from '../../../repositories/InventoryRepository';
import { logger } from '../../../utils/logger';

const inventoryRepo = new InventoryRepository();

/**
 * Create new vendor
 */
export const createVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const vendor = await inventoryRepo.createVendor({
      ...req.body,
      shopId
    });

    res.status(201).json({ vendor });
  } catch (error: any) {
    logger.error('Error creating vendor:', error);

    if (error.message.includes('duplicate key') && error.message.includes('name')) {
      res.status(400).json({ error: 'Vendor name already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to create vendor' });
  }
};

/**
 * Get all vendors
 */
export const getVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const vendors = await inventoryRepo.getVendors(shopId);
    res.json({ vendors });
  } catch (error: any) {
    logger.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

/**
 * Update vendor
 */
export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { vendorId } = req.params;
    const vendor = await inventoryRepo.updateVendor(vendorId, shopId, req.body);

    res.json({ vendor });
  } catch (error: any) {
    logger.error('Error updating vendor:', error);

    if (error.message === 'Vendor not found') {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    if (error.message.includes('duplicate key') && error.message.includes('name')) {
      res.status(400).json({ error: 'Vendor name already exists for this shop' });
      return;
    }

    res.status(500).json({ error: 'Failed to update vendor' });
  }
};

/**
 * Delete vendor
 */
export const deleteVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { vendorId } = req.params;
    await inventoryRepo.deleteVendor(vendorId, shopId);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting vendor:', error);

    if (error.message === 'Vendor not found') {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to delete vendor' });
  }
};
