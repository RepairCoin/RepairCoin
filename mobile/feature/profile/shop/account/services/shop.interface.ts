import { CustomerGrowthData, ShopData } from "@/shared/interfaces/shop.interface";

export type ShopTabs = "Wallet" | "Analysis" | "Promo Code";
export type TimeRange = "day" | "month" | "year";
export type ChartFilter = "Profit & Loss Over Time" | "Revenue vs Cost" | "Profit Margin Trend";

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

export interface ShopEditFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  facebook: string;
  twitter: string;
  instagram: string;
  website: string;
  walletAddress: string;
  logoUrl: string;
  bannerUrl: string;
  location: {
    lat: string;
    lng: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface ProfileTab {
  key: string;
  label: string;
}
