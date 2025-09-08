import { ApiService } from './base';
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

class AdminApiService extends ApiService {
  /**
   * Get platform statistics
   */
  async getStats(): Promise<AdminStats | null> {
    const response = await this.get<AdminStats>('/admin/stats', {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get all customers with filters
   */
  async getCustomers(params?: FilterParams & {
    tier?: 'BRONZE' | 'SILVER' | 'GOLD';
    active?: boolean;
    suspended?: boolean;
  }): Promise<{
    customers: Customer[];
    total: number;
  }> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<any>(`/admin/customers${queryString}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return { customers: [], total: 0 };
  }

  /**
   * Get all shops with filters
   */
  async getShops(params?: FilterParams & {
    verified?: boolean;
    active?: boolean;
  }): Promise<Shop[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Shop[]>(`/admin/shops${queryString}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Approve shop application
   */
  async approveShop(shopId: string, notes?: string): Promise<boolean> {
    const response = await this.post(
      `/admin/shops/${shopId}/approve`,
      { notes },
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Reject shop application
   */
  async rejectShop(shopId: string, reason: string): Promise<boolean> {
    const response = await this.post(
      `/admin/shops/${shopId}/reject`,
      { reason },
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Create new shop (admin)
   */
  async createShop(data: CreateShopData): Promise<Shop | null> {
    const response = await this.post<Shop>('/admin/create-shop', data, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Mint tokens to address
   */
  async mintTokens(data: MintTokensData): Promise<{
    success: boolean;
    txHash?: string;
    amount?: number;
  }> {
    const response = await this.post<any>('/admin/mint', data, {
      includeAuth: true,
      authType: 'admin',
    });
    
    return response;
  }

  /**
   * Sell RCN to shop
   */
  async sellRcnToShop(data: SellRcnData): Promise<ShopPurchase | null> {
    const response = await this.post<ShopPurchase>(
      `/admin/shops/${data.shopId}/sell-rcn`,
      data,
      { includeAuth: true, authType: 'admin' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get shop RCN balance
   */
  async getShopRcnBalance(shopId: string): Promise<{
    purchasedBalance: number;
    usedBalance: number;
    availableBalance: number;
  } | null> {
    const response = await this.get<any>(
      `/admin/shops/${shopId}/rcn-balance`,
      { includeAuth: true, authType: 'admin' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get shop purchase history
   */
  async getShopPurchaseHistory(shopId: string, params?: FilterParams): Promise<ShopPurchase[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<ShopPurchase[]>(
      `/admin/shops/${shopId}/purchase-history${queryString}`,
      { includeAuth: true, authType: 'admin' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Suspend customer
   */
  async suspendCustomer(address: string, reason: string): Promise<boolean> {
    const response = await this.post(
      `/admin/customers/${address}/suspend`,
      { reason },
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Unsuspend customer
   */
  async unsuspendCustomer(address: string): Promise<boolean> {
    const response = await this.post(
      `/admin/customers/${address}/unsuspend`,
      {},
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Suspend shop
   */
  async suspendShop(shopId: string, reason: string): Promise<boolean> {
    const response = await this.post(
      `/admin/shops/${shopId}/suspend`,
      { reason },
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Unsuspend shop
   */
  async unsuspendShop(shopId: string): Promise<boolean> {
    const response = await this.post(
      `/admin/shops/${shopId}/unsuspend`,
      {},
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Get treasury data
   */
  async getTreasury(): Promise<TreasuryData | null> {
    const response = await this.get<TreasuryData>('/admin/treasury', {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Update treasury after RCN sale
   */
  async updateTreasury(data: {
    amountSold: number;
    revenue: number;
    shopId: string;
    transactionHash?: string;
  }): Promise<boolean> {
    const response = await this.post('/admin/treasury/update', data, {
      includeAuth: true,
      authType: 'admin',
    });
    
    return response.success;
  }

  /**
   * Get analytics data
   */
  async getAnalytics(params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }): Promise<AdminAnalytics | null> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<AdminAnalytics>(`/admin/analytics${queryString}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get all transactions
   */
  async getTransactions(params?: FilterParams & {
    type?: string;
    shopId?: string;
    customerAddress?: string;
  }): Promise<Transaction[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Transaction[]>(`/admin/transactions${queryString}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get failed webhooks
   */
  async getFailedWebhooks(params?: FilterParams): Promise<WebhookLog[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<WebhookLog[]>(`/admin/webhooks/failed${queryString}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(webhookId: number): Promise<boolean> {
    const response = await this.post(
      `/admin/webhooks/retry/${webhookId}`,
      {},
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Pause contract operations
   */
  async pauseContract(): Promise<boolean> {
    const response = await this.post(
      '/admin/contract/pause',
      {},
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Unpause contract operations
   */
  async unpauseContract(): Promise<boolean> {
    const response = await this.post(
      '/admin/contract/unpause',
      {},
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }

  /**
   * Create new admin
   */
  async createAdmin(data: {
    address: string;
    name?: string;
    email?: string;
    permissions?: string[];
  }): Promise<boolean> {
    const response = await this.post('/admin/create-admin', data, {
      includeAuth: true,
      authType: 'admin',
    });
    
    return response.success;
  }

  /**
   * Get unsuspend requests
   */
  async getUnsuspendRequests(type: 'customer' | 'shop'): Promise<Array<{
    id: number;
    address?: string;
    shopId?: string;
    reason: string;
    requestDate: string;
    status: 'pending' | 'approved' | 'rejected';
  }>> {
    const response = await this.get<any[]>(`/admin/unsuspend-requests/${type}`, {
      includeAuth: true,
      authType: 'admin',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Process unsuspend request
   */
  async processUnsuspendRequest(
    requestId: number,
    action: 'approve' | 'reject',
    notes?: string
  ): Promise<boolean> {
    const response = await this.post(
      `/admin/unsuspend-requests/${requestId}/${action}`,
      { notes },
      { includeAuth: true, authType: 'admin' }
    );
    
    return response.success;
  }
}

export const adminApi = new AdminApiService();