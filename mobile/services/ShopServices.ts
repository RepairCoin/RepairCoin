import { apiClient } from "@/utilities/axios";

export interface Location {
  lat: number;
  lng: number;
  city: string;
  state: string;
  zipCode: string;
}

export interface ShopData {
  acceptTerms: boolean;
  active: boolean;
  address: string;
  companySize: string;
  country: string;
  crossShopEnabled: boolean;
  email: string;
  facebook: string;
  firstName: string;
  instagram: string;
  joinDate: string;
  lastName: string;
  location: Location;
  monthlyRevenue: string;
  name: string;
  phone: string;
  referral: string;
  shopId: string;
  twitter: string;
  verified: boolean;
  website: string;
}

export interface ShopResponse {
  data: {
    count: number;
    shops: ShopData[];
  };
  success: boolean;
  message?: string;
}

export interface ShopByWalletAddressData {
  active: boolean;
  address: string;
  crossShopEnabled: boolean;
  email: string;
  facebook: string;
  instagram: string;
  joinDate: string;
  name: string;
  operational_status: string;
  phone: string;
  purchasedRcnBalance: number;
  rcg_balance: number;
  rcg_tier: string;
  shopId: string;
  totalRcnPurchased: number;
  totalRedemptions: number;
  totalTokensIssued: number;
  twitter: string;
  verified: boolean;
  walletAddress: string;
  website: string;
}

export interface ShopByWalletAddressResponse {
  data: ShopByWalletAddressData;
  success: boolean;
  message?: string;
}

export interface UpdateShopData {
  message: string;
  success: boolean;
}

export const listShops = async (): Promise<ShopResponse> => {
  try {
    return await apiClient.get<ShopResponse>("/shops");
  } catch (error: any) {
    console.error("Failed to list shops:", error.message);
    throw error;
  }
};

export const getShopByWalletAddress = async (
  walletAddress: string
): Promise<ShopByWalletAddressResponse> => {
  try {
    return await apiClient.get<ShopByWalletAddressResponse>(`/shops/wallet/${walletAddress}`);
  } catch (error: any) {
    console.error("Failed to get shop by wallet address:", error.message);
    throw error;
  }
};

export const updateShopDetails = async (shopId: string, shopData: ShopData): Promise<UpdateShopData> => {
  try {
    return await apiClient.put<UpdateShopData>(`/shops/${shopId}/details`, shopData);
  } catch (error: any) {
    console.error("Failed to update shop details:", error.message);
    throw error;
  }
};