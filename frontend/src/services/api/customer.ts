import { ApiService } from './base';
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
  address: string;
  name?: string;
  email?: string;
  phone?: string;
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

class CustomerApiService extends ApiService {
  /**
   * Register a new customer
   */
  async register(data: CustomerRegistrationData): Promise<Customer | null> {
    const response = await this.post<Customer>('/customers/register', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get customer profile
   */
  async getProfile(address: string): Promise<Customer | null> {
    const response = await this.get<Customer>(`/customers/${address}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    address: string,
    updates: Partial<Customer>
  ): Promise<Customer | null> {
    const response = await this.put<Customer>(
      `/customers/${address}`,
      updates,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get all customers (admin only)
   */
  async getAllCustomers(params?: FilterParams & {
    tier?: 'BRONZE' | 'SILVER' | 'GOLD';
    active?: boolean;
  }): Promise<Customer[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Customer[]>(`/customers${queryString}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get customer transactions
   */
  async getTransactions(
    address: string,
    params?: FilterParams & {
      type?: 'earned' | 'redeemed' | 'bonus' | 'referral';
      shopId?: string;
    }
  ): Promise<Transaction[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Transaction[]>(
      `/customers/${address}/transactions${queryString}`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get customer analytics
   */
  async getAnalytics(address: string): Promise<{
    earningsTrend: Array<{ date: string; amount: number }>;
    redemptionHistory: Array<{ date: string; amount: number; shopId: string }>;
    tierProgress: { current: number; next: number; percentage: number };
  } | null> {
    const response = await this.get<any>(
      `/customers/${address}/analytics`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get customer statistics
   */
  async getStats(address: string): Promise<CustomerStats | null> {
    const response = await this.get<CustomerStats>(
      `/customers/${address}/stats`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get earned balance breakdown
   */
  async getEarnedBalance(address: string): Promise<BalanceData | null> {
    const response = await this.get<BalanceData>(`/tokens/earned-balance/${address}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get referral data
   */
  async getReferralData(address: string): Promise<ReferralData | null> {
    const response = await this.get<ReferralData>(
      `/customers/${address}/referrals`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Generate referral code
   */
  async generateReferralCode(address: string): Promise<{ code: string; shareUrl: string } | null> {
    const response = await this.post<{ code: string }>(
      `/customers/${address}/referrals/generate`,
      {},
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        code: response.data.code,
        shareUrl: `${baseUrl}/customer/register?ref=${response.data.code}`,
      };
    }
    return null;
  }

  /**
   * Get available shops for customer
   */
  async getAvailableShops(address: string): Promise<ShopInfo[]> {
    const response = await this.get<ShopInfo[]>(
      `/customers/${address}/shops`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get nearby shops
   */
  async getNearbyShops(
    latitude: number,
    longitude: number,
    radius: number = 10
  ): Promise<ShopInfo[]> {
    const response = await this.get<ShopInfo[]>('/shops/nearby', {
      params: { lat: latitude, lon: longitude, radius },
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Check redemption eligibility
   */
  async checkRedemptionEligibility(
    address: string,
    shopId: string
  ): Promise<{
    eligible: boolean;
    maxRedeemable: number;
    isHomeShop: boolean;
    message?: string;
  }> {
    const response = await this.get<any>(
      `/customers/${address}/redemption-check`,
      { params: { shopId } }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      eligible: false,
      maxRedeemable: 0,
      isHomeShop: false,
      message: response.error || 'Unable to check eligibility',
    };
  }

  /**
   * Get pending redemption sessions
   */
  async getPendingRedemptions(address: string): Promise<RedemptionSession[]> {
    const response = await this.get<RedemptionSession[]>(
      `/customers/${address}/redemptions/pending`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Approve redemption
   */
  async approveRedemption(
    address: string,
    sessionId: string
  ): Promise<{ success: boolean; txHash?: string }> {
    const response = await this.post<any>(
      `/customers/${address}/approve-redemption`,
      { sessionId },
      { includeAuth: true, authType: 'customer' }
    );
    
    return {
      success: response.success,
      txHash: response.data?.txHash,
    };
  }

  /**
   * Reject redemption
   */
  async rejectRedemption(
    address: string,
    sessionId: string,
    reason?: string
  ): Promise<boolean> {
    const response = await this.post(
      `/customers/${address}/reject-redemption`,
      { sessionId, reason },
      { includeAuth: true, authType: 'customer' }
    );
    
    return response.success;
  }

  /**
   * Get customers by tier
   */
  async getCustomersByTier(tier: 'BRONZE' | 'SILVER' | 'GOLD'): Promise<Customer[]> {
    const response = await this.get<Customer[]>(`/customers/tier/${tier}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    address: string,
    preferences: NotificationPreferences
  ): Promise<boolean> {
    const response = await this.put(
      `/customers/${address}/preferences`,
      preferences,
      { includeAuth: true, authType: 'customer' }
    );
    
    return response.success;
  }

  /**
   * Request account suspension
   */
  async requestSuspension(
    address: string,
    reason: string
  ): Promise<boolean> {
    const response = await this.post(
      `/customers/${address}/deactivate`,
      { reason },
      { includeAuth: true, authType: 'customer' }
    );
    
    return response.success;
  }

  /**
   * Request unsuspension
   */
  async requestUnsuspension(
    address: string,
    reason: string
  ): Promise<boolean> {
    const response = await this.post(
      `/customers/${address}/request-unsuspend`,
      { reason },
      { includeAuth: true, authType: 'customer' }
    );
    
    return response.success;
  }

  /**
   * Export customer data
   */
  async exportData(
    address: string,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<CustomerExportData | Blob | null> {
    const response = await this.get<any>(
      `/customers/${address}/export`,
      { 
        params: { format },
        includeAuth: true,
        authType: 'customer',
      }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Mint tokens to customer (admin only)
   */
  async mintTokens(
    address: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; txHash?: string }> {
    const response = await this.post<any>(
      `/customers/${address}/mint`,
      { amount, reason },
      { includeAuth: true, authType: 'admin' }
    );
    
    return {
      success: response.success,
      txHash: response.data?.txHash,
    };
  }

  /**
   * Delete customer account
   */
  async deleteAccount(
    address: string,
    reason?: string
  ): Promise<boolean> {
    const response = await this.delete(
      `/customers/${address}`,
      {
        data: { reason },
        includeAuth: true,
        authType: 'customer',
      }
    );
    
    return response.success;
  }
}

export const customerApi = new CustomerApiService();