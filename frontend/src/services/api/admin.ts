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
  address: string;
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
  } catch (error) {
    console.error('Error getting admin stats:', error);
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
  try {
    const response = await apiClient.post<{ txHash?: string; amount?: number }>('/admin/mint', data);
    return {
      success: true,
      txHash: response.data?.txHash,
      amount: response.data?.amount,
    };
  } catch (error) {
    console.error('Error minting tokens:', error);
    return { success: false };
  }
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
} | null> => {
  try {
    const response = await apiClient.get<{
      data: {
        address: string;
        name?: string;
        email?: string;
        isSuperAdmin: boolean;
        permissions: string[];
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
  updateTreasury,
  
  // Analytics
  getAnalytics,
  
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
} as const;