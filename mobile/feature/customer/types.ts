// Customer feature types

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

export type ViewMode = "my-customers" | "search-all";
export type TierFilter = "all" | "bronze" | "silver" | "gold";
export type SortBy = "recent" | "earnings" | "active";
