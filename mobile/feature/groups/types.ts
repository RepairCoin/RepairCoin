// ============= Affiliate Shop Group Types =============

export interface AffiliateShopGroup {
  groupId: string;
  groupName: string;
  customTokenName: string | null;
  customTokenSymbol: string | null;
  description?: string;
  logoUrl?: string;
  icon?: string;
  inviteCode: string | null;
  isPrivate: boolean;
  groupType?: "public" | "private";
  createdByShopId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  membershipStatus?: MembershipStatus | null;
  role?: "admin" | "member";
}

export type MembershipStatus = "active" | "pending" | "rejected" | "removed";

export interface AffiliateShopGroupMember {
  groupId: string;
  shopId: string;
  role: "admin" | "member";
  status: MembershipStatus;
  joinedAt: string;
  requestMessage?: string;
  shopName?: string;
  allocatedRcn?: number;
  usedRcn?: number;
  availableRcn?: number;
}

export interface CustomerAffiliateGroupBalance {
  customerAddress: string;
  groupId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastEarnedAt?: string;
  lastRedeemedAt?: string;
  customerName?: string;
}

export interface AffiliateGroupTokenTransaction {
  id: string;
  transactionId?: string;
  groupId: string;
  customerAddress: string;
  shopId: string;
  type: "earn" | "redeem";
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  timestamp?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreateGroupData {
  groupName: string;
  customTokenName: string;
  customTokenSymbol: string;
  description?: string;
  logoUrl?: string;
  icon?: string;
  isPrivate?: boolean;
}

export interface UpdateGroupData {
  groupName?: string;
  description?: string;
  logoUrl?: string;
  isPrivate?: boolean;
}

export interface EarnTokensData {
  customerAddress: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RedeemTokensData {
  customerAddress: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface GroupAnalytics {
  totalTokensIssued: number;
  totalTokensRedeemed: number;
  totalTokensCirculating: number;
  activeMembers: number;
  totalTransactions: number;
  uniqueCustomers: number;
  averageTransactionSize: number;
  tokensIssuedLast30Days: number;
  tokensRedeemedLast30Days: number;
}

export interface MemberActivityStat {
  shopId: string;
  shopName: string;
  tokensIssued: number;
  tokensRedeemed: number;
  netContribution: number;
  transactionCount: number;
  uniqueCustomers: number;
  lastActivity: string | null;
  joinedAt: string;
}

export interface TransactionTrend {
  date: string;
  tokensIssued: number;
  tokensRedeemed: number;
  transactionCount: number;
}

export interface ShopGroupRcnAllocation {
  shopId: string;
  groupId: string;
  allocatedRcn: number;
  usedRcn: number;
  availableRcn: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
}

// Tab types for the groups screen
export type GroupsTab = "My Groups" | "Discover";
