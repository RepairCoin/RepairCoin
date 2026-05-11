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
};
