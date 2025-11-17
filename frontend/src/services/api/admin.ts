import apiClient from './client';
import {
  AdminStats,
  Shop,
  Customer,
  Transaction,
  TreasuryData,
  AdminAnalytics,
  WebhookLog,
  ShopPurchase,
  FilterParams,
} from '@/constants/types';

export interface CreateShopData {
  walletAddress: string;
  shopId: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhone: string;
  ownerEmail: string;
  companyName: string;
  companySize?: string;
  monthlyRevenue?: string;
  role?: string;
  websiteUrl?: string;
  streetAddress?: string;
  city?: string;
  country?: string;
  isVerified?: boolean;
  isActive?: boolean;
}

export interface MintTokensData {
  customerAddress: string;
  amount: number;
  reason: string;
}

export interface SellRcnData {
  shopId: string;
  rcnAmount: number;
  paymentMethod: 'crypto' | 'fiat' | 'bank_transfer';
  paymentReference?: string;
  txHash?: string;
}

// Helper function to build query string
const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// Platform Statistics
export const getAdminStats = async (): Promise<AdminStats | null> => {
  try {
    const response = await apiClient.get<{ data?: AdminStats } | AdminStats>('/admin/stats');

    // Handle both response formats: { data: stats } or direct stats
    if (response.data) {
      // Check if it's nested structure
      if ('data' in response && typeof response.data === 'object' && 'totalCustomers' in (response.data as any)) {
        return response.data as AdminStats;
      }
      // Check if response.data.data exists
      if ('data' in response.data) {
        return (response.data as any).data || null;
      }
      // If it's already the stats object
      if ('totalCustomers' in response.data || 'totalShops' in response.data) {
        return response.data as AdminStats;
      }
    }

    return null;
  } catch (error: any) {
    if (error?.response?.status === 403) {
      console.error('❌ Admin stats access denied (403). Ensure your wallet address is registered as admin in the backend database.');
    } else {
      console.error('Error getting admin stats:', error);
    }
    return null;
  }
};

// Get platform statistics (from materialized view - auto-refreshed every 5 min)
export const getPlatformStatistics = async (): Promise<{
  tokenStats: {
    totalRcnMinted: number;
    totalRcnRedeemed: number;
    totalRcnCirculating: number;
  };
  userStats: {
    totalActiveCustomers: number;
    customersBronze: number;
    customersSilver: number;
    customersGold: number;
  };
  shopStats: {
    totalActiveShops: number;
    shopsWithSubscription: number;
  };
  revenueStats: {
    totalRevenue: number;
    revenueLast30Days: number;
  };
  transactionStats: {
    totalTransactions: number;
    transactionsLast24h: number;
  };
  referralStats: {
    totalReferrals: number;
    totalReferralRewards: number;
  };
  lastUpdated: Date;
} | null> => {
  try {
    const response = await apiClient.get('/admin/analytics/platform-statistics');
    return response.data?.data || response.data || null;
  } catch (error) {
    console.error('Error getting platform statistics:', error);
    return null;
  }
};

// Customer Management
export const getAdminCustomers = async (params?: FilterParams & {
  tier?: 'BRONZE' | 'SILVER' | 'GOLD';
  active?: boolean;
  suspended?: boolean;
}): Promise<{ customers: Customer[]; total: number }> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<{ customers: Customer[]; total: number }>(`/admin/customers${queryString}`);
    return response.data || { customers: [], total: 0 };
  } catch (error) {
    console.error('Error getting admin customers:', error);
    return { customers: [], total: 0 };
  }
};

export const suspendCustomer = async (address: string, reason: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/customers/${address}/suspend`, { reason });
    return true;
  } catch (error) {
    console.error('Error suspending customer:', error);
    return false;
  }
};

export const unsuspendCustomer = async (address: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/customers/${address}/unsuspend`, {});
    return true;
  } catch (error) {
    console.error('Error unsuspending customer:', error);
    return false;
  }
};

// Shop Management
export const getAdminShops = async (params?: FilterParams & {
  verified?: boolean;
  active?: boolean;
}): Promise<Shop[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<any>(`/admin/shops${queryString}`);
    
    // Handle both response formats: { data: { shops: [] } } or direct array
    if (response.data) {
      // Check if response.data.data.shops exists (nested structure)
      if (response.data?.data?.shops && Array.isArray(response.data.data.shops)) {
        return response.data.data.shops;
      }
      // Check if response.data.shops exists
      if (response.data?.shops && Array.isArray(response.data.shops)) {
        return response.data.shops;
      }
      // Check if response.data.data is the array
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      // If response.data is already an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
    }
    
    console.warn('Unexpected shops response format:', response);
    return [];
  } catch (error) {
    console.error('Error getting admin shops:', error);
    return [];
  }
};

export const approveShop = async (shopId: string, notes?: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/shops/${shopId}/approve`, { notes });
    return true;
  } catch (error) {
    console.error('Error approving shop:', error);
    return false;
  }
};

export const rejectShop = async (shopId: string, reason: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/shops/${shopId}/reject`, { reason });
    return true;
  } catch (error) {
    console.error('Error rejecting shop:', error);
    return false;
  }
};

export const createShop = async (data: CreateShopData): Promise<Shop | null> => {
  try {
    const response = await apiClient.post<Shop>('/admin/create-shop', data);
    return response.data || null;
  } catch (error) {
    console.error('Error creating shop:', error);
    return null;
  }
};

export const suspendShop = async (shopId: string, reason: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/shops/${shopId}/suspend`, { reason });
    return true;
  } catch (error) {
    console.error('Error suspending shop:', error);
    return false;
  }
};

export const unsuspendShop = async (shopId: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/shops/${shopId}/unsuspend`, {});
    return true;
  } catch (error) {
    console.error('Error unsuspending shop:', error);
    return false;
  }
};

// Token Management
export const mintTokens = async (data: MintTokensData): Promise<{
  success: boolean;
  txHash?: string;
  amount?: number;
}> => {
  const response = await apiClient.post<{ txHash?: string; amount?: number }>('/admin/mint', data);
  return {
    success: true,
    txHash: response.data?.txHash,
    amount: response.data?.amount,
  };
};

// RCN Sales
export const sellRcnToShop = async (data: SellRcnData): Promise<ShopPurchase | null> => {
  try {
    const response = await apiClient.post<ShopPurchase>(`/admin/shops/${data.shopId}/sell-rcn`, data);
    return response.data || null;
  } catch (error) {
    console.error('Error selling RCN to shop:', error);
    return null;
  }
};

export const getShopRcnBalance = async (shopId: string): Promise<{
  purchasedBalance: number;
  usedBalance: number;
  availableBalance: number;
} | null> => {
  try {
    const response = await apiClient.get<{
      purchasedBalance: number;
      usedBalance: number;
      availableBalance: number;
    }>(`/admin/shops/${shopId}/rcn-balance`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting shop RCN balance:', error);
    return null;
  }
};

export const getShopPurchaseHistory = async (
  shopId: string,
  params?: FilterParams
): Promise<ShopPurchase[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<ShopPurchase[]>(`/admin/shops/${shopId}/purchase-history${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting shop purchase history:', error);
    return [];
  }
};

// Treasury
export const getTreasury = async (): Promise<TreasuryData | null> => {
  try {
    const response = await apiClient.get<TreasuryData>('/admin/treasury');
    return response.data || null;
  } catch (error) {
    console.error('Error getting treasury:', error);
    return null;
  }
};

export const getRCGMetrics = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/admin/treasury/rcg');
    return response.data;
  } catch (error) {
    console.error('Error getting RCG metrics:', error);
    throw error;
  }
};

export const updateShopTier = async (shopId: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/treasury/update-shop-tier/${shopId}`);
    return true;
  } catch (error) {
    console.error('Error updating shop tier:', error);
    return false;
  }
};

export const updateTreasury = async (data: {
  amountSold: number;
  revenue: number;
  shopId: string;
  transactionHash?: string;
}): Promise<boolean> => {
  try {
    await apiClient.post('/admin/treasury/update', data);
    return true;
  } catch (error) {
    console.error('Error updating treasury:', error);
    return false;
  }
};

export const getTreasuryAnalytics = async (period?: '7d' | '30d' | '60d' | '90d'): Promise<any> => {
  try {
    const params = period ? `?period=${period}` : '';
    const response = await apiClient.get(`/admin/treasury/analytics${params}`);
    
    
    return response.data;
  } catch (error: any) {
    console.error('Error getting treasury analytics:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      period
    });
    
    // Provide more specific error information
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please reconnect your wallet.');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied. Admin privileges required.');
    } else if (error.response?.status === 500) {
      const errorMsg = error.response?.data?.error || 'Internal server error';
      throw new Error(`Server error: ${errorMsg}`);
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    
    throw error;
  }
};

export const manualTokenTransfer = async (data: {
  customerAddress: string;
  amount: number;
  reason: string;
}): Promise<any> => {
  try {
    const response = await apiClient.post('/admin/treasury/manual-transfer', data);
    return response.data;
  } catch (error) {
    console.error('Error processing manual token transfer:', error);
    throw error;
  }
};

export const bulkMintTokens = async (data: {
  recipients: string[];
  amount: number;
  reason: string;
}): Promise<any> => {
  try {
    const response = await apiClient.post('/admin/treasury/mint-bulk', data);
    return response.data;
  } catch (error) {
    console.error('Error processing bulk token mint:', error);
    throw error;
  }
};

export const adjustTokenPricing = async (data: {
  tier: 'standard' | 'premium' | 'elite';
  newPrice: number;
  reason: string;
}): Promise<any> => {
  try {
    const response = await apiClient.post('/admin/treasury/adjust-pricing', data);
    return response.data;
  } catch (error) {
    console.error('Error adjusting token pricing:', error);
    throw error;
  }
};

export const emergencyFreeze = async (reason: string, components?: string[]): Promise<any> => {
  try {
    const response = await apiClient.post('/admin/treasury/emergency-freeze', { 
      reason,
      components 
    });
    return response.data;
  } catch (error) {
    console.error('Error processing emergency freeze:', error);
    throw error;
  }
};

export const emergencyUnfreeze = async (reason: string, components?: string[]): Promise<any> => {
  try {
    const response = await apiClient.post('/admin/treasury/emergency-unfreeze', { 
      reason,
      components 
    });
    return response.data;
  } catch (error) {
    console.error('Error processing emergency unfreeze:', error);
    throw error;
  }
};

export const getFreezeStatus = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/admin/treasury/freeze-status');
    return response.data;
  } catch (error) {
    console.error('Error fetching freeze status:', error);
    throw error;
  }
};

export const getFreezeAuditHistory = async (limit: number = 50): Promise<any> => {
  try {
    const response = await apiClient.get(`/admin/treasury/freeze-audit?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching freeze audit history:', error);
    throw error;
  }
};

export const getCurrentPricing = async (): Promise<any> => {
  try {
    console.log('[API] Fetching current pricing from /admin/treasury/pricing');
    const response = await apiClient.get('/admin/treasury/pricing');
    console.log('[API] Current pricing response:', response);
    return response.data;
  } catch (error: any) {
    console.error('[API] Error getting current pricing:', {
      error,
      message: error?.message,
      response: error?.response,
      status: error?.status,
      code: error?.code
    });
    throw error;
  }
};

export const getPricingHistory = async (tier?: 'standard' | 'premium' | 'elite', limit?: number): Promise<any> => {
  try {
    const params = new URLSearchParams();
    if (tier) params.append('tier', tier);
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString();
    const url = `/admin/treasury/pricing/history${queryString ? `?${queryString}` : ''}`;

    console.log('[API] Fetching pricing history from', url);
    const response = await apiClient.get(url);
    console.log('[API] Pricing history response:', response);
    return response.data;
  } catch (error: any) {
    console.error('[API] Error getting pricing history:', {
      error,
      message: error?.message,
      response: error?.response,
      status: error?.status,
      code: error?.code
    });
    throw error;
  }
};

// Analytics
export const getAnalytics = async (params?: {
  period?: 'day' | 'week' | 'month' | 'year';
  startDate?: string;
  endDate?: string;
}): Promise<AdminAnalytics | null> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<AdminAnalytics>(`/admin/analytics${queryString}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting analytics:', error);
    return null;
  }
};

// New Advanced Analytics Endpoints
export const getTokenCirculationMetrics = async (): Promise<{
  totalSupply: number;
  totalInCirculation: number;
  totalRedeemed: number;
  shopBalances: Array<{
    shopId: string;
    shopName: string;
    balance: number;
    tokensIssued: number;
    redemptionsProcessed: number;
  }>;
  customerBalances: {
    totalCustomerBalance: number;
    averageBalance: number;
    activeCustomers: number;
  };
  dailyActivity: Array<{
    date: string;
    minted: number;
    redeemed: number;
    netFlow: number;
  }>;
} | null> => {
  try {
    const response = await apiClient.get('/admin/analytics/token-circulation');
    return response.data?.data || response.data || null;
  } catch (error) {
    console.error('Error getting token circulation metrics:', error);
    return null;
  }
};

export const getShopPerformanceRankings = async (limit?: number): Promise<Array<{
  shopId: string;
  shopName: string;
  tokensIssued: number;
  redemptionsProcessed: number;
  activeCustomers: number;
  averageTransactionValue: number;
  customerRetention: number;
  performanceScore: number;
  lastActivity: string;
  tier: 'Standard' | 'Premium' | 'Elite';
}> | null> => {
  try {
    const params = limit ? `?limit=${limit}` : '';
    const response = await apiClient.get(`/admin/analytics/shop-rankings${params}`);
    return response.data?.data || response.data || null;
  } catch (error) {
    console.error('Error getting shop performance rankings:', error);
    return null;
  }
};

export const getAdminAlerts = async (filters?: {
  unreadOnly?: boolean;
  severity?: string;
  alertType?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  alerts: Array<{
    id: number;
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    metadata?: any;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    createdAt: string;
  }>;
  total: number;
} | null> => {
  try {
    const queryString = filters ? buildQueryString(filters) : '';
    const response = await apiClient.get(`/admin/analytics/alerts${queryString}`);
    return response.data?.data || response.data || null;
  } catch (error) {
    console.error('Error getting admin alerts:', error);
    return null;
  }
};

export const markAlertAsRead = async (alertId: number): Promise<boolean> => {
  try {
    await apiClient.put(`/admin/analytics/alerts/${alertId}/read`);
    return true;
  } catch (error) {
    console.error('Error marking alert as read:', error);
    return false;
  }
};

export const resolveAlert = async (alertId: number): Promise<boolean> => {
  try {
    await apiClient.put(`/admin/analytics/alerts/${alertId}/resolve`);
    return true;
  } catch (error) {
    console.error('Error resolving alert:', error);
    return false;
  }
};

export const runMonitoringChecks = async (): Promise<boolean> => {
  try {
    await apiClient.post('/admin/analytics/monitoring/check');
    return true;
  } catch (error) {
    console.error('Error running monitoring checks:', error);
    return false;
  }
};

// Transactions
export const getAdminTransactions = async (params?: FilterParams & {
  type?: string;
  shopId?: string;
  customerAddress?: string;
}): Promise<Transaction[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Transaction[]>(`/admin/transactions${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting admin transactions:', error);
    return [];
  }
};

// Webhooks
export const getFailedWebhooks = async (params?: FilterParams): Promise<WebhookLog[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<WebhookLog[]>(`/admin/webhooks/failed${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting failed webhooks:', error);
    return [];
  }
};

export const retryWebhook = async (webhookId: number): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/webhooks/retry/${webhookId}`, {});
    return true;
  } catch (error) {
    console.error('Error retrying webhook:', error);
    return false;
  }
};

// Contract Management
export const pauseContract = async (): Promise<boolean> => {
  try {
    await apiClient.post('/admin/contract/pause', {});
    return true;
  } catch (error) {
    console.error('Error pausing contract:', error);
    return false;
  }
};

export const unpauseContract = async (): Promise<boolean> => {
  try {
    await apiClient.post('/admin/contract/unpause', {});
    return true;
  } catch (error) {
    console.error('Error unpausing contract:', error);
    return false;
  }
};

// Admin Management
export const getAdminProfile = async (): Promise<{
  address: string;
  name?: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: string[];
  role?: string;
} | null> => {
  try {
    const response = await apiClient.get<{
      data: {
        address: string;
        name?: string;
        email?: string;
        isSuperAdmin: boolean;
        permissions: string[];
        role?: string;
      }
    }>('/admin/me');
    return response.data?.data || null;
  } catch (error: any) {
    // If endpoint doesn't exist (404) or forbidden (403), return null gracefully
    if (error?.response?.status === 404 || error?.response?.status === 403) {
      console.log('Admin profile endpoint not available, using fallback');
      return null;
    }
    console.error('Error getting admin profile:', error);
    return null;
  }
};

export const createAdmin = async (data: {
  address: string;
  name?: string;
  email?: string;
  permissions?: string[];
}): Promise<boolean> => {
  try {
    await apiClient.post('/admin/create-admin', data);
    return true;
  } catch (error) {
    console.error('Error creating admin:', error);
    return false;
  }
};

export const verifyShop = async (shopId: string): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/shops/${shopId}/verify`, {});
    return true;
  } catch (error) {
    console.error('Error verifying shop:', error);
    return false;
  }
};

export const mintShopBalance = async (shopId: string): Promise<{
  success: boolean;
  message?: string;
}> => {
  try {
    const response = await apiClient.post<{ message: string }>(`/admin/shops/${shopId}/mint-balance`, {});
    return {
      success: true,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error minting shop balance:', error);
    return { success: false };
  }
};

// Unsuspend Requests
export const getUnsuspendRequests = async (type: 'customer' | 'shop'): Promise<Array<{
  id: number;
  address?: string;
  shopId?: string;
  reason: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected';
}>> => {
  try {
    const response = await apiClient.get<Array<{
      id: number;
      address?: string;
      shopId?: string;
      reason: string;
      requestDate: string;
      status: 'pending' | 'approved' | 'rejected';
    }>>(`/admin/unsuspend-requests/${type}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting unsuspend requests:', error);
    return [];
  }
};

export const processUnsuspendRequest = async (
  requestId: number,
  action: 'approve' | 'reject',
  notes?: string
): Promise<boolean> => {
  try {
    await apiClient.post(`/admin/unsuspend-requests/${requestId}/${action}`, { notes });
    return true;
  } catch (error) {
    console.error('Error processing unsuspend request:', error);
    return false;
  }
};

// Named exports grouped as namespace for convenience
export const adminApi = {
  // Stats
  getStats: getAdminStats,
  
  // Customers
  getCustomers: getAdminCustomers,
  suspendCustomer,
  unsuspendCustomer,
  
  // Shops
  getShops: getAdminShops,
  approveShop,
  rejectShop,
  createShop,
  suspendShop,
  unsuspendShop,
  verifyShop,
  mintShopBalance,
  
  // Tokens
  mintTokens,
  
  // RCN Sales
  sellRcnToShop,
  getShopRcnBalance,
  getShopPurchaseHistory,
  
  // Treasury
  getTreasury,
  getRCGMetrics,
  updateShopTier,
  updateTreasury,
  getTreasuryAnalytics,
  manualTokenTransfer,
  bulkMintTokens,
  adjustTokenPricing,
  emergencyFreeze,
  getCurrentPricing,
  getPricingHistory,
  
  // Analytics
  getAnalytics,
  getPlatformStatistics,
  getTokenCirculationMetrics,
  getShopPerformanceRankings,
  getAdminAlerts,
  markAlertAsRead,
  resolveAlert,
  runMonitoringChecks,
  
  // Transactions
  getTransactions: getAdminTransactions,
  
  // Webhooks
  getFailedWebhooks,
  retryWebhook,
  
  // Contract
  pauseContract,
  unpauseContract,
  
  // Admin
  getAdminProfile,
  createAdmin,
  
  // Unsuspend Requests
  getUnsuspendRequests,
  processUnsuspendRequest,

  // Session Management
  getSessions: async (params: {
    page?: number;
    limit?: number;
    role?: 'admin' | 'shop' | 'customer';
    status?: 'active' | 'expired' | 'revoked' | 'all';
  }) => {
    const queryString = buildQueryString(params);
    return apiClient.get(`/admin/sessions${queryString}`);
  },

  revokeSession: async (tokenId: string, reason?: string) => {
    return apiClient.delete(`/admin/sessions/${tokenId}`, {
      data: { reason }
    });
  },

  revokeAllUserSessions: async (userAddress: string, reason?: string) => {
    return apiClient.delete(`/admin/sessions/user/${userAddress}`, {
      data: { reason }
    });
  },

  getSessionStats: async () => {
    return apiClient.get('/admin/sessions/stats');
  },
} as const;