import { BaseResponse } from "@/shared/interfaces/base.interface";
import { CustomerData, CustomerTier } from "@/feature/customer/profile/services/customer.interface";

export type BonusType = "fixed" | "percentage";
export type ShopTabs = "Wallet" | "Analysis" | "Promo Code";
export type TimeRange = "day" | "month" | "year";
export type ChartFilter = "Profit & Loss Over Time" | "Revenue vs Cost" | "Profit Margin Trend";
export type ViewMode = "my-customers" | "search-all";
export type TierFilter = "all" | "bronze" | "silver" | "gold";
export type SortBy = "recent" | "earnings" | "active";
export type RepairType = "minor" | "small" | "large" | "custom";

export interface LocationData {
  city: string;
  state: string;
  zipCode: string;
  lat: string;
  lng: string;
}

export interface ShopFormData {
  shopId: string;
  name: string;
  walletAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  companySize: string;
  monthlyRevenue: string;
  website: string;
  referral: string;
  facebook: string;
  twitter: string;
  instagram: string;
  reimbursementAddress: string;
  fixflowShopId: string;
  location: LocationData;
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
  isActive?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
}

export interface ShopResponseData {
  count: number;
  shops: ShopData[];
}

/**
 * Shop shape returned by `GET /shops/map` — includes service-derived
 * categories, ratings, and (when coords are supplied) distance.
 */
export interface MapShop {
  shopId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  location: {
    lat: number;
    lng: number;
    city: string | null;
    state: string | null;
  };
  verified: boolean;
  logoUrl: string | null;
  category: string | null;
  /** Distinct categories aggregated from the shop's active services. */
  serviceCategories: string[];
  serviceCount: number;
  avgRating: number;
  totalReviews: number;
  distanceMiles: number | null;
}

export interface MapShopsResponse extends BaseResponse<MapShop[]> {}

export interface MapShopsQuery {
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
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

export interface CustomerRedemptionData {
  address: string;
  tier: CustomerTier;
  balance: number;
  lifetimeEarnings: number;
  // Cross-shop redemption fields
  isHomeShop: boolean; // True if customer has earned RCN at this shop
  maxRedeemable: number; // Maximum amount customer can redeem at this shop
  crossShopLimit: number; // 20% limit for cross-shop redemptions
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

export interface PromoCode {
  id: string;
  code: string;
  name?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  is_active?: boolean;
  total_usage_limit?: number;
  times_used?: number;
  max_bonus?: number;
  valid_from?: string;
  valid_until?: string;
  start_date?: string;
  end_date?: string;
}

export interface PromoCodeValidateData {
  is_valid: boolean;
  bonus_type?: "fixed" | "percentage";
  bonus_value?: string;
  max_bonus?: string;
  error_message?: string;
}

export interface RepairOption {
  type: RepairType;
  label: string;
  rcn: number;
  description: string;
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

export interface PromoCodeFormData {
  code: string;
  name: string;
  description: string;
  bonusType: BonusType;
  bonusValue: string;
  startDate: Date;
  endDate: Date;
  totalUsageLimit: string;
  perCustomerLimit: string;
  maxBonus: string;
}

export interface CreatePromoCodeData {
  code: string;
  name: string;
  description?: string;
  bonus_type: BonusType;
  bonus_value: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit?: number;
  max_bonus?: number;
  is_active: boolean;
}

export interface CustomerCardProps {
  name: string;
  tier: string;
  lifetimeEarnings: number;
  profileImageUrl?: string | null;
  lastTransactionDate?: string;
  total_transactions?: number;
  referralCount?: number;
  totalRedemptions?: number;
  joinDate?: string;
  isSuspended?: boolean;
  suspensionReason?: string | null;
  onPress?: () => void;
  onMessagePress?: () => void;
}

export interface SubscriptionFormData {
  shopName: string;
  email: string;
  phoneNumber: string;
  shopAddress: string;
  acceptTerms: boolean;
}

export interface SubscriptionResponse {
  success: boolean;
  error?: string;
  data?: {
    isPendingResume?: boolean;
    message?: string;
    paymentUrl?: string;
    nextSteps?: string;
    clientSecret?: string;
    subscriptionId?: string;
  };
}


export interface PurchasesResponse extends BaseResponse<PurchaseData> {}
export interface TransactionsResponse extends BaseResponse<TransactionData> {}
export interface PromoCodeValidateResponse extends BaseResponse<PromoCodeValidateData> {}
export interface PromoCodeResponse extends BaseResponse<PromoCodeData> {}
export interface PromoCodesListResponse {
  success?: boolean;
  data?: PromoCodeData[];
  items?: PromoCodeData[];
}
export interface ProcessRedemptionResponse extends BaseResponse<ProcessRedemptionData> {}
export interface ShopByWalletAddressResponse extends BaseResponse<ShopData> {}
export interface ShopCustomersResponse extends BaseResponse<ShopCustomerData> {}
export interface ShopCustomerGrowthResponse extends BaseResponse<CustomerGrowthData> {}
export interface ShopResponse extends BaseResponse<ShopResponseData> {}
export interface RewardResponse extends BaseResponse<RewardData> {}

// ==================== Moderation: Issue Reports ====================
export type IssueReportCategory =
  | "spam"
  | "fraud"
  | "harassment"
  | "inappropriate_review"
  | "other";

export type IssueReportSeverity = "low" | "medium" | "high";

export type IssueReportStatus =
  | "pending"
  | "investigating"
  | "resolved"
  | "dismissed";

export interface SubmitIssueReportRequest {
  category: IssueReportCategory;
  description: string;
  severity: IssueReportSeverity;
  relatedEntityType?: "customer" | "review" | "order";
  relatedEntityId?: string;
}

export interface ShopReport {
  id: string;
  shopId: string;
  category: IssueReportCategory;
  description: string;
  severity: IssueReportSeverity;
  status: IssueReportStatus;
  relatedEntityType?: "customer" | "review" | "order";
  relatedEntityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitIssueReportResponse extends BaseResponse<ShopReport> {}
export interface ShopReportsResponse extends BaseResponse<ShopReport[]> {}

// ==================== Moderation: Flagged Reviews ====================
export interface FlaggedReview {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  status: "pending" | "approved" | "removed";
  flaggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlagReviewRequest {
  reviewId: string;
  reason: string;
}

export interface FlagReviewResponse extends BaseResponse<FlaggedReview> {}

// ==================== Moderation: Blocked Customers ====================
export interface BlockedCustomer {
  id: string;
  shopId: string;
  customerWalletAddress: string;
  customerName?: string;
  customerEmail?: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlockCustomerRequest {
  customerWalletAddress: string;
  reason: string;
}

export interface BlockCustomerResponse extends BaseResponse<BlockedCustomer> {}
export interface BlockedCustomersResponse extends BaseResponse<BlockedCustomer[]> {}
export interface CustomerBlockStatusResponse
  extends BaseResponse<{
    isBlocked: boolean;
    walletAddress: string;
    shopId: string;
  }> {}
