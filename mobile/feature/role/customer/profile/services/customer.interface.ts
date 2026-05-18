import { BaseResponse } from "@/shared/interfaces/base.interface";

// ============================================
// Shared Customer Types
// ============================================

export type CustomerTierLower = "bronze" | "silver" | "gold";
export type CustomerTierUpper = "BRONZE" | "SILVER" | "GOLD";
export type CustomerTier = CustomerTierLower | CustomerTierUpper;
export interface TierBenefits { earningMultiplier: number; redemptionRate: number; crossShopRedemption: boolean; tierBonus: number; features: string[]; }
export interface CustomerData { address: string; name: string; email: string; phone: string; tier: string; lifetimeEarnings: number; totalRedemptions: number; totalRepairs: number; referralCode: string; referralCount: number; dailyEarnings: number; monthlyEarnings: number; joinDate: string; isActive: boolean; isSuspended: boolean; suspensionReason: string | null; id: number; shopId: string; stripeCustomerId: string; profileImageUrl: string | null; currentRcnBalance: number; createdAt: string; updatedAt: string; total_transactions: number; last_transaction_date: string; }
export interface Customer { customer: CustomerData; blockchainBalance: number; tierBenefits: TierBenefits; earningCapacity: {}; tierProgression: {}; }
export interface CustomerFormData { address?: string; name?: string; email: string; phone?: string; referralCode?: string; walletAddress: string; fixflowCustomerId?: string; }
export interface TransactionData { amount: number; createdAt: string; description: string; id: number; metadata: string[]; shopId: string; shopName: string; type: string; }
export interface Transaction { count: number; customer: CustomerData; transactions: TransactionData[]; }
export interface CustomerResponse extends BaseResponse<Customer> {}
export interface TransactionResponse extends BaseResponse<Transaction> {}

// ============================================
// Feature-Specific Types
// ============================================

// === Customer List Types (original) ===

export type ViewMode = "my-customers" | "search-all";
export type TierFilter = "all" | "bronze" | "silver" | "gold";
export type SortBy = "recent" | "earnings" | "active";

// === Referral Types (from feature/referral) ===

export interface HowItWorksStep {
  icon: string;
  title: string;
  description: string;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
}

// === Account Types (from feature/account - customer parts) ===

export type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

export interface TierProgressCardProps {
  currentTier: string;
  lifetimeEarnings: number;
}

// === Profile Types (from feature/profile - customer parts) ===

export interface CustomerProfileProps {
  walletAddress: string;
}

export interface CustomerStatsProps {
  lifetimeEarnings: number;
  totalRedemptions: number;
  totalRepairs: number;
}

export interface CustomerEditFormData {
  name: string;
  email: string;
  phone: string;
  profileImageUrl: string;
}

export interface ContactInfoItem {
  type: "email" | "phone" | "wallet" | "website";
  label: string;
  value: string;
  onPress?: () => void;
  copyable?: boolean;
}

export interface ProfileTab {
  key: string;
  label: string;
}

export interface ProfileLoadingProps {
  message?: string;
}

export interface ProfileErrorProps {
  title: string;
  message: string;
  onBack?: () => void;
}

export interface CrossShopBalanceResponse {
  success: boolean;
  data: {
    totalRedeemableBalance: number;
    crossShopLimit: number;
    availableForCrossShop: number;
    homeShopBalance: number;
  };
}

export interface SearchCustomersResponse {
  success: boolean;
  data: {
    customers: CustomerData[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
    };
  };
}
