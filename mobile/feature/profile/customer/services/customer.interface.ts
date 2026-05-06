// Customer feature types
import { Tier } from "@/shared/utilities/GlobalTypes";
import { CustomerData as CustomerDataInterface } from "@/shared/interfaces/customer.interface";

// === Customer List Types (original) ===

export type ViewMode = "my-customers" | "search-all";
export type TierFilter = "all" | "bronze" | "silver" | "gold";
export type SortBy = "recent" | "earnings" | "active";

// === Tier Info Types (from feature/tier-info) ===

export interface TierConfig {
  color: [string, string];
  label: string;
  bonus: number;
  requirement: number;
  benefits?: string[];
}

export interface TierProgress {
  currentTier: Tier;
  lifetimeEarnings: number;
  nextTier: Tier | null;
  nextTierConfig: TierConfig | null;
  progressToNextTier: number;
  rcnToNextTier: number;
}

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

// Re-export CustomerData from interfaces
export type CustomerData = CustomerDataInterface;

export type { CustomerTier } from "@/shared/interfaces/customer.interface";

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