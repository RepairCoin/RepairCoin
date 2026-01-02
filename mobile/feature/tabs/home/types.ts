import { CustomerGrowthData, ShopData } from "@/interfaces/shop.interface";

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
