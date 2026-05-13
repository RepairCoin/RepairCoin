// backend/src/domains/InventoryDomain/controllers/purchaseOrderController.ts
import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { PurchaseOrderRepository } from '../../../repositories/PurchaseOrderRepository';

const poRepository = new PurchaseOrderRepository();

/**
 * Create a new purchase order
 */
export async function createPurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { vendorId, vendorName, orderDate, expectedDeliveryDate, notes, items } = req.body;

    // Validation
    if (!vendorName) {
      res.status(400).json({
        success: false,
        message: 'Vendor name is required'
      });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
      return;
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemName) {
        res.status(400).json({
          success: false,
          message: 'All items must have a name'
        });
        return;
      }

      if (!item.quantity || item.quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'All items must have a positive quantity'
        });
        return;
      }

      if (!item.unitCost || item.unitCost < 0) {
        res.status(400).json({
          success: false,
          message: 'All items must have a valid unit cost'
        });
        return;
      }
    }

    const po = await poRepository.createPurchaseOrder({
      shopId,
      vendorId: vendorId || null,
      vendorName,
      orderDate: orderDate ? new Date(orderDate) : undefined,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      notes: notes || null,
      createdBy: req.user?.address || 'unknown',
      items
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: po
    });

    logger.info(`Purchase order created: ${po.poNumber}`, { poId: po.id, shopId });
  } catch (error) {
    logger.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create purchase order'
    });
  }
}

/**
 * Get all purchase orders for a shop
 */
export async function getPurchaseOrders(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { status, vendorId, page, limit } = req.query;

    const options = {
      status: status as string | undefined,
      vendorId: vendorId as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    };

    const result = await poRepository.getPurchaseOrders(shopId, options);

    res.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: {
          total: result.total,
          page: options.page || 1,
          limit: options.limit || 20,
          totalPages: Math.ceil(result.total / (options.limit || 20))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase orders'
    });
  }
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { poId } = req.params;

    const po = await poRepository.getPurchaseOrderById(poId);

    res.json({
      success: true,
      data: po
    });
  } catch (error) {
    logger.error('Error fetching purchase order:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch purchase order'
    });
  }
}

/**
 * Update a purchase order
 */
export async function updatePurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { poId } = req.params;
    const updates = req.body;

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'];
      if (!validStatuses.includes(updates.status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
        return;
      }
    }

    const po = await poRepository.updatePurchaseOrder(poId, updates);

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: po
    });

    logger.info(`Purchase order updated: ${poId}`);
  } catch (error) {
    logger.error('Error updating purchase order:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update purchase order'
    });
  }
}

/**
 * Receive items from a purchase order
 */
export async function receiveItems(req: Request, res: Response): Promise<void> {
  try {
    const { poId } = req.params;
    const { items } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
      return;
    }

    for (const item of items) {
      if (!item.itemId) {
        res.status(400).json({
          success: false,
          message: 'All items must have an itemId'
        });
        return;
      }

      if (!item.quantityReceived || item.quantityReceived <= 0) {
        res.status(400).json({
          success: false,
          message: 'All items must have a positive quantityReceived'
        });
        return;
      }
    }

    const po = await poRepository.receiveItems(poId, items);

    res.json({
      success: true,
      message: `Received ${items.length} ${items.length === 1 ? 'item' : 'items'} successfully`,
      data: po
    });

    logger.info(`Items received for purchase order: ${poId}`, { itemsCount: items.length });
  } catch (error) {
    logger.error('Error receiving items:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to receive items'
    });
  }
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { poId } = req.params;

    const po = await poRepository.cancelPurchaseOrder(poId);

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: po
    });

    logger.info(`Purchase order cancelled: ${poId}`);
  } catch (error) {
    logger.error('Error cancelling purchase order:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel purchase order'
    });
  }
}

/**
 * Delete a purchase order (only if draft)
 */
export async function deletePurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { poId } = req.params;

    await poRepository.deletePurchaseOrder(poId);

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });

    logger.info(`Purchase order deleted: ${poId}`);
  } catch (error) {
    logger.error('Error deleting purchase order:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete purchase order'
    });
  }
}

/**
 * Get purchase order statistics
 */
export async function getPurchaseOrderStats(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    const stats = await poRepository.getPurchaseOrderStats(shopId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching purchase order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order statistics'
    });
  }
}
