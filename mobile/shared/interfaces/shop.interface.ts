import { BaseResponse } from "./base.interface";
import { CustomerData } from "./customer.interface";

export interface LocationData {
  city: string;
  state: string;
  zipCode: string;
  lat: string;
  lng: string;
}

export interface ShopFormData {
  // Shop Information
  shopId: string;
  name: string; // Company name
  walletAddress: string;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Business Information
  address: string; // Street address
  city: string;
  country: string;
  companySize: string;
  monthlyRevenue: string;
  website: string;
  referral: string;

  // Social Media
  facebook: string;
  twitter: string;
  instagram: string;

  // Wallet Information
  reimbursementAddress: string;
  fixflowShopId: string;

  // Location (for mapping)
  location: LocationData;

  // Terms and Conditions
  acceptTerms: boolean;
}

export interface ShopData {
  acceptTerms: boolean;
  active: boolean;
  address: string;
  category: string;
  companySize: string;
  country: string;
  crossShopEnabled: boolean;
  email: string;
  facebook: string;
  firstName: string;
  instagram: string;
  joinDate: string;
  lastName: string;
  location: LocationData;
  logoUrl?: string;
  bannerUrl?: string;
  monthlyRevenue: string;
  name: string;
  operational_status: string;
  phone: string;
  purchasedRcnBalance: number;
  rcg_balance: number;
  rcg_tier: string;
  referral: string;
  shopId: string;
  totalRcnPurchased: number;
  totalRedemptions: number;
  totalTokensIssued: number;
  twitter: string;
  verified: boolean;
  walletAddress: string;
  website: string;
}

export interface ShopResponseData {
  count: number;
  shops: ShopData[];
}

export interface ShopCustomerData {
  currentPage: number;
  customers: CustomerData[];
  totalItems: number;
  totalPages: number;
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

export interface ProcessRedemptionRequest {
  customerAddress: string;
  amount: number;
  sessionId: string;
}

export interface ProcessRedemptionData {
  transactionHash?: string;
  amount: number;
  customerAddress: string;
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

export interface PromoCodeData {
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

export interface PromoCodeValidateData {
  is_valid: boolean;
  bonus_type?: "fixed" | "percentage";
  bonus_value?: string;
  max_bonus?: string;
  error_message?: string;
}

export interface RewardRequest {
  customerAddress: string;
  repairAmount: number;
  skipTierBonus?: boolean;
  promoCode?: string;
  customBaseReward?: number;
}

export interface RewardData {
  totalReward: number;
  baseReward: number;
  tierBonus: number;
  promoBonus: number;
  transactionHash?: string;
}

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

export interface TransactionData {
  total: number;
  totalPages: number;
  page: number;
  transactions: Transaction[];
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

export interface PurchaseData {
  items: Purchase[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
    };
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

export interface PurchasesResponse extends BaseResponse<PurchaseData> {}
export interface TransactionsResponse extends BaseResponse<TransactionData> {}
export interface PromoCodeValidateResponse extends BaseResponse<PromoCodeValidateData> {}
export interface PromoCodeResponse extends BaseResponse<PromoCodeData> {}
export interface PromoCodesListResponse {
  items: PromoCodeData[];
}
export interface ProcessRedemptionResponse extends BaseResponse<ProcessRedemptionData> {}
export interface ShopByWalletAddressResponse extends BaseResponse<ShopData> {}
export interface ShopCustomersResponse extends BaseResponse<ShopCustomerData> {}
export interface ShopCustomerGrowthResponse extends BaseResponse<CustomerGrowthData> {}
export interface ShopResponse extends BaseResponse<ShopResponseData> {}
export interface RewardResponse extends BaseResponse<RewardData> {}