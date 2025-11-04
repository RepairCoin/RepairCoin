import apiClient from './client';

// ============= Types =============

export interface ShopGroup {
  groupId: string;
  groupName: string;
  customTokenName: string;
  customTokenSymbol: string;
  description?: string;
  logoUrl?: string;
  inviteCode: string;
  isPrivate: boolean;
  createdByShopId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface ShopGroupMember {
  groupId: string;
  shopId: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'rejected' | 'removed';
  joinedAt: string;
  requestMessage?: string;
  shopName?: string;
}

export interface CustomerGroupBalance {
  customerAddress: string;
  groupId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastEarnedAt?: string;
  lastRedeemedAt?: string;
}

export interface GroupTokenTransaction {
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
export const createGroup = async (data: CreateGroupData): Promise<ShopGroup | null> => {
  try {
    const response = await apiClient.post<ShopGroup>('/shop-groups', data);
    return response.data || null;
  } catch (error) {
    console.error('Error creating shop group:', error);
    throw error;
  }
};

/**
 * Get all shop groups (public or filtered)
 */
export const getAllGroups = async (params?: { isPrivate?: boolean }): Promise<ShopGroup[]> => {
  try {
    const queryString = params ? `?isPrivate=${params.isPrivate}` : '';
    const response = await apiClient.get<ShopGroup[]>(`/shop-groups${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting shop groups:', error);
    return [];
  }
};

/**
 * Get groups for authenticated shop
 */
export const getMyGroups = async (): Promise<ShopGroup[]> => {
  try {
    const response = await apiClient.get<ShopGroup[]>('/shop-groups/my-groups');
    return response.data || [];
  } catch (error) {
    console.error('Error getting my groups:', error);
    return [];
  }
};

/**
 * Get a specific group by ID
 */
export const getGroup = async (groupId: string): Promise<ShopGroup | null> => {
  try {
    const response = await apiClient.get<ShopGroup>(`/shop-groups/${groupId}`);
    return response.data || null;
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
): Promise<ShopGroup | null> => {
  try {
    const response = await apiClient.put<ShopGroup>(`/shop-groups/${groupId}`, data);
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
): Promise<ShopGroupMember | null> => {
  try {
    const response = await apiClient.post<ShopGroupMember>(`/shop-groups/${groupId}/join`, {
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
): Promise<ShopGroupMember | null> => {
  try {
    const response = await apiClient.post<ShopGroupMember>('/shop-groups/join-by-code', {
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
): Promise<ShopGroupMember[]> => {
  try {
    const queryString = status ? `?status=${status}` : '';
    const response = await apiClient.get<ShopGroupMember[]>(
      `/shop-groups/${groupId}/members${queryString}`
    );
    return response.data || [];
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
): Promise<ShopGroupMember | null> => {
  try {
    const response = await apiClient.post<ShopGroupMember>(
      `/shop-groups/${groupId}/members/${shopId}/approve`
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
    await apiClient.post(`/shop-groups/${groupId}/members/${shopId}/reject`);
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
    await apiClient.delete(`/shop-groups/${groupId}/members/${shopId}`);
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
    }>(`/shop-groups/${groupId}/tokens/earn`, data);
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
    }>(`/shop-groups/${groupId}/tokens/redeem`, data);
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
): Promise<CustomerGroupBalance | null> => {
  try {
    const response = await apiClient.get<CustomerGroupBalance>(
      `/shop-groups/${groupId}/balance/${customerAddress}`
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
): Promise<CustomerGroupBalance[]> => {
  try {
    const response = await apiClient.get<CustomerGroupBalance[]>(
      `/shop-groups/balances/${customerAddress}`
    );
    return response.data || [];
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
      items: GroupTokenTransaction[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/shop-groups/${groupId}/transactions${queryString ? `?${queryString}` : ''}`);
    return (
      response.data || {
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
      `/shop-groups/${groupId}/transactions/${customerAddress}${queryString ? `?${queryString}` : ''}`
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
