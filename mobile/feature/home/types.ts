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

// Re-export analytics types for backward compatibility
export type { TimeRange, ChartFilter, ChartDataPoint, ProfitData, ProfitMetrics } from "@/feature/profile/shop/types";
