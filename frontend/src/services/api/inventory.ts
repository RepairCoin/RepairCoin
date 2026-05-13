// frontend/src/services/api/inventory.ts
import apiClient from './client';
import type {
  InventoryItem,
  InventoryItemWithDetails,
  InventoryCategory,
  InventoryVendor,
  InventoryAdjustment,
  InventoryStats,
  InventoryFilters,
  CreateInventoryItemData,
  UpdateInventoryItemData,
  CreateCategoryData,
  UpdateCategoryData,
  CreateVendorData,
  UpdateVendorData,
  AdjustStockData,
  PaginatedInventoryResponse,
} from '@/types/inventory';

// ============================================================================
// INVENTORY ITEMS
// ============================================================================

export const inventoryApi = {
  // Get inventory statistics
  async getStats(): Promise<InventoryStats> {
    const response = await apiClient.get('/inventory/stats');
    return response.stats;
  },

  // Get inventory items with filters and pagination
  async getItems(
    filters: InventoryFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedInventoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.vendorId) params.append('vendorId', filters.vendorId);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.outOfStock) params.append('outOfStock', 'true');
    if (filters.sortBy) params.append('sortBy', filters.sortBy);

    const response = await apiClient.get(`/inventory/items?${params.toString()}`);
    return response;
  },

  // Get single inventory item
  async getItem(itemId: string): Promise<InventoryItem> {
    const response = await apiClient.get(`/inventory/items/${itemId}`);
    return response.item;
  },

  // Create new inventory item
  async createItem(data: CreateInventoryItemData): Promise<InventoryItem> {
    const response = await apiClient.post('/inventory/items', data);
    return response.item;
  },

  // Update inventory item
  async updateItem(itemId: string, data: UpdateInventoryItemData): Promise<InventoryItem> {
    const response = await apiClient.put(`/inventory/items/${itemId}`, data);
    return response.item;
  },

  // Delete inventory item
  async deleteItem(itemId: string): Promise<void> {
    await apiClient.delete(`/inventory/items/${itemId}`);
  },

  // Bulk delete items
  async bulkDeleteItems(itemIds: string[]): Promise<number> {
    const response = await apiClient.post('/inventory/items/bulk/delete', { itemIds });
    return response.deletedCount;
  },

  // Bulk update items
  async bulkUpdateItems(itemIds: string[], updates: UpdateInventoryItemData): Promise<number> {
    const response = await apiClient.post('/inventory/items/bulk/update', { itemIds, updates });
    return response.updatedCount;
  },

  // ============================================================================
  // STOCK ADJUSTMENTS
  // ============================================================================

  // Adjust stock quantity
  async adjustStock(itemId: string, data: AdjustStockData): Promise<InventoryAdjustment> {
    const response = await apiClient.post(`/inventory/items/${itemId}/adjust`, data);
    return response.adjustment;
  },

  // Get adjustment history
  async getAdjustments(
    itemId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: InventoryAdjustment[]; pagination: any }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await apiClient.get(`/inventory/items/${itemId}/adjustments?${params.toString()}`);
    return response;
  },

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  // Get all categories
  async getCategories(): Promise<InventoryCategory[]> {
    const response = await apiClient.get('/inventory/categories');
    return response.categories;
  },

  // Create category
  async createCategory(data: CreateCategoryData): Promise<InventoryCategory> {
    const response = await apiClient.post('/inventory/categories', data);
    return response.category;
  },

  // Update category
  async updateCategory(categoryId: string, data: UpdateCategoryData): Promise<InventoryCategory> {
    const response = await apiClient.put(`/inventory/categories/${categoryId}`, data);
    return response.category;
  },

  // Delete category
  async deleteCategory(categoryId: string): Promise<void> {
    await apiClient.delete(`/inventory/categories/${categoryId}`);
  },

  // ============================================================================
  // VENDORS
  // ============================================================================

  // Get all vendors
  async getVendors(): Promise<InventoryVendor[]> {
    const response = await apiClient.get('/inventory/vendors');
    return response.vendors;
  },

  // Create vendor
  async createVendor(data: CreateVendorData): Promise<InventoryVendor> {
    const response = await apiClient.post('/inventory/vendors', data);
    return response.vendor;
  },

  // Update vendor
  async updateVendor(vendorId: string, data: UpdateVendorData): Promise<InventoryVendor> {
    const response = await apiClient.put(`/inventory/vendors/${vendorId}`, data);
    return response.vendor;
  },

  // Delete vendor
  async deleteVendor(vendorId: string): Promise<void> {
    await apiClient.delete(`/inventory/vendors/${vendorId}`);
  },

  // ============================================================================
  // IMAGE UPLOAD
  // ============================================================================

  // Upload inventory item image
  async uploadImage(file: File): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiClient.post('/inventory/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },

  // ============================================================================
  // PURCHASE ORDERS (v2.0)
  // ============================================================================

  // Get purchase order statistics
  async getPurchaseOrderStats(shopId: string): Promise<import('@/types/inventory').PurchaseOrderStats> {
    const response = await apiClient.get(`/inventory/purchase-orders/stats/${shopId}`);
    return response.stats;
  },

  // Get all purchase orders
  async getPurchaseOrders(shopId: string, status?: string): Promise<import('@/types/inventory').PurchaseOrder[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await apiClient.get(`/inventory/purchase-orders/${shopId}?${params.toString()}`);
    return response.purchaseOrders;
  },

  // Get single purchase order
  async getPurchaseOrder(shopId: string, poId: string): Promise<import('@/types/inventory').PurchaseOrder> {
    const response = await apiClient.get(`/inventory/purchase-orders/${shopId}/${poId}`);
    return response.purchaseOrder;
  },

  // Create purchase order
  async createPurchaseOrder(shopId: string, data: import('@/types/inventory').CreatePurchaseOrderData): Promise<import('@/types/inventory').PurchaseOrder> {
    const response = await apiClient.post(`/inventory/purchase-orders/${shopId}`, data);
    return response.purchaseOrder;
  },

  // Update purchase order
  async updatePurchaseOrder(shopId: string, poId: string, data: import('@/types/inventory').UpdatePurchaseOrderData): Promise<import('@/types/inventory').PurchaseOrder> {
    const response = await apiClient.put(`/inventory/purchase-orders/${shopId}/${poId}`, data);
    return response.purchaseOrder;
  },

  // Receive items from purchase order
  async receiveItems(shopId: string, poId: string, data: import('@/types/inventory').ReceiveItemsData): Promise<import('@/types/inventory').PurchaseOrder> {
    const response = await apiClient.post(`/inventory/purchase-orders/${shopId}/${poId}/receive`, data);
    return response.purchaseOrder;
  },

  // Cancel purchase order
  async cancelPurchaseOrder(shopId: string, poId: string): Promise<import('@/types/inventory').PurchaseOrder> {
    const response = await apiClient.post(`/inventory/purchase-orders/${shopId}/${poId}/cancel`);
    return response.purchaseOrder;
  },

  // Delete purchase order (draft only)
  async deletePurchaseOrder(shopId: string, poId: string): Promise<void> {
    await apiClient.delete(`/inventory/purchase-orders/${shopId}/${poId}`);
  },

  // ============================================================================
  // ANALYTICS (v2.0)
  // ============================================================================

  // Get inventory overview analytics
  async getOverviewAnalytics(shopId: string, period: number = 30): Promise<import('@/types/inventory').InventoryOverviewAnalytics> {
    const response = await apiClient.get(`/inventory/analytics/${shopId}/overview?period=${period}`);
    return response.analytics;
  },

  // Get inventory turnover analytics
  async getTurnoverAnalytics(shopId: string, period: number = 90): Promise<import('@/types/inventory').InventoryTurnoverAnalytics> {
    const response = await apiClient.get(`/inventory/analytics/${shopId}/turnover?period=${period}`);
    return response.analytics;
  },

  // Get profit margin analytics
  async getProfitMarginAnalytics(shopId: string): Promise<import('@/types/inventory').ProfitMarginAnalytics> {
    const response = await apiClient.get(`/inventory/analytics/${shopId}/margins`);
    return response.analytics;
  },

  // Get stock level trends
  async getStockTrendAnalytics(shopId: string, period: number = 30): Promise<import('@/types/inventory').StockTrendAnalytics> {
    const response = await apiClient.get(`/inventory/analytics/${shopId}/trends?period=${period}`);
    return response.analytics;
  },

  // Get low stock forecast
  async getLowStockForecast(shopId: string, days: number = 7): Promise<import('@/types/inventory').LowStockForecastAnalytics> {
    const response = await apiClient.get(`/inventory/analytics/${shopId}/forecast?days=${days}`);
    return response.analytics;
  },

  // ============================================================================
  // LOW STOCK ALERTS (v2.0)
  // ============================================================================

  // Get alert settings
  async getAlertSettings(shopId: string): Promise<import('@/types/inventory').LowStockAlertSettings> {
    const response = await apiClient.get(`/inventory/alerts/settings/${shopId}`);
    return response.settings;
  },

  // Update alert settings
  async updateAlertSettings(shopId: string, settings: import('@/types/inventory').LowStockAlertSettings): Promise<import('@/types/inventory').LowStockAlertSettings> {
    const response = await apiClient.put(`/inventory/alerts/settings/${shopId}`, settings);
    return response.settings;
  },

  // Get low stock items
  async getLowStockItems(shopId: string): Promise<import('@/types/inventory').LowStockItem[]> {
    const response = await apiClient.get(`/inventory/alerts/low-stock/${shopId}`);
    return response.items;
  },

  // Trigger manual alert check
  async triggerAlertCheck(shopId: string): Promise<import('@/types/inventory').LowStockAlertResult> {
    const response = await apiClient.post(`/inventory/alerts/check/${shopId}`);
    return response.data;
  },

  // ============================================================================
  // SERVICE INTEGRATION (v2.0)
  // ============================================================================

  // Link items to service
  async linkItemsToService(serviceId: string, data: import('@/types/inventory').LinkItemsToServiceData): Promise<void> {
    await apiClient.post(`/inventory/service-integration/link/${serviceId}`, data);
  },

  // Get service inventory items
  async getServiceInventoryItems(serviceId: string): Promise<import('@/types/inventory').ServiceInventoryItemsResponse> {
    const response = await apiClient.get(`/inventory/service-integration/service/${serviceId}`);
    return response.data;
  },

  // Check service stock availability
  async checkServiceStockAvailability(serviceId: string): Promise<import('@/types/inventory').ServiceStockAvailability> {
    const response = await apiClient.get(`/inventory/service-integration/availability/${serviceId}`);
    return response.data;
  },

  // Unlink item from service
  async unlinkItemFromService(serviceId: string, linkId: string): Promise<void> {
    await apiClient.delete(`/inventory/service-integration/link/${serviceId}/${linkId}`);
  },

  // Get services using item
  async getServicesUsingItem(itemId: string): Promise<{ services: import('@/types/inventory').ServiceUsingItem[]; count: number }> {
    const response = await apiClient.get(`/inventory/service-integration/item/${itemId}/services`);
    return response.data;
  },
};
