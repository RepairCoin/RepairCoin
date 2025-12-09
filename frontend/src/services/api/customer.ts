import apiClient from './client';
import {
  Customer,
  Transaction,
  ReferralData,
  BalanceData,
  FilterParams,
  NotificationPreferences,
  CustomerExportData,
} from '@/constants/types';

export interface CustomerRegistrationData {
  walletAddress: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  referralCode?: string;
}

export interface CustomerStats {
  totalEarned: number;
  totalRedeemed: number;
  currentStreak: number;
  averageTransaction: number;
  favoriteShop?: string;
  tierProgress: number;
}

export interface RedemptionSession {
  sessionId: string;
  shopId: string;
  shopName?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface ShopInfo {
  id: string;
  name: string;
  address: string;
  rcnBalance: number;
  isHomeShop: boolean;
  distance?: number;
  rating?: number;
  crossShopEnabled: boolean;
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

// Profile Management
export const registerCustomer = async (data: CustomerRegistrationData): Promise<Customer | null> => {
  try {
    // apiClient interceptor returns response.data directly, so response is already the Customer object or wrapped data
    const response = await apiClient.post('/customers/register', data);
    // Backend might return { success: true, data: customer } or just the customer
    const customer = (response as { data?: Customer }).data || response;
    return customer as Customer || null;
  } catch (error) {
    console.error('Error registering customer:', error);
    throw error; // Re-throw to allow proper error handling in useCustomer
  }
};

export const getCustomerProfile = async (address: string): Promise<Customer | null> => {
  try {
    const response = await apiClient.get<Customer>(`/customers/${address}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting customer profile:', error);
    return null;
  }
};

export const updateCustomerProfile = async (
  address: string,
  updates: Partial<Customer>
): Promise<Customer | null> => {
  try {
    const response = await apiClient.put<Customer>(`/customers/${address}`, updates);
    return response.data || null;
  } catch (error) {
    console.error('Error updating customer profile:', error);
    return null;
  }
};

export const deleteCustomerAccount = async (
  address: string,
  reason?: string
): Promise<boolean> => {
  try {
    await apiClient.delete(`/customers/${address}`, {
      data: { reason }
    });
    return true;
  } catch (error) {
    console.error('Error deleting customer account:', error);
    return false;
  }
};

// Transactions
export const getCustomerTransactions = async (
  address: string,
  params?: FilterParams & {
    type?: 'earned' | 'redeemed' | 'bonus' | 'referral';
    shopId?: string;
  }
): Promise<Transaction[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Transaction[]>(
      `/customers/${address}/transactions${queryString}`
    );
    return response.data || [];
  } catch (error) {
    console.error('Error getting customer transactions:', error);
    return [];
  }
};

// Analytics & Stats
export const getCustomerAnalytics = async (address: string): Promise<{
  earningsTrend: Array<{ date: string; amount: number }>;
  redemptionHistory: Array<{ date: string; amount: number; shopId: string }>;
  tierProgress: { current: number; next: number; percentage: number };
} | null> => {
  try {
    const response = await apiClient.get<any>(`/customers/${address}/analytics`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting customer analytics:', error);
    return null;
  }
};

export const getCustomerStats = async (address: string): Promise<CustomerStats | null> => {
  try {
    const response = await apiClient.get<CustomerStats>(`/customers/${address}/stats`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting customer stats:', error);
    return null;
  }
};

// Balance & Earnings
export const getEarnedBalance = async (address: string): Promise<BalanceData | null> => {
  try {
    const response = await apiClient.get<BalanceData>(`/tokens/earned-balance/${address}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting earned balance:', error);
    return null;
  }
};

// Referrals
export const getReferralData = async (address: string): Promise<ReferralData | null> => {
  try {
    const response = await apiClient.get<ReferralData>(`/customers/${address}/referrals`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting referral data:', error);
    return null;
  }
};

export const generateReferralCode = async (address: string): Promise<{ code: string; shareUrl: string } | null> => {
  try {
    const response = await apiClient.post<{ code: string }>(
      `/customers/${address}/referrals/generate`,
      {}
    );

    if (response.data) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        code: response.data.code,
        shareUrl: `${baseUrl}/register/customer?ref=${response.data.code}`,
      };
    }
    return null;
  } catch (error) {
    console.error('Error generating referral code:', error);
    return null;
  }
};

// Shops
export const getAvailableShops = async (address: string): Promise<ShopInfo[]> => {
  try {
    const response = await apiClient.get<ShopInfo[]>(`/customers/${address}/shops`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting available shops:', error);
    return [];
  }
};

export const getNearbyShops = async (
  latitude: number,
  longitude: number,
  radius: number = 10
): Promise<ShopInfo[]> => {
  try {
    const response = await apiClient.get<ShopInfo[]>('/shops/nearby', {
      params: { lat: latitude, lon: longitude, radius }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error getting nearby shops:', error);
    return [];
  }
};

// Redemption
export const checkRedemptionEligibility = async (
  address: string,
  shopId: string
): Promise<{
  eligible: boolean;
  maxRedeemable: number;
  isHomeShop: boolean;
  message?: string;
}> => {
  try {
    const response = await apiClient.get<any>(`/customers/${address}/redemption-check`, {
      params: { shopId }
    });
    
    return response.data || {
      eligible: false,
      maxRedeemable: 0,
      isHomeShop: false,
      message: 'Unable to check eligibility',
    };
  } catch (error) {
    console.error('Error checking redemption eligibility:', error);
    return {
      eligible: false,
      maxRedeemable: 0,
      isHomeShop: false,
      message: 'Error checking eligibility',
    };
  }
};

export const getPendingRedemptions = async (address: string): Promise<RedemptionSession[]> => {
  try {
    const response = await apiClient.get<RedemptionSession[]>(
      `/customers/${address}/redemptions/pending`
    );
    return response.data || [];
  } catch (error) {
    console.error('Error getting pending redemptions:', error);
    return [];
  }
};

export const approveRedemption = async (
  address: string,
  sessionId: string
): Promise<{ success: boolean; txHash?: string }> => {
  try {
    const response = await apiClient.post<any>(
      `/customers/${address}/approve-redemption`,
      { sessionId }
    );
    
    return {
      success: true,
      txHash: response.data?.txHash,
    };
  } catch (error) {
    console.error('Error approving redemption:', error);
    return { success: false };
  }
};

export const rejectRedemption = async (
  address: string,
  sessionId: string,
  reason?: string
): Promise<boolean> => {
  try {
    await apiClient.post(
      `/customers/${address}/reject-redemption`,
      { sessionId, reason }
    );
    return true;
  } catch (error) {
    console.error('Error rejecting redemption:', error);
    return false;
  }
};

// Settings & Preferences
export const updateNotificationPreferences = async (
  address: string,
  preferences: NotificationPreferences
): Promise<boolean> => {
  try {
    await apiClient.put(`/customers/${address}/preferences`, preferences);
    return true;
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return false;
  }
};

export const requestSuspension = async (
  address: string,
  reason: string
): Promise<boolean> => {
  try {
    await apiClient.post(`/customers/${address}/deactivate`, { reason });
    return true;
  } catch (error) {
    console.error('Error requesting suspension:', error);
    return false;
  }
};

export const requestUnsuspension = async (
  address: string,
  reason: string
): Promise<boolean> => {
  try {
    await apiClient.post(`/customers/${address}/request-unsuspend`, { reason });
    return true;
  } catch (error) {
    console.error('Error requesting unsuspension:', error);
    return false;
  }
};

// Data Export
export const exportCustomerData = async (
  address: string,
  format: 'json' | 'csv' | 'pdf' = 'json'
): Promise<CustomerExportData | Blob | null> => {
  try {
    const response = await apiClient.get<any>(`/customers/${address}/export`, {
      params: { format }
    });
    return response.data || null;
  } catch (error) {
    console.error('Error exporting customer data:', error);
    return null;
  }
};

// Admin Functions
export const getAllCustomers = async (params?: FilterParams & {
  tier?: 'BRONZE' | 'SILVER' | 'GOLD';
  active?: boolean;
}): Promise<Customer[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Customer[]>(`/customers${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting all customers:', error);
    return [];
  }
};

export const getCustomersByTier = async (tier: 'BRONZE' | 'SILVER' | 'GOLD'): Promise<Customer[]> => {
  try {
    const response = await apiClient.get<Customer[]>(`/customers/tier/${tier}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting customers by tier:', error);
    return [];
  }
};

export const mintTokensToCustomer = async (
  address: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; txHash?: string }> => {
  try {
    const response = await apiClient.post<any>(
      `/customers/${address}/mint`,
      { amount, reason }
    );
    
    return {
      success: true,
      txHash: response.data?.txHash,
    };
  } catch (error) {
    console.error('Error minting tokens to customer:', error);
    return { success: false };
  }
};

// Named exports grouped as namespace for convenience
export const customerApi = {
  // Profile
  register: registerCustomer,
  getProfile: getCustomerProfile,
  updateProfile: updateCustomerProfile,
  deleteAccount: deleteCustomerAccount,
  
  // Transactions
  getTransactions: getCustomerTransactions,
  getAnalytics: getCustomerAnalytics,
  getStats: getCustomerStats,
  
  // Balance
  getEarnedBalance,
  
  // Referrals
  getReferralData,
  generateReferralCode,
  
  // Shops
  getAvailableShops,
  getNearbyShops,
  
  // Redemption
  checkRedemptionEligibility,
  getPendingRedemptions,
  approveRedemption,
  rejectRedemption,
  
  // Settings
  updateNotificationPreferences,
  requestSuspension,
  requestUnsuspension,
  exportData: exportCustomerData,
  
  // Admin
  getAll: getAllCustomers,
  getByTier: getCustomersByTier,
  mintTokens: mintTokensToCustomer,
} as const;