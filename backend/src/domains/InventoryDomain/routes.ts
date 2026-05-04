// backend/src/domains/InventoryDomain/routes.ts
import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';

// Controllers
import * as inventoryController from './controllers/inventoryController';
import * as categoryController from './controllers/categoryController';
import * as vendorController from './controllers/vendorController';
import * as adjustmentController from './controllers/adjustmentController';

export function initializeRoutes(): Router {
  const router = Router();

  // All inventory routes require authentication and shop role
  const shopAuth = [authMiddleware, requireRole(['shop'])];

  // ============================================================================
  // INVENTORY ITEMS ROUTES
  // ============================================================================

  // Get inventory statistics
  router.get('/stats', shopAuth, inventoryController.getInventoryStats);

  // Get all items (with filters and pagination)
  router.get('/items', shopAuth, inventoryController.getInventoryItems);

  // Get single item by ID
  router.get('/items/:itemId', shopAuth, inventoryController.getInventoryItem);

  // Create new item
  router.post('/items', shopAuth, inventoryController.createInventoryItem);

  // Update item
  router.put('/items/:itemId', shopAuth, inventoryController.updateInventoryItem);

  // Delete item
  router.delete('/items/:itemId', shopAuth, inventoryController.deleteInventoryItem);

  // Bulk operations
  router.post('/items/bulk/delete', shopAuth, inventoryController.bulkDeleteItems);
  router.post('/items/bulk/update', shopAuth, inventoryController.bulkUpdateItems);

  // ============================================================================
  // STOCK ADJUSTMENTS ROUTES
  // ============================================================================

  // Adjust stock for an item
  router.post('/items/:itemId/adjust', shopAuth, adjustmentController.adjustStock);

  // Get adjustment history for an item
  router.get('/items/:itemId/adjustments', shopAuth, adjustmentController.getItemAdjustments);

  // ============================================================================
  // CATEGORIES ROUTES
  // ============================================================================

  // Get all categories
  router.get('/categories', shopAuth, categoryController.getCategories);

  // Create category
  router.post('/categories', shopAuth, categoryController.createCategory);

  // Update category
  router.put('/categories/:categoryId', shopAuth, categoryController.updateCategory);

  // Delete category
  router.delete('/categories/:categoryId', shopAuth, categoryController.deleteCategory);

  // ============================================================================
  // VENDORS ROUTES
  // ============================================================================

  // Get all vendors
  router.get('/vendors', shopAuth, vendorController.getVendors);

  // Create vendor
  router.post('/vendors', shopAuth, vendorController.createVendor);

  // Update vendor
  router.put('/vendors/:vendorId', shopAuth, vendorController.updateVendor);

  // Delete vendor
  router.delete('/vendors/:vendorId', shopAuth, vendorController.deleteVendor);

  return router;
}
