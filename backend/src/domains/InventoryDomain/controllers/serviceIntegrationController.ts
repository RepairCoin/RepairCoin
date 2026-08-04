// backend/src/domains/InventoryDomain/controllers/serviceIntegrationController.ts
import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { eventBus } from '../../../events/EventBus';
import { InventoryRepository } from '../../../repositories/InventoryRepository';

const pool = getSharedPool();
const inventoryRepo = new InventoryRepository();

/**
 * Link inventory items to a service
 */
export async function linkItemsToService(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId } = req.params;
    const { shopId, items } = req.body;

    // Validation
    if (!shopId) {
      res.status(400).json({
        success: false,
        message: 'Shop ID is required'
      });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty'
      });
      return;
    }

    // Delete existing links for this service
    await pool.query('DELETE FROM service_inventory_items WHERE service_id = $1', [serviceId]);

    // Insert new links
    for (const item of items) {
      if (!item.inventoryItemId || !item.quantityRequired || item.quantityRequired <= 0) {
        res.status(400).json({
          success: false,
          message: 'Each item must have inventoryItemId and valid quantityRequired'
        });
        return;
      }

      const query = `
        INSERT INTO service_inventory_items (
          service_id, shop_id, inventory_item_id, quantity_required, is_optional
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      await pool.query(query, [
        serviceId,
        shopId,
        item.inventoryItemId,
        item.quantityRequired,
        item.isOptional || false
      ]);
    }

    res.json({
      success: true,
      message: `${items.length} ${items.length === 1 ? 'item' : 'items'} linked to service successfully`
    });

    logger.info(`Inventory items linked to service: ${serviceId}`, { itemsCount: items.length });
  } catch (error) {
    logger.error('Error linking items to service:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to link items to service'
    });
  }
}

/**
 * Get inventory items linked to a service
 */
export async function getServiceInventoryItems(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId } = req.params;

    const query = `
      SELECT
        sii.id,
        sii.service_id,
        sii.inventory_item_id,
        sii.quantity_required,
        sii.is_optional,
        i.name as item_name,
        i.sku,
        i.stock_quantity,
        i.low_stock_threshold,
        i.status,
        i.price,
        i.images
      FROM service_inventory_items sii
      INNER JOIN inventory_items i ON sii.inventory_item_id = i.id
      WHERE sii.service_id = $1
        AND i.deleted_at IS NULL
      ORDER BY sii.is_optional ASC, i.name ASC
    `;

    const result = await pool.query(query, [serviceId]);

    const items = result.rows.map(row => ({
      id: row.id,
      serviceId: row.service_id,
      inventoryItemId: row.inventory_item_id,
      quantityRequired: parseInt(row.quantity_required),
      isOptional: row.is_optional,
      itemName: row.item_name,
      sku: row.sku,
      stockQuantity: parseInt(row.stock_quantity),
      lowStockThreshold: parseInt(row.low_stock_threshold),
      status: row.status,
      price: parseFloat(row.price),
      images: row.images,
      hasEnoughStock: parseInt(row.stock_quantity) >= parseInt(row.quantity_required),
      isLowStock: row.status === 'low_stock' || row.status === 'out_of_stock'
    }));

    // Check if service can be completed based on stock availability
    const requiredItems = items.filter(i => !i.isOptional);
    const canComplete = requiredItems.every(i => i.hasEnoughStock);

    res.json({
      success: true,
      data: {
        items,
        summary: {
          total: items.length,
          required: requiredItems.length,
          optional: items.filter(i => i.isOptional).length,
          canComplete,
          lowStockItems: items.filter(i => i.isLowStock).length
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching service inventory items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service inventory items'
    });
  }
}

/**
 * Check stock availability for a service
 */
export async function checkServiceStockAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId } = req.params;

    const query = `
      SELECT
        sii.inventory_item_id,
        sii.quantity_required,
        sii.is_optional,
        i.name,
        i.stock_quantity,
        i.status
      FROM service_inventory_items sii
      INNER JOIN inventory_items i ON sii.inventory_item_id = i.id
      WHERE sii.service_id = $1
        AND i.deleted_at IS NULL
    `;

    const result = await pool.query(query, [serviceId]);

    const requiredItems = result.rows.filter(row => !row.is_optional);
    const unavailableItems = requiredItems.filter(row =>
      parseInt(row.stock_quantity) < parseInt(row.quantity_required)
    );

    const isAvailable = unavailableItems.length === 0;

    res.json({
      success: true,
      data: {
        isAvailable,
        totalItems: result.rows.length,
        requiredItems: requiredItems.length,
        unavailableItems: unavailableItems.map(row => ({
          name: row.name,
          required: parseInt(row.quantity_required),
          available: parseInt(row.stock_quantity),
          shortage: parseInt(row.quantity_required) - parseInt(row.stock_quantity)
        }))
      }
    });
  } catch (error) {
    logger.error('Error checking service stock availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check service stock availability'
    });
  }
}

export interface StockDeductionContext {
  locationId?: string | null;
  referenceType?: string;
  units?: number;
}

/**
 * Deduct inventory stock when service is completed
 * This is called via event listener when a service order is completed
 */
export async function deductStockForService(
  serviceId: string,
  orderId: string,
  shopId: string,
  context: StockDeductionContext = {}
): Promise<void> {
  const units = context.units && context.units > 0 ? context.units : 1;

  try {
    logger.info(`Deducting stock for completed service: ${serviceId}`, { orderId, shopId, units });

    // Get linked inventory items
    const query = `
      SELECT
        sii.inventory_item_id,
        sii.quantity_required,
        sii.is_optional,
        i.name,
        i.stock_quantity
      FROM service_inventory_items sii
      INNER JOIN inventory_items i ON sii.inventory_item_id = i.id
      WHERE sii.service_id = $1
        AND i.deleted_at IS NULL
    `;

    const result = await pool.query(query, [serviceId]);

    if (result.rows.length === 0) {
      logger.info(`No inventory items linked to service ${serviceId}, skipping stock deduction`);
      return;
    }

    for (const row of result.rows) {
      // Selling the same service twice on one line consumes its parts twice.
      const quantityNeeded = parseInt(row.quantity_required) * units;

      if (parseInt(row.stock_quantity) < quantityNeeded && !row.is_optional) {
        logger.warn(`Insufficient stock for item ${row.name} (${row.inventory_item_id})`, {
          currentStock: parseInt(row.stock_quantity),
          quantityNeeded,
          serviceId,
          orderId
        });
      }

      await deductBranchStock({
        itemId: row.inventory_item_id,
        shopId,
        locationId: context.locationId,
        quantity: quantityNeeded,
        reason: `Used in service (${serviceId})`,
        referenceType: context.referenceType || 'service_order',
        referenceId: orderId
      });
    }

    logger.info(`Stock deduction completed for service ${serviceId}`, { orderId, itemsProcessed: result.rows.length });
  } catch (error) {
    logger.error('Error deducting stock for service:', error);
    // Don't throw - log the error but don't fail the service completion
  }
}

/**
 * Remove inventory item link from a service
 */
export async function unlinkItemFromService(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId, linkId } = req.params;

    const query = `
      DELETE FROM service_inventory_items
      WHERE id = $1 AND service_id = $2
    `;

    const result = await pool.query(query, [linkId, serviceId]);

    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Link not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Item unlinked from service successfully'
    });

    logger.info(`Item unlinked from service: ${serviceId}`, { linkId });
  } catch (error) {
    logger.error('Error unlinking item from service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlink item from service'
    });
  }
}

/**
 * Get all services that use a specific inventory item
 */
export async function getServicesUsingItem(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    const query = `
      SELECT
        s.service_id,
        s.service_name,
        s.category,
        s.price_usd,
        s.active,
        sii.quantity_required,
        sii.is_optional
      FROM service_inventory_items sii
      INNER JOIN shop_services s ON sii.service_id = s.service_id
      WHERE sii.inventory_item_id = $1
      ORDER BY s.service_name ASC
    `;

    const result = await pool.query(query, [itemId]);

    const services = result.rows.map(row => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      category: row.category,
      price: parseFloat(row.price_usd),
      active: row.active,
      quantityRequired: parseInt(row.quantity_required),
      isOptional: row.is_optional
    }));

    res.json({
      success: true,
      data: {
        services,
        count: services.length
      }
    });
  } catch (error) {
    logger.error('Error fetching services using item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services using this item'
    });
  }
}

/**
 * Routes every sale deduction through adjustStock so the branch's own `inventory_item_stock` row
 * moves alongside the item's shop-wide total. Writing only the total leaves a multi-location
 * shop's per-branch figures drifting from reality the moment anything sells at a counter.
 */
async function deductBranchStock(params: {
  itemId: string;
  shopId: string;
  locationId?: string | null;
  quantity: number;
  reason: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  // Swallowed per item: the money has already changed hands, and one unresolvable item must not
  // stop the rest of the sale's lines from coming down.
  try {
    await inventoryRepo.adjustStock({
      itemId: params.itemId,
      shopId: params.shopId,
      locationId: params.locationId || undefined,
      adjustmentType: 'sale',
      quantityChange: -params.quantity,
      reason: params.reason,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      adjustedBy: 'system',
      clampToZero: true
    });
  } catch (error) {
    logger.error('Error deducting stock', {
      itemId: params.itemId,
      shopId: params.shopId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Deduct a product sold directly over the counter. Distinct from deductStockForService, which
 * consumes the PARTS linked to a service — a retail line is the item itself.
 */
export async function deductStockForProduct(
  inventoryItemId: string,
  quantity: number,
  shopId: string,
  saleId: string,
  locationId?: string | null
): Promise<void> {
  await deductBranchStock({
    itemId: inventoryItemId,
    shopId,
    locationId,
    quantity,
    reason: 'Sold at point of sale',
    referenceType: 'pos_sale',
    referenceId: saleId
  });
}

export function setupPosSaleListener(): void {
  eventBus.subscribe(
    'pos.sale_completed',
    async (event: {
      data: {
        saleId: string;
        shopId: string;
        locationId: string | null;
        items: Array<{
          kind: string;
          serviceId: string | null;
          inventoryItemId: string | null;
          quantity: number;
        }>;
      };
    }) => {
      const { saleId, shopId, locationId, items } = event.data;
      for (const item of items ?? []) {
        if (item.kind === 'product' && item.inventoryItemId) {
          await deductStockForProduct(item.inventoryItemId, item.quantity, shopId, saleId, locationId);
        } else if (item.kind === 'service' && item.serviceId) {
          await deductStockForService(item.serviceId, saleId, shopId, {
            locationId,
            referenceType: 'pos_sale',
            units: item.quantity
          });
        }
      }
    },
    'InventoryDomain:PosSale'
  );

  logger.info('POS sale listener registered for inventory stock deduction');
}

// Setup event listener for service completion
export function setupServiceCompletionListener(): void {
  eventBus.subscribe('service:completed', async (event: {
    data: { serviceId: string; orderId: string; shopId: string }
  }) => {
    const { serviceId, orderId, shopId } = event.data;
    await deductStockForService(serviceId, orderId, shopId);
  }, 'InventoryDomain:ServiceIntegration');

  logger.info('Service completion listener registered for inventory stock deduction');
}
