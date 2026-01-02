// ============================================
// Chart Data Types
// ============================================

export interface ChartDataPoint {
  value: number;
  label?: string;
  dataPointText?: string;
}

export interface ProfitData {
  date: string;
  revenue: number;
  costs: number;
  profit: number;
  rcnPurchased: number;
  rcnIssued: number;
  profitMargin: number;
}

export interface ProfitMetrics {
  totalProfit: number;
  totalRevenue: number;
  totalCosts: number;
  averageProfitMargin: number;
  profitTrend: "up" | "down" | "flat";
}

// ============================================
// API Response Types
// ============================================

export interface Transaction {
  id: string;
  type: "reward" | "redemption" | "mint" | "purchase";
  amount: number;
  customerAddress: string | null;
  customerName: string | null;
  repairAmount: number | null;
  status: string;
  createdAt: string;
  failureReason: string | null;
  is_tier_bonus: boolean;
  totalCost?: number;
  paymentMethod?: string;
  paymentReference?: string;
}

export interface Purchase {
  id: string;
  amount: number;
  total_cost: number;
  status: string;
  created_at: string;
  payment_method?: string;
  payment_reference?: string;
}

export interface TransactionsResponse {
  success: boolean;
  data: {
    transactions: Transaction[];
    total: number;
    totalPages: number;
    page: number;
  };
}

export interface PurchasesResponse {
  success: boolean;
  data: {
    items: Purchase[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}

// ============================================
// Time Range Types
// ============================================

export type TimeRange = "month" | "year";

export type ChartFilter = "Profit & Loss Over Time" | "Revenue vs Cost";
