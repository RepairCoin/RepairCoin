import { ServiceCategory } from "@/constants/service-categories";
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

export interface ShopData {
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
  data: ShopData;
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

export interface UpdateServiceData {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: ServiceCategory;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

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

export interface CreateServiceRequest {
  serviceName: string;
  description?: string;
  category?: string;
  priceUsd: number;
  durationMinutes?: number;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface TokenPurchasePaymentIntentResponse {
  data: {
    clientSecret: string;
    purchaseId: string;
    amount: number;
    totalCost: number;
  };
  success: boolean;
  message?: string;
}

