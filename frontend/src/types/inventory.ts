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
  locationId?: string;
  categoryId?: string;
  vendorId?: string;
  status?: InventoryStatus;
  search?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  sortBy?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'newest' | 'oldest';
  productType?: 'cards' | 'sealed' | 'custom';
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
  locationId?: string; // branch to adjust (defaults to the shop's primary server-side)
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

// ============================================================================
// PURCHASE ORDERS (v2.0)
// ============================================================================

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId: string;
  itemName: string;
  itemSku?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  shopId: string;
  vendorId?: string;
  vendorName?: string;
  status: PurchaseOrderStatus;
  orderDate?: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes?: string;
  trackingNumber?: string;
  locationId?: string;
  locationName?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderData {
  vendorId?: string;
  vendorName: string;
  expectedDeliveryDate?: string;
  notes?: string;
  locationId?: string;
  items: Array<{
    inventoryItemId: string;
    itemName: string;
    itemSku?: string;
    quantity: number;
    unitCost: number;
  }>;
}

export interface UpdatePurchaseOrderData {
  vendorId?: string;
  vendorName?: string;
  status?: PurchaseOrderStatus;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  notes?: string;
  trackingNumber?: string;
  locationId?: string | null;
}

export interface ReceiveItemsData {
  items: Array<{
    itemId: string;
    quantityReceived: number;
  }>;
}

export interface PurchaseOrderStats {
  totalOrders: number;
  totalSpending: number;
  pendingOrders: number;
  receivedOrders: number;
  averageOrderValue: number;
}

// ============================================================================
// ANALYTICS (v2.0)
// ============================================================================

export interface InventoryOverviewAnalytics {
  totalItems: number;
  availableItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  profitMargin: number;
  adjustmentsByType: Array<{
    type: string;
    count: number;
    netChange: number;
  }>;
  topItems: Array<{
    id: string;
    name: string;
    value: number;
    stockQuantity: number;
    categoryName?: string;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    itemCount: number;
    totalValue: number;
  }>;
}

export interface InventoryTurnoverItem {
  id: string;
  name: string;
  sku?: string;
  salesCount: number;
  unitsSold: number;
  avgStock: number;
  turnoverRatio: number;
  classification: 'fast' | 'moderate' | 'slow';
  daysToSell: number;
}

export interface InventoryTurnoverAnalytics {
  period: number;
  items: InventoryTurnoverItem[];
  summary: {
    fastMoving: number;
    moderate: number;
    slowMoving: number;
    avgTurnoverRatio: number;
  };
}

export interface ProfitMarginItem {
  id: string;
  name: string;
  sku?: string;
  price: number;
  cost: number;
  unitProfit: number;
  marginPercentage: number;
  marginClassification: 'high' | 'medium' | 'low';
  stockQuantity: number;
  potentialProfit: number;
}

export interface ProfitMarginAnalytics {
  items: ProfitMarginItem[];
  summary: {
    highMargin: number;
    mediumMargin: number;
    lowMargin: number;
    avgMarginPercentage: number;
    totalPotentialProfit: number;
  };
}

export interface StockTrendData {
  date: string;
  added: number;
  removed: number;
  netChange: number;
}

export interface StockTrendAnalytics {
  period: number;
  trends: StockTrendData[];
  summary: {
    totalAdded: number;
    totalRemoved: number;
    netChange: number;
    avgDailyChange: number;
  };
}

export interface LowStockForecastItem {
  id: string;
  name: string;
  sku?: string;
  stockQuantity: number;
  lowStockThreshold: number;
  avgDailyUsage: number;
  daysUntilStockout: number;
  urgency: 'critical' | 'high' | 'moderate';
  estimatedStockoutDate: string;
}

export interface LowStockForecastAnalytics {
  forecastDays: number;
  items: LowStockForecastItem[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
  };
}

// ============================================================================
// LOW STOCK ALERTS (v2.0)
// ============================================================================

export interface LowStockAlertSettings {
  enabled: boolean;
  email?: string;
  frequency: 'daily' | 'weekly';
  digestMode?: 'immediate' | 'daily' | 'weekly' | 'monthly';
  digestDayOfWeek?: number;  // 0-6 (0=Sunday, 6=Saturday)
  digestDayOfMonth?: number;  // 1-28 (safe for all months)
  digestTime?: string;         // HH:MM format (24-hour)
  lastDigestSentAt?: string;   // ISO timestamp
}

export interface LowStockItem {
  id: string;
  name: string;
  sku?: string;
  stockQuantity: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  categoryName?: string;
}

export interface LowStockAlertResult {
  shopId: string;
  shopName: string;
  shopEmail: string;
  itemsCount: number;
  emailSent: boolean;
  error?: string;
}

// ============================================================================
// SERVICE INTEGRATION (v2.0)
// ============================================================================

export interface ServiceInventoryItem {
  id: string;
  serviceId: string;
  inventoryItemId: string;
  quantityRequired: number;
  isOptional: boolean;
  itemName: string;
  sku?: string;
  stockQuantity: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  price: number;
  images: string[];
  hasEnoughStock: boolean;
  isLowStock: boolean;
}

export interface ServiceInventoryItemsResponse {
  items: ServiceInventoryItem[];
  summary: {
    total: number;
    required: number;
    optional: number;
    canComplete: boolean;
    lowStockItems: number;
  };
}

export interface LinkItemsToServiceData {
  shopId: string;
  items: Array<{
    inventoryItemId: string;
    quantityRequired: number;
    isOptional?: boolean;
  }>;
}

export interface ServiceStockAvailability {
  isAvailable: boolean;
  totalItems: number;
  requiredItems: number;
  unavailableItems: Array<{
    name: string;
    required: number;
    available: number;
    shortage: number;
  }>;
}

export interface ServiceUsingItem {
  serviceId: string;
  serviceName: string;
  category?: string;
  price: number;
  active: boolean;
  quantityRequired: number;
  isOptional: boolean;
}

// ============================================================================
// PO SUGGESTIONS (v2.1)
// ============================================================================

export type POSuggestionUrgency = 'low' | 'medium' | 'high' | 'critical';
export type POSuggestionStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'ordered';

export interface VendorComparison {
  vendorId: string;
  vendorName: string;
  unitCost: number;
  totalCost: number;
  leadTimeDays: number;
  estimatedDeliveryDate: string;
  historicalPerformanceScore?: number; // 0-100
  isPreferred: boolean;
  isBestValue: boolean;
  isFastestDelivery: boolean;
  notes?: string;
}

export interface POSuggestion {
  id: string;
  shopId: string;
  itemId: string;
  itemName: string;
  itemSku?: string;
  vendorId?: string;
  vendorName?: string;
  suggestedQuantity: number;
  currentStock: number;
  avgDailyUsage: number;
  daysUntilStockout?: number;
  daysOfSupply?: number;
  urgency: POSuggestionUrgency;
  priorityScore: number;
  reason: string;
  estimatedStockoutDate?: string;
  reorderPoint?: number;
  safetyStock?: number;
  status: POSuggestionStatus;
  createdAt: string;
  expiresAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  orderedAt?: string;
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  purchaseOrderId?: string;
  // NEW: Vendor comparison data
  vendorComparisons?: VendorComparison[];
  recommendedVendorId?: string;
}

export interface POSuggestionFilters {
  urgency?: POSuggestionUrgency;
  status?: POSuggestionStatus;
  minPriority?: number;
}

export interface GenerateSuggestionsResponse {
  suggestions: POSuggestion[];
  count: number;
}

export interface ApproveSuggestionData {
  autoCreatePO?: boolean;
}

export interface RejectSuggestionData {
  reason: string;
}
