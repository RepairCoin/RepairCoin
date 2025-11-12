import apiClient from './client';

// ============= Types =============

export interface AffiliateShopGroup {
  groupId: string;
  groupName: string;
  customTokenName: string | null;
  customTokenSymbol: string | null;
  description?: string;
  logoUrl?: string;
  inviteCode: string | null;
  isPrivate: boolean;
  groupType?: 'public' | 'private'; // Backend uses groupType
  createdByShopId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  membershipStatus?: 'active' | 'pending' | 'rejected' | 'removed' | null;
}

export interface AffiliateShopGroupMember {
  groupId: string;
  shopId: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'rejected' | 'removed';
  joinedAt: string;
  requestMessage?: string;
  shopName?: string;
}

export interface CustomerAffiliateGroupBalance {
  customerAddress: string;
  groupId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastEarnedAt?: string;
  lastRedeemedAt?: string;
}

export interface AffiliateGroupTokenTransaction {
  transactionId: string;
  groupId: string;
  customerAddress: string;
  shopId: string;
  type: 'earn' | 'redeem';
  amount: number;
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

// ============= Group Management =============

/**
 * Create a new shop group
 */
export const createGroup = async (data: CreateGroupData): Promise<AffiliateShopGroup | null> => {
  try {
    const response = await apiClient.post<AffiliateShopGroup>('/affiliate-shop-groups', data);
    return response.data || null;
  } catch (error) {
    console.error('Error creating shop group:', error);
    throw error;
  }
};

/**
 * Get all shop groups (public or filtered)
 */
export const getAllGroups = async (params?: { isPrivate?: boolean }): Promise<AffiliateShopGroup[]> => {
  try {
    // For discover page, we want to show all groups (both public and private)
    // Private groups will just show as "invite only"
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/affiliate-shop-groups`);
    const groups = response.data?.data || [];

    // Map backend groupType to frontend isPrivate
    return groups.map((group: any) => ({
      ...group,
      isPrivate: group.groupType === 'private',
    }));
  } catch (error) {
    console.error('Error getting shop groups:', error);
    return [];
  }
};

/**
 * Get groups for authenticated shop
 */
export const getMyGroups = async (): Promise<AffiliateShopGroup[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/affiliate-shop-groups/my-groups');
    const groups = response.data?.data || [];

    // Map backend groupType to frontend isPrivate
    return groups.map((group: any) => ({
      ...group,
      isPrivate: group.groupType === 'private',
    }));
  } catch (error) {
    console.error('Error getting my groups:', error);
    return [];
  }
};

/**
 * Get a specific group by ID
 */
export const getGroup = async (groupId: string): Promise<AffiliateShopGroup | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: any }>(`/affiliate-shop-groups/${groupId}`);
    const data = response.data?.data;
    if (!data) return null;

    // Map backend groupType to frontend isPrivate
    return {
      ...data,
      isPrivate: data.groupType === 'private',
      customTokenName: data.customTokenName || null,
      customTokenSymbol: data.customTokenSymbol || null,
      inviteCode: data.inviteCode || null,
    };
  } catch (error) {
    console.error('Error getting group:', error);
    return null;
  }
};

/**
 * Update group details (admin only)
 */
export const updateGroup = async (
  groupId: string,
  data: UpdateGroupData
): Promise<AffiliateShopGroup | null> => {
  try {
    const response = await apiClient.put<AffiliateShopGroup>(`/affiliate-shop-groups/${groupId}`, data);
    return response.data || null;
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
};

// ============= Membership Management =============

/**
 * Request to join a group
 */
export const requestToJoinGroup = async (
  groupId: string,
  requestMessage?: string
): Promise<AffiliateShopGroupMember | null> => {
  try {
    const response = await apiClient.post<AffiliateShopGroupMember>(`/affiliate-shop-groups/${groupId}/join`, {
      requestMessage,
    });
    return response.data || null;
  } catch (error) {
    console.error('Error requesting to join group:', error);
    throw error;
  }
};

/**
 * Join group by invite code
 */
export const joinByInviteCode = async (
  inviteCode: string,
  requestMessage?: string
): Promise<AffiliateShopGroupMember | null> => {
  try {
    const response = await apiClient.post<AffiliateShopGroupMember>('/affiliate-shop-groups/join-by-code', {
      inviteCode,
      requestMessage,
    });
    return response.data || null;
  } catch (error) {
    console.error('Error joining group by code:', error);
    throw error;
  }
};

/**
 * Get members of a group
 */
export const getGroupMembers = async (
  groupId: string,
  status?: 'active' | 'pending' | 'rejected' | 'removed'
): Promise<AffiliateShopGroupMember[]> => {
  try {
    const queryString = status ? `?status=${status}` : '';
    const response = await apiClient.get<{ success: boolean; data: AffiliateShopGroupMember[] | { memberCount: number; _message: string } }>(
      `/affiliate-shop-groups/${groupId}/members${queryString}`
    );
    const data = response.data?.data;

    // Backend returns an object with memberCount when user is not a member
    // Return empty array in that case instead of trying to map over object
    if (!Array.isArray(data)) {
      console.log('Not a member of this group or no access to member list');
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting group members:', error);
    return [];
  }
};

/**
 * Approve a member request (admin only)
 */
export const approveMember = async (
  groupId: string,
  shopId: string
): Promise<AffiliateShopGroupMember | null> => {
  try {
    const response = await apiClient.post<AffiliateShopGroupMember>(
      `/affiliate-shop-groups/${groupId}/members/${shopId}/approve`
    );
    return response.data || null;
  } catch (error) {
    console.error('Error approving member:', error);
    throw error;
  }
};

/**
 * Reject a member request (admin only)
 */
export const rejectMember = async (groupId: string, shopId: string): Promise<void> => {
  try {
    await apiClient.post(`/affiliate-shop-groups/${groupId}/members/${shopId}/reject`);
  } catch (error) {
    console.error('Error rejecting member:', error);
    throw error;
  }
};

/**
 * Remove a member from group (admin only)
 */
export const removeMember = async (groupId: string, shopId: string): Promise<void> => {
  try {
    await apiClient.delete(`/affiliate-shop-groups/${groupId}/members/${shopId}`);
  } catch (error) {
    console.error('Error removing member:', error);
    throw error;
  }
};

// ============= Token Operations =============

/**
 * Issue group tokens to customer
 */
export const earnGroupTokens = async (
  groupId: string,
  data: EarnTokensData
): Promise<{
  transaction: GroupTokenTransaction;
  newBalance: number;
  lifetimeEarned: number;
} | null> => {
  try {
    const response = await apiClient.post<{
      transaction: GroupTokenTransaction;
      newBalance: number;
      lifetimeEarned: number;
    }>(`/affiliate-shop-groups/${groupId}/tokens/earn`, data);
    return response.data || null;
  } catch (error) {
    console.error('Error issuing group tokens:', error);
    throw error;
  }
};

/**
 * Redeem group tokens
 */
export const redeemGroupTokens = async (
  groupId: string,
  data: RedeemTokensData
): Promise<{
  transaction: GroupTokenTransaction;
  newBalance: number;
  lifetimeRedeemed: number;
} | null> => {
  try {
    const response = await apiClient.post<{
      transaction: GroupTokenTransaction;
      newBalance: number;
      lifetimeRedeemed: number;
    }>(`/affiliate-shop-groups/${groupId}/tokens/redeem`, data);
    return response.data || null;
  } catch (error) {
    console.error('Error redeeming group tokens:', error);
    throw error;
  }
};

/**
 * Get customer's balance in a group
 */
export const getCustomerBalance = async (
  groupId: string,
  customerAddress: string
): Promise<CustomerAffiliateGroupBalance | null> => {
  try {
    const response = await apiClient.get<CustomerAffiliateGroupBalance>(
      `/affiliate-shop-groups/${groupId}/balance/${customerAddress}`
    );
    return response.data || null;
  } catch (error) {
    console.error('Error getting customer balance:', error);
    return null;
  }
};

/**
 * Get all customer's group balances
 */
export const getAllCustomerBalances = async (
  customerAddress: string
): Promise<CustomerAffiliateGroupBalance[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: CustomerAffiliateGroupBalance[] }>(
      `/affiliate-shop-groups/balances/${customerAddress}`
    );
    return response.data?.data || [];
  } catch (error) {
    console.error('Error getting all customer balances:', error);
    return [];
  }
};

/**
 * Get group transaction history
 */
export const getGroupTransactions = async (
  groupId: string,
  params?: {
    page?: number;
    limit?: number;
    type?: 'earn' | 'redeem';
  }
): Promise<{
  items: GroupTokenTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.type) queryParams.append('type', params.type);

    const queryString = queryParams.toString();
    const response = await apiClient.get<{
      success: boolean;
      data: {
        items: GroupTokenTransaction[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>(`/affiliate-shop-groups/${groupId}/transactions${queryString ? `?${queryString}` : ''}`);
    return (
      response.data?.data || {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
    );
  } catch (error) {
    console.error('Error getting group transactions:', error);
    return {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }
};

/**
 * Get customer's transaction history in a group
 */
export const getCustomerTransactions = async (
  groupId: string,
  customerAddress: string,
  params?: {
    page?: number;
    limit?: number;
  }
): Promise<{
  items: GroupTokenTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const response = await apiClient.get<{
      items: GroupTokenTransaction[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(
      `/affiliate-shop-groups/${groupId}/transactions/${customerAddress}${queryString ? `?${queryString}` : ''}`
    );
    return (
      response.data || {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
    );
  } catch (error) {
    console.error('Error getting customer transactions:', error);
    return {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }
};

// ============= Analytics =============

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

/**
 * Get group analytics overview
 */
export const getGroupAnalytics = async (groupId: string): Promise<GroupAnalytics | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: GroupAnalytics }>(
      `/affiliate-shop-groups/${groupId}/analytics`
    );
    return response.data?.data || null;
  } catch (error) {
    console.error('Error getting group analytics:', error);
    return null;
  }
};

/**
 * Get member activity statistics
 */
export const getMemberActivityStats = async (groupId: string): Promise<MemberActivityStat[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: MemberActivityStat[] }>(
      `/affiliate-shop-groups/${groupId}/analytics/members`
    );
    return response.data?.data || [];
  } catch (error) {
    console.error('Error getting member activity stats:', error);
    return [];
  }
};

/**
 * Get transaction trends
 */
export const getTransactionTrends = async (
  groupId: string,
  days: number = 30
): Promise<TransactionTrend[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: TransactionTrend[] }>(
      `/affiliate-shop-groups/${groupId}/analytics/trends?days=${days}`
    );
    return response.data?.data || [];
  } catch (error) {
    console.error('Error getting transaction trends:', error);
    return [];
  }
};
