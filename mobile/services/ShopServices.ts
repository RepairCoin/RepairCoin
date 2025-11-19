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

export interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  status: string;
  createdAt: string;
  transactionHash?: string;
}

export interface PurchaseTokenResponse {
  data: {
    checkoutUrl: string;
    sessionId: string;
    purchaseId: string;
  };
  success: boolean;
  message?: string;
}

export interface PurchaseHistoryResponse {
  data: {
    purchases: PurchaseHistory[];
    count: number;
  };
  success: boolean;
  message?: string;
}

// Customer and Rewards related interfaces and services
export interface CustomerInfo {
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  isActive?: boolean;
  name?: string;
  email?: string;
}

export interface PromoCode {
  id: string;
  code: string;
  name?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  max_bonus?: number;
  is_active: boolean;
  total_usage_limit?: number;
  times_used?: number;
}

export interface RewardRequest {
  customerAddress: string;
  repairAmount: number;
  skipTierBonus?: boolean;
  promoCode?: string;
  customBaseReward?: number;
}

export interface RewardResponse {
  data: {
    totalReward: number;
    baseReward: number;
    tierBonus: number;
    promoBonus: number;
    transactionHash?: string;
  };
  success: boolean;
  message?: string;
}

export interface PromoValidationRequest {
  code: string;
  customer_address: string;
}

export interface PromoValidationResponse {
  data: {
    is_valid: boolean;
    bonus_type?: "fixed" | "percentage";
    bonus_value?: string;
    max_bonus?: string;
    error_message?: string;
  };
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

export const createStripeCheckout = async (amount: number): Promise<PurchaseTokenResponse> => {
  try {
    // Debug: Check if we have a token
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('auth_token');
    console.log('[createStripeCheckout] Token exists:', !!token);
    if (token) {
      console.log('[createStripeCheckout] Token preview:', token.substring(0, 20) + '...');
    }
    
    // Include platform parameter to indicate this is from mobile
    const response = await apiClient.post<PurchaseTokenResponse>("/shops/purchase/stripe-checkout?platform=mobile", { amount });
    return response;
  } catch (error: any) {
    console.error("Failed to create Stripe checkout:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
};

export const getCustomerInfo = async (walletAddress: string): Promise<{ data: { customer: CustomerInfo } }> => {
  try {
    return await apiClient.get(`/customers/${walletAddress}`);
  } catch (error: any) {
    console.error("Failed to get customer info:", error.message);
    throw error;
  }
};

export const getShopPromoCodes = async (shopId: string): Promise<{ data: PromoCode[]; success: boolean }> => {
  try {
    return await apiClient.get(`/shops/${shopId}/promo-codes`);
  } catch (error: any) {
    console.error("Failed to get shop promo codes:", error.message);
    throw error;
  }
};

export const validatePromoCode = async (shopId: string, request: PromoValidationRequest): Promise<PromoValidationResponse> => {
  try {
    return await apiClient.post(`/shops/${shopId}/promo-codes/validate`, request);
  } catch (error: any) {
    console.error("Failed to validate promo code:", error.message);
    throw error;
  }
};

export const issueReward = async (shopId: string, request: RewardRequest): Promise<RewardResponse> => {
  try {
    return await apiClient.post(`/shops/${shopId}/issue-reward`, request);
  } catch (error: any) {
    console.error("Failed to issue reward:", error.message);
    throw error;
  }
};
