// frontend/src/types/inventory.ts

export type InventoryStatus = 'available' | 'low_stock' | 'out_of_stock' | 'discontinued';
export type AdjustmentType = 'manual' | 'purchase' | 'sale' | 'return' | 'damage' | 'loss' | 'recount' | 'transfer';

export interface InventoryItem {
  id: string;
  shopId: string;
  categoryId?: string;
  vendorId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  images: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemWithDetails extends InventoryItem {
  categoryName?: string;
  vendorName?: string;
  availableQuantity: number;
}

export interface InventoryCategory {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryVendor {
  id: string;
  shopId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAdjustment {
  id: string;
  itemId: string;
  shopId: string;
  adjustmentType: AdjustmentType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  notes?: string;
  adjustedBy?: string;
  createdAt: string;
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalCategories: number;
  totalVendors: number;
}

export interface InventoryFilters {
  categoryId?: string;
  vendorId?: string;
  status?: InventoryStatus;
  search?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  sortBy?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'newest' | 'oldest';
}

export interface CreateInventoryItemData {
  categoryId?: string;
  vendorId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateInventoryItemData {
  categoryId?: string;
  vendorId?: string;
  name?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  lowStockThreshold?: number;
  status?: InventoryStatus;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

export interface CreateVendorData {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateVendorData {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface AdjustStockData {
  adjustmentType: AdjustmentType;
  quantityChange: number;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface PaginatedInventoryResponse {
  items: InventoryItemWithDetails[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}
