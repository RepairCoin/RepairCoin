import { apiClient } from "@/utilities/axios";
import { buildQueryString } from "@/utilities/helper";

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
  amount: number,
  completedAt: string,
  createdAt: string,
  id: number,
  paymentMethod: string,
  paymentReference: string,
  pricePerRcn: null,
  shopId: string,
  status: string,
  totalCost: number
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
    total: number;
    totalPages: number;
  };
  success: boolean;
  message?: string;
}

// Customer and Rewards related interfaces and services
export interface CustomerInfo {
  address: string;
  last_transaction_date: string;
  lifetime_earnings: number;
  name: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  total_transactions: number;
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

export interface CustomerGrowthData {
  activeCustomers: number;
  activeGrowthPercentage: number;
  averageEarningsPerCustomer: number;
  avgEarningsGrowthPercentage: number;
  growthPercentage: number;
  newCustomers: number;
  periodLabel: string;
  regularCustomers: number;
  regularGrowthPercentage: number;
  totalCustomers: number;
}

export interface CustomerGrowthResponse {
  data: CustomerGrowthData;
  success: boolean;
}

export interface ShopCustomerData {
  currentPage: number;
  customers: CustomerInfo[];
  totalItems: number;
  totalPages: number;
}

export interface ShopCustomersResponse {
  data: ShopCustomerData;
  success: boolean;
}

export interface CreatePromoCodeRequest {
  code: string;
  name: string;
  description?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit?: number;
  max_bonus?: number;
  is_active: boolean;
}

export interface ServiceData {
  active: boolean;
  category: string;
  createdAt: string;
  description: string;
  durationMinutes: number;
  imageUrl: string;
  priceUsd: number;
  serviceId: string;
  serviceName: string;
  shopId: string;
  tags: string[];
  updatedAt: string;
}

export interface ServiceResponse {
  data: ServiceData[];
  pagination: {
    hasMore: boolean;
    limit: number;
    page: number;
    totalItems: number;
    totalPages: number;
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
    return await apiClient.get<ShopByWalletAddressResponse>(
      `/shops/wallet/${walletAddress}`
    );
  } catch (error: any) {
    console.error("Failed to get shop by wallet address:", error.message);
    throw error;
  }
};

export const updateShopDetails = async (
  shopId: string,
  shopData: ShopData
): Promise<UpdateShopData> => {
  try {
    return await apiClient.put<UpdateShopData>(
      `/shops/${shopId}/details`,
      shopData
    );
  } catch (error: any) {
    console.error("Failed to update shop details:", error.message);
    throw error;
  }
};

export const createStripeCheckout = async (
  amount: number
): Promise<PurchaseTokenResponse> => {
  try {
    // Debug: Check if we have a token
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const token = await AsyncStorage.getItem("auth_token");

    // Include platform parameter to indicate this is from mobile
    const response = await apiClient.post<PurchaseTokenResponse>(
      "/shops/purchase/stripe-checkout?platform=mobile",
      { amount }
    );
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

export const getCustomerInfo = async (
  walletAddress: string
): Promise<{ data: { customer: CustomerInfo } }> => {
  try {
    return await apiClient.get(`/customers/${walletAddress}`);
  } catch (error: any) {
    console.error("Failed to get customer info:", error.message);
    throw error;
  }
};

export const issueReward = async (
  shopId: string,
  request: RewardRequest
): Promise<RewardResponse> => {
  try {
    return await apiClient.post(`/shops/${shopId}/issue-reward`, request);
  } catch (error: any) {
    console.error("Failed to issue reward:", error.message);
    throw error;
  }
};

export const getShopTransactions = async (
  shopId: string
): Promise<PurchaseHistoryResponse> => {
  try {
    return await apiClient.get(`/shops/purchase/history/${shopId}`);
  } catch (error: any) {
    console.error("Failed to get shop transactions:", error.message);
    throw error;
  }
};

export const getShopCustomerGrowth = async (shopId: string): Promise<CustomerGrowthResponse> => {
  try {
    return await apiClient.get<CustomerGrowthResponse>(`/shops/${shopId}/customer-growth?period=7d`);
  } catch (error: any) {
    console.error("Failed to get shop customer growth:", error.message);
    throw error;
  }
};

export const getShopCustomers = async (shopId: string): Promise<ShopCustomersResponse> => {
  try {
    return await apiClient.get<ShopCustomersResponse>(`/shops/${shopId}/customers?limit=100`);
  } catch (error: any) {
    console.error("Failed to get shop customers:", error.message);
    throw error;
  }
};

export const getShopPromoCodes = async (
  shopId: string
): Promise<{ data: PromoCode[]; success: boolean }> => {
  try {
    return await apiClient.get(`/shops/${shopId}/promo-codes`);
  } catch (error: any) {
    console.error("Failed to get shop promo codes:", error.message);
    throw error;
  }
};

export const validatePromoCode = async (
  shopId: string,
  request: PromoValidationRequest
): Promise<PromoValidationResponse> => {
  try {
    return await apiClient.post(
      `/shops/${shopId}/promo-codes/validate`,
      request
    );
  } catch (error: any) {
    console.error("Failed to validate promo code:", error.message);
    throw error;
  }
};

export const updatePromoCodeStatus = async (
  shopId: string,
  promoCodeId: string,
  isActive: boolean
): Promise<{ success: boolean; message?: string; data?: any }> => {
  try {
    if (!isActive) {
      // Use DELETE endpoint to deactivate
      return await apiClient.delete(`/shops/${shopId}/promo-codes/${promoCodeId}`);
    } else {
      // Use PUT endpoint to reactivate by updating is_active flag
      return await apiClient.put(`/shops/${shopId}/promo-codes/${promoCodeId}`, {
        is_active: true
      });
    }
  } catch (error: any) {
    console.error("Failed to update promo code status:", error.message);
    throw error;
  }
};

export const createPromoCode = async (
  shopId: string,
  promoCodeData: CreatePromoCodeRequest
): Promise<{ success: boolean; data: PromoCode }> => {
  try {
    return await apiClient.post(`/shops/${shopId}/promo-codes`, promoCodeData);
  } catch (error: any) {
    console.error("Failed to create promo code:", error.message);
    throw error;
  }
};

export interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "processing" | "completed" | "expired" | "used";
  qrCode?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    cancelledByShop?: boolean;
  };
}

export interface CreateRedemptionSessionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export interface CreateRedemptionSessionResponse {
  data: {
    sessionId: string;
    expiresAt: string;
    qrCode?: string;
  };
  success: boolean;
  message?: string;
}

export interface RedemptionSessionStatusResponse {
  data: RedemptionSession;
  success: boolean;
  message?: string;
}

export interface ProcessRedemptionRequest {
  customerAddress: string;
  amount: number;
  sessionId: string;
}

export interface ProcessRedemptionResponse {
  data: {
    transactionHash?: string;
    amount: number;
    customerAddress: string;
  };
  success: boolean;
  message?: string;
}

export interface CustomerBalanceData {
  totalBalance: number;
  availableBalance?: number;
}

export interface CustomerBalanceResponse {
  data: CustomerBalanceData;
  success: boolean;
  message?: string;
}

export const createRedemptionSession = async (
  request: CreateRedemptionSessionRequest
): Promise<CreateRedemptionSessionResponse> => {
  try {
    return await apiClient.post(
      "/tokens/redemption-session/create",
      request
    );
  } catch (error: any) {
    console.error("Failed to create redemption session:", error.message);
    throw error;
  }
};

export const checkRedemptionSessionStatus = async (
  sessionId: string
): Promise<RedemptionSessionStatusResponse> => {
  try {
    return await apiClient.get(
      `/tokens/redemption-session/status/${sessionId}`
    );
  } catch (error: any) {
    console.error("Failed to check redemption session status:", error.message);
    throw error;
  }
};

export const cancelRedemptionSession = async (
  sessionId: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    return await apiClient.post("/tokens/redemption-session/cancel", {
      sessionId,
    });
  } catch (error: any) {
    console.error("Failed to cancel redemption session:", error.message);
    throw error;
  }
};

export const processRedemption = async (
  shopId: string,
  request: ProcessRedemptionRequest
): Promise<ProcessRedemptionResponse> => {
  try {
    return await apiClient.post(`/shops/${shopId}/redeem`, request);
  } catch (error: any) {
    console.error("Failed to process redemption:", error.message);
    throw error;
  }
};

export const getCustomerBalance = async (
  customerAddress: string
): Promise<CustomerBalanceResponse> => {
  try {
    return await apiClient.get(`/customers/balance/${customerAddress}`);
  } catch (error: any) {
    console.error("Failed to get customer balance:", error.message);
    throw error;
  }
};

export const getShopServices = async (
  shopId: string,
  options?: { page?: number; limit?: number }
): Promise<ServiceResponse> => {
  try {
    const queryString = options ? buildQueryString(options) : '';
    return await apiClient.get<ServiceResponse>(`/services/shop/${shopId}${queryString}`);
  } catch (error: any) {
    console.error("Failed to get shop services:", error.message);
    throw error;
  }
};