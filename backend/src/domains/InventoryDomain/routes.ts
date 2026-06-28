// backend/src/domains/InventoryDomain/routes.ts
import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { requireShopPermission } from '../../middleware/permissions';

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

  // All inventory routes require authentication and shop role, plus a granular
  // team permission: inventory:view/manage for stock, pos:view/manage for orders.
  const base = [authMiddleware, requireRole(['shop'])];
  const invView = [...base, requireShopPermission('inventory:view')];
  const invManage = [...base, requireShopPermission('inventory:manage')];
  const posView = [...base, requireShopPermission('pos:view')];
  const posManage = [...base, requireShopPermission('pos:manage')];

  // ============================================================================
  // INVENTORY ITEMS ROUTES
  // ============================================================================

  // Upload inventory item image
  router.post('/upload-image', invManage, uploadController.uploadSingleImage, uploadController.uploadInventoryImage);

  // Get inventory statistics
  router.get('/stats', invView, inventoryController.getInventoryStats);

  // Get all items (with filters and pagination)
  router.get('/items', invView, inventoryController.getInventoryItems);

  // Get single item by ID
  router.get('/items/:itemId', invView, inventoryController.getInventoryItem);

  // Get item by barcode (for barcode scanning)
  router.get('/items/barcode/:barcode', invView, inventoryController.getInventoryItemByBarcode);

  // Create new item
  router.post('/items', invManage, inventoryController.createInventoryItem);

  // Update item
  router.put('/items/:itemId', invManage, inventoryController.updateInventoryItem);

  // Delete item
  router.delete('/items/:itemId', invManage, inventoryController.deleteInventoryItem);

  // Bulk operations
  router.post('/items/bulk/delete', invManage, inventoryController.bulkDeleteItems);
  router.post('/items/bulk/update', invManage, inventoryController.bulkUpdateItems);

  // ============================================================================
  // STOCK ADJUSTMENTS ROUTES
  // ============================================================================

  // Adjust stock for an item
  router.post('/items/:itemId/adjust', invManage, adjustmentController.adjustStock);

  // Get adjustment history for an item
  router.get('/items/:itemId/adjustments', invView, adjustmentController.getItemAdjustments);

  // ============================================================================
  // CATEGORIES ROUTES
  // ============================================================================

  // Get all categories
  router.get('/categories', invView, categoryController.getCategories);

  // Create category
  router.post('/categories', invManage, categoryController.createCategory);

  // Update category
  router.put('/categories/:categoryId', invManage, categoryController.updateCategory);

  // Delete category
  router.delete('/categories/:categoryId', invManage, categoryController.deleteCategory);

  // ============================================================================
  // VENDORS ROUTES
  // ============================================================================

  // Get all vendors
  router.get('/vendors', invView, vendorController.getVendors);

  // Create vendor
  router.post('/vendors', invManage, vendorController.createVendor);

  // Update vendor
  router.put('/vendors/:vendorId', invManage, vendorController.updateVendor);

  // Delete vendor
  router.delete('/vendors/:vendorId', invManage, vendorController.deleteVendor);

  // ============================================================================
  // LOW STOCK ALERTS ROUTES
  // ============================================================================

  // Get alert settings
  router.get('/alerts/settings/:shopId', invView, alertController.getAlertSettings);

  // Update alert settings
  router.put('/alerts/settings/:shopId', invManage, alertController.updateAlertSettings);

  // Get low stock items (without sending email)
  router.get('/alerts/low-stock/:shopId', invView, alertController.getLowStockItems);

  // Trigger manual alert check
  router.post('/alerts/check/:shopId', invManage, alertController.triggerManualCheck);

  // Admin routes for scheduler management
  const adminAuth = [authMiddleware, requireRole(['admin'])];
  router.get('/alerts/scheduler/status', adminAuth, alertController.getSchedulerStatus);
  router.post('/alerts/scheduler/run', adminAuth, alertController.runSchedulerNow);

  // ============================================================================
  // PURCHASE ORDERS ROUTES
  // ============================================================================

  // Get purchase order statistics
  router.get('/purchase-orders/stats/:shopId', posView, purchaseOrderController.getPurchaseOrderStats);

  // Get all purchase orders
  router.get('/purchase-orders/:shopId', posView, purchaseOrderController.getPurchaseOrders);

  // Get single purchase order
  router.get('/purchase-orders/:shopId/:poId', posView, purchaseOrderController.getPurchaseOrder);

  // Create purchase order
  router.post('/purchase-orders/:shopId', posManage, purchaseOrderController.createPurchaseOrder);

  // Update purchase order
  router.put('/purchase-orders/:shopId/:poId', posManage, purchaseOrderController.updatePurchaseOrder);

  // Receive items
  router.post('/purchase-orders/:shopId/:poId/receive', posManage, purchaseOrderController.receiveItems);

  // Cancel purchase order
  router.post('/purchase-orders/:shopId/:poId/cancel', posManage, purchaseOrderController.cancelPurchaseOrder);

  // Delete purchase order
  router.delete('/purchase-orders/:shopId/:poId', posManage, purchaseOrderController.deletePurchaseOrder);

  // ============================================================================
  // PO SUGGESTIONS ROUTES (v2.1)
  // ============================================================================

  // Generate PO suggestions for a shop
  router.post('/suggestions/:shopId/generate', posManage, poSuggestionController.generateSuggestions);

  // Get PO suggestions with optional filtering
  router.get('/suggestions/:shopId', posView, poSuggestionController.getSuggestions);

  // Approve a PO suggestion
  router.post('/suggestions/:id/approve', posManage, poSuggestionController.approveSuggestion);

  // Reject a PO suggestion
  router.post('/suggestions/:id/reject', posManage, poSuggestionController.rejectSuggestion);

  // Expire old suggestions (admin/scheduler)
  router.post('/suggestions/expire', adminAuth, poSuggestionController.expireOldSuggestions);

  // Accuracy tracking routes (v2.1)
  router.post('/suggestions/:id/assess-accuracy', posManage, poSuggestionController.assessSuggestionAccuracy);
  router.get('/suggestions/:shopId/accuracy-metrics', posView, poSuggestionController.getAccuracyMetrics);
  router.post('/suggestions/auto-assess-accuracy', adminAuth, poSuggestionController.autoAssessSuggestionAccuracy);

  // ============================================================================
  // ANALYTICS ROUTES
  // ============================================================================

  // Get overall inventory analytics
  router.get('/analytics/:shopId/overview', invView, analyticsController.getInventoryAnalytics);

  // Get inventory turnover analysis
  router.get('/analytics/:shopId/turnover', invView, analyticsController.getInventoryTurnover);

  // Get profit margin analysis
  router.get('/analytics/:shopId/margins', invView, analyticsController.getProfitMargins);

  // Get stock level trends
  router.get('/analytics/:shopId/trends', invView, analyticsController.getStockTrends);

  // Get low stock forecast
  router.get('/analytics/:shopId/forecast', invView, analyticsController.getLowStockForecast);

  // ============================================================================
  // SERVICE INTEGRATION ROUTES
  // ============================================================================

  // Link inventory items to a service
  router.post('/service-integration/link/:serviceId', invManage, serviceIntegrationController.linkItemsToService);

  // Get inventory items linked to a service
  router.get('/service-integration/service/:serviceId', invView, serviceIntegrationController.getServiceInventoryItems);

  // Check stock availability for a service
  router.get('/service-integration/availability/:serviceId', invView, serviceIntegrationController.checkServiceStockAvailability);

  // Remove inventory item link from service
  router.delete('/service-integration/link/:serviceId/:linkId', invManage, serviceIntegrationController.unlinkItemFromService);

  // Get all services using a specific inventory item
  router.get('/service-integration/item/:itemId/services', invView, serviceIntegrationController.getServicesUsingItem);

  return router;
}
