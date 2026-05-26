// backend/src/domains/InventoryDomain/routes.ts
import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';

// Controllers
import * as inventoryController from './controllers/inventoryController';
import * as categoryController from './controllers/categoryController';
import * as vendorController from './controllers/vendorController';
import * as adjustmentController from './controllers/adjustmentController';
import * as uploadController from './controllers/uploadController';
import * as alertController from './controllers/alertController';
import * as purchaseOrderController from './controllers/purchaseOrderController';
import * as analyticsController from './controllers/analyticsController';
import * as serviceIntegrationController from './controllers/serviceIntegrationController';
import * as poSuggestionController from './controllers/poSuggestionController';

export function initializeRoutes(): Router {
  const router = Router();

  // All inventory routes require authentication and shop role
  const shopAuth = [authMiddleware, requireRole(['shop'])];

  // ============================================================================
  // INVENTORY ITEMS ROUTES
  // ============================================================================

  // Upload inventory item image
  router.post('/upload-image', shopAuth, uploadController.uploadSingleImage, uploadController.uploadInventoryImage);

  // Get inventory statistics
  router.get('/stats', shopAuth, inventoryController.getInventoryStats);

  // Get all items (with filters and pagination)
  router.get('/items', shopAuth, inventoryController.getInventoryItems);

  // Get single item by ID
  router.get('/items/:itemId', shopAuth, inventoryController.getInventoryItem);

  // Get item by barcode (for barcode scanning)
  router.get('/items/barcode/:barcode', shopAuth, inventoryController.getInventoryItemByBarcode);

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

  // ============================================================================
  // LOW STOCK ALERTS ROUTES
  // ============================================================================

  // Get alert settings
  router.get('/alerts/settings/:shopId', shopAuth, alertController.getAlertSettings);

  // Update alert settings
  router.put('/alerts/settings/:shopId', shopAuth, alertController.updateAlertSettings);

  // Get low stock items (without sending email)
  router.get('/alerts/low-stock/:shopId', shopAuth, alertController.getLowStockItems);

  // Trigger manual alert check
  router.post('/alerts/check/:shopId', shopAuth, alertController.triggerManualCheck);

  // Admin routes for scheduler management
  const adminAuth = [authMiddleware, requireRole(['admin'])];
  router.get('/alerts/scheduler/status', adminAuth, alertController.getSchedulerStatus);
  router.post('/alerts/scheduler/run', adminAuth, alertController.runSchedulerNow);

  // ============================================================================
  // PURCHASE ORDERS ROUTES
  // ============================================================================

  // Get purchase order statistics
  router.get('/purchase-orders/stats/:shopId', shopAuth, purchaseOrderController.getPurchaseOrderStats);

  // Get all purchase orders
  router.get('/purchase-orders/:shopId', shopAuth, purchaseOrderController.getPurchaseOrders);

  // Get single purchase order
  router.get('/purchase-orders/:shopId/:poId', shopAuth, purchaseOrderController.getPurchaseOrder);

  // Create purchase order
  router.post('/purchase-orders/:shopId', shopAuth, purchaseOrderController.createPurchaseOrder);

  // Update purchase order
  router.put('/purchase-orders/:shopId/:poId', shopAuth, purchaseOrderController.updatePurchaseOrder);

  // Receive items
  router.post('/purchase-orders/:shopId/:poId/receive', shopAuth, purchaseOrderController.receiveItems);

  // Cancel purchase order
  router.post('/purchase-orders/:shopId/:poId/cancel', shopAuth, purchaseOrderController.cancelPurchaseOrder);

  // Delete purchase order
  router.delete('/purchase-orders/:shopId/:poId', shopAuth, purchaseOrderController.deletePurchaseOrder);

  // ============================================================================
  // PO SUGGESTIONS ROUTES (v2.1)
  // ============================================================================

  // Generate PO suggestions for a shop
  router.post('/suggestions/:shopId/generate', shopAuth, poSuggestionController.generateSuggestions);

  // Get PO suggestions with optional filtering
  router.get('/suggestions/:shopId', shopAuth, poSuggestionController.getSuggestions);

  // Approve a PO suggestion
  router.post('/suggestions/:id/approve', shopAuth, poSuggestionController.approveSuggestion);

  // Reject a PO suggestion
  router.post('/suggestions/:id/reject', shopAuth, poSuggestionController.rejectSuggestion);

  // Expire old suggestions (admin/scheduler)
  router.post('/suggestions/expire', adminAuth, poSuggestionController.expireOldSuggestions);

  // Accuracy tracking routes (v2.1)
  router.post('/suggestions/:id/assess-accuracy', shopAuth, poSuggestionController.assessSuggestionAccuracy);
  router.get('/suggestions/:shopId/accuracy-metrics', shopAuth, poSuggestionController.getAccuracyMetrics);
  router.post('/suggestions/auto-assess-accuracy', adminAuth, poSuggestionController.autoAssessSuggestionAccuracy);

  // ============================================================================
  // ANALYTICS ROUTES
  // ============================================================================

  // Get overall inventory analytics
  router.get('/analytics/:shopId/overview', shopAuth, analyticsController.getInventoryAnalytics);

  // Get inventory turnover analysis
  router.get('/analytics/:shopId/turnover', shopAuth, analyticsController.getInventoryTurnover);

  // Get profit margin analysis
  router.get('/analytics/:shopId/margins', shopAuth, analyticsController.getProfitMargins);

  // Get stock level trends
  router.get('/analytics/:shopId/trends', shopAuth, analyticsController.getStockTrends);

  // Get low stock forecast
  router.get('/analytics/:shopId/forecast', shopAuth, analyticsController.getLowStockForecast);

  // ============================================================================
  // SERVICE INTEGRATION ROUTES
  // ============================================================================

  // Link inventory items to a service
  router.post('/service-integration/link/:serviceId', shopAuth, serviceIntegrationController.linkItemsToService);

  // Get inventory items linked to a service
  router.get('/service-integration/service/:serviceId', shopAuth, serviceIntegrationController.getServiceInventoryItems);

  // Check stock availability for a service
  router.get('/service-integration/availability/:serviceId', shopAuth, serviceIntegrationController.checkServiceStockAvailability);

  // Remove inventory item link from service
  router.delete('/service-integration/link/:serviceId/:linkId', shopAuth, serviceIntegrationController.unlinkItemFromService);

  // Get all services using a specific inventory item
  router.get('/service-integration/item/:itemId/services', shopAuth, serviceIntegrationController.getServicesUsingItem);

  return router;
}
