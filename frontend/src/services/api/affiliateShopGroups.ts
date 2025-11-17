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
  id: string; // Backend returns 'id', not 'transactionId'
  transactionId?: string; // Keep for backward compatibility
  groupId: string;
  customerAddress: string;
  shopId: string;
  type: 'earn' | 'redeem';
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  timestamp?: string; // Alternative field name
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
    // apiClient already returns response.data
    return response || null;
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
    console.log('🌐 [API] Calling GET /affiliate-shop-groups');
    // For discover page, we want to show all groups (both public and private)
    // Private groups will just show as "invite only"
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/affiliate-shop-groups`);
    console.log('✅ [API] getAllGroups response:', {
      status: 'success',
      dataLength: (response as any).data?.length || 0,
      rawResponse: response
    });
    // apiClient interceptor returns response.data directly, so response IS { success, data }
    const groups = (response as any).data || [];

    // Map backend groupType to frontend isPrivate
    return groups.map((group: any) => ({
      ...group,
      isPrivate: group.groupType === 'private',
    }));
  } catch (error) {
    console.error('❌ [API] Error getting shop groups:', error);
    console.error('Error details:', {
      status: (error as any)?.response?.status,
      data: (error as any)?.response?.data,
      message: (error as any)?.message
    });
    return [];
  }
};

/**
 * Get groups for authenticated shop
 */
export const getMyGroups = async (): Promise<AffiliateShopGroup[]> => {
  try {
    console.log('🌐 [API] Calling GET /affiliate-shop-groups/my-groups');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/affiliate-shop-groups/my-groups');
    console.log('✅ [API] getMyGroups response:', {
      status: 'success',
      dataLength: (response as any).data?.length || 0,
      rawResponse: response
    });
    // apiClient interceptor returns response.data directly, so response IS { success, data }
    const groups = (response as any).data || [];

    // Map backend groupType to frontend isPrivate
    return groups.map((group: any) => ({
      ...group,
      isPrivate: group.groupType === 'private',
    }));
  } catch (error) {
    console.error('❌ [API] Error getting my groups:', error);
    console.error('Error details:', {
      status: (error as any)?.response?.status,
      data: (error as any)?.response?.data,
      message: (error as any)?.message
    });
    return [];
  }
};

/**
 * Get a specific group by ID
 */
export const getGroup = async (groupId: string): Promise<AffiliateShopGroup | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: any }>(`/affiliate-shop-groups/${groupId}`);
    // apiClient interceptor returns response.data directly
    const data = (response as any).data;
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
    // apiClient already returns response.data
    return response || null;
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
    return response || null;
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
    return response || null;
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
    // apiClient interceptor returns response.data directly
    const data = (response as any).data;

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
    return response || null;
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
    return response || null;
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
    return response || null;
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
    return response || null;
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
    return response.data || [];
  } catch (error) {
    console.error('Error getting all customer balances:', error);
    return [];
  }
};

/**
 * Get customers who have earned or redeemed tokens in a group
 */
export const getGroupCustomers = async (
  groupId: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
  }
): Promise<{
  items: CustomerAffiliateGroupBalance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const response = await apiClient.get<{
      success: boolean;
      data: CustomerAffiliateGroupBalance[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      };
    }>(
      `/affiliate-shop-groups/${groupId}/customers${queryString ? `?${queryString}` : ''}`
    );

    return {
      items: (response as any).data || [],
      pagination: (response as any).pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  } catch (error) {
    console.error('Error getting group customers:', error);
    return {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    };
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
    const response = await apiClient.get<any>(
      `/affiliate-shop-groups/${groupId}/transactions${queryString ? `?${queryString}` : ''}`
    );

    // Handle both response formats:
    // 1. Backend returns { data: [...], pagination: {...} }
    // 2. Backend returns array directly [...]
    if (Array.isArray(response)) {
      // Direct array response
      return {
        items: response,
        pagination: { page: 1, limit: response.length, total: response.length, totalPages: 1 },
      };
    } else if (response?.data) {
      // Wrapped response with pagination
      return response.data;
    } else {
      // Fallback
      return {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
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
    return response.data || null;
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
    return response.data || [];
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
    return response.data || [];
  } catch (error) {
    console.error('Error getting transaction trends:', error);
    return [];
  }
};

// ============= RCN ALLOCATION =============

export interface ShopGroupRcnAllocation {
  shopId: string;
  groupId: string;
  allocatedRcn: number;
  usedRcn: number;
  availableRcn: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Allocate RCN from shop's main balance to a group
 */
export const allocateRcnToGroup = async (
  groupId: string,
  amount: number
): Promise<{ allocation: ShopGroupRcnAllocation; shopRemainingBalance: number } | null> => {
  try {
    const response = await apiClient.post<{
      allocation: ShopGroupRcnAllocation;
      shopRemainingBalance: number;
      message: string;
    }>(`/affiliate-shop-groups/${groupId}/rcn/allocate`, { amount });
    return response || null;
  } catch (error) {
    console.error('Error allocating RCN:', error);
    throw error;
  }
};

/**
 * Deallocate RCN from group back to shop's main balance
 */
export const deallocateRcnFromGroup = async (
  groupId: string,
  amount: number
): Promise<{ allocation: ShopGroupRcnAllocation; shopNewBalance: number } | null> => {
  try {
    const response = await apiClient.post<{
      allocation: ShopGroupRcnAllocation;
      shopNewBalance: number;
      message: string;
    }>(`/affiliate-shop-groups/${groupId}/rcn/deallocate`, { amount });
    return response || null;
  } catch (error) {
    console.error('Error deallocating RCN:', error);
    throw error;
  }
};

/**
 * Get shop's RCN allocation for a specific group
 */
export const getGroupRcnAllocation = async (groupId: string): Promise<ShopGroupRcnAllocation | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: ShopGroupRcnAllocation }>(
      `/affiliate-shop-groups/${groupId}/rcn/allocation`
    );
    return (response as any).data || null;
  } catch (error) {
    console.error('Error getting group RCN allocation:', error);
    return null;
  }
};

/**
 * Get all RCN allocations for authenticated shop
 */
export const getAllRcnAllocations = async (): Promise<ShopGroupRcnAllocation[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: ShopGroupRcnAllocation[] }>(
      '/affiliate-shop-groups/rcn/allocations'
    );
    return (response as any).data || [];
  } catch (error) {
    console.error('Error getting all RCN allocations:', error);
    return [];
  }
};
