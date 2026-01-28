import { CustomerGrowthData, ShopData } from "@/shared/interfaces/shop.interface";

export type ShopTabs = "Wallet" | "Analysis" | "Promo Code";

export interface ShopHomeData {
  shopData: ShopData | undefined;
  growthData: CustomerGrowthData | undefined;
  isLoading: boolean;
  error: Error | null;
}

export interface WalletTabProps {
  shopData: ShopData;
  growthData?: CustomerGrowthData;
}

// Analytics Types
export type TimeRange = "month" | "year";
export type ChartFilter = "Profit & Loss Over Time" | "Revenue vs Cost"

export interface ChartDataPoint {
  value: number;
  label: string;
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

export interface ChartDataPoint {
  value: number;
  label: string;
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
