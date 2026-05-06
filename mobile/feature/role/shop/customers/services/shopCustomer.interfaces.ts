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