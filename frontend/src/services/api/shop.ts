import { ApiService } from './base';
import {
  Shop,
  Customer,
  Transaction,
  TierBonus,
  TierBonusPreview,
  ShopPurchase,
  PurchaseSession,
  RedemptionSession,
  FilterParams,
} from '@/constants/types';

export interface ShopRegistrationData {
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
  referralSource?: string;
}

export interface IssueRewardData {
  customerAddress: string;
  amount: number;
  repairAmount: number;
  description?: string;
}

export interface RedeemTokensData {
  customerAddress: string;
  amount: number;
  description?: string;
}

class ShopApiService extends ApiService {
  /**
   * Register a new shop
   */
  async register(data: ShopRegistrationData): Promise<Shop | null> {
    const response = await this.post<Shop>('/shops/register', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get shop by ID
   */
  async getShop(shopId: string): Promise<Shop | null> {
    const response = await this.get<Shop>(`/shops/${shopId}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get shop by wallet address
   */
  async getShopByWallet(address: string): Promise<Shop | null> {
    const response = await this.get<Shop>(`/shops/wallet/${address}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Update shop information
   */
  async updateShop(shopId: string, updates: Partial<Shop>): Promise<Shop | null> {
    const response = await this.put<Shop>(`/shops/${shopId}`, updates, {
      includeAuth: true,
      authType: 'shop',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get all shops with filters
   */
  async getShops(params?: FilterParams & {
    verified?: boolean;
    active?: boolean;
    crossShopEnabled?: boolean;
  }): Promise<Shop[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Shop[]>(`/shops${queryString}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get shop customers
   */
  async getCustomers(shopId: string, params?: FilterParams): Promise<Customer[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Customer[]>(
      `/shops/${shopId}/customers${queryString}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get shop transactions
   */
  async getTransactions(shopId: string, params?: FilterParams): Promise<Transaction[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<Transaction[]>(
      `/shops/${shopId}/transactions${queryString}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Issue reward to customer
   */
  async issueReward(shopId: string, data: IssueRewardData): Promise<{
    success: boolean;
    txHash?: string;
    totalRewarded?: number;
    tierBonus?: number;
  }> {
    const response = await this.post<any>(
      `/shops/${shopId}/issue-reward`,
      data,
      { includeAuth: true, authType: 'shop' }
    );
    
    return response;
  }

  /**
   * Initiate redemption session
   */
  async initiateRedemption(shopId: string, data: RedeemTokensData): Promise<RedemptionSession | null> {
    const response = await this.post<RedemptionSession>(
      `/shops/${shopId}/redeem`,
      data,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get redemption session status
   */
  async getRedemptionSession(shopId: string, sessionId: string): Promise<RedemptionSession | null> {
    const response = await this.get<RedemptionSession>(
      `/shops/${shopId}/redemption-session/${sessionId}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Cancel redemption session
   */
  async cancelRedemption(shopId: string, sessionId: string): Promise<boolean> {
    const response = await this.delete(
      `/shops/${shopId}/redemption-session/${sessionId}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    return response.success;
  }

  /**
   * Get shop statistics
   */
  async getStats(shopId: string): Promise<{
    totalCustomers: number;
    totalTransactions: number;
    totalRcnIssued: number;
    totalRcnRedeemed: number;
    averageTransactionValue: number;
    topCustomers: Customer[];
  } | null> {
    const response = await this.get<any>(
      `/shops/${shopId}/stats`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get tier bonus preview
   */
  async previewTierBonus(data: {
    customerAddress: string;
    repairAmount: number;
    shopId?: string;
  }): Promise<TierBonusPreview | null> {
    const response = await this.post<TierBonusPreview>('/tier-bonus/preview', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get tier bonus stats for shop
   */
  async getTierBonusStats(shopId: string): Promise<{
    totalBonusesIssued: number;
    bonusesByTier: Record<string, number>;
    topBonusRecipients: Array<{
      customerAddress: string;
      totalBonus: number;
      tier: string;
    }>;
  } | null> {
    const response = await this.get<any>(
      `/tier-bonus/stats/${shopId}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Calculate tier bonus
   */
  async calculateTierBonus(data: {
    customerAddress: string;
    baseAmount: number;
    repairAmount: number;
  }): Promise<{
    baseReward: number;
    tierBonus: number;
    totalReward: number;
    tier: string;
  } | null> {
    const response = await this.post<any>('/tier-bonus/calculate', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Initiate RCN purchase
   */
  async initiatePurchase(shopId: string, data: {
    rcnAmount: number;
    paymentMethod: 'crypto' | 'fiat' | 'bank_transfer';
  }): Promise<PurchaseSession | null> {
    const response = await this.post<PurchaseSession>(
      '/purchase/initiate',
      { shopId, ...data },
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Complete RCN purchase
   */
  async completePurchase(data: {
    sessionId: string;
    paymentReference: string;
    txHash?: string;
  }): Promise<ShopPurchase | null> {
    const response = await this.post<ShopPurchase>(
      '/purchase/complete',
      data,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get shop RCN balance
   */
  async getRcnBalance(shopId: string): Promise<{
    purchasedBalance: number;
    usedBalance: number;
    availableBalance: number;
  } | null> {
    const response = await this.get<any>(
      `/purchase/balance/${shopId}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get purchase history
   */
  async getPurchaseHistory(shopId: string, params?: FilterParams): Promise<ShopPurchase[]> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<ShopPurchase[]>(
      `/purchase/history/${shopId}${queryString}`,
      { includeAuth: true, authType: 'shop' }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Request shop verification
   */
  async requestVerification(shopId: string, documents?: any): Promise<boolean> {
    const response = await this.post(
      `/shops/${shopId}/request-verification`,
      { documents },
      { includeAuth: true, authType: 'shop' }
    );
    
    return response.success;
  }

  /**
   * Enable/disable cross-shop redemptions
   */
  async toggleCrossShop(shopId: string, enabled: boolean): Promise<boolean> {
    const response = await this.put(
      `/shops/${shopId}/cross-shop`,
      { enabled },
      { includeAuth: true, authType: 'shop' }
    );
    
    return response.success;
  }
}

export const shopApi = new ShopApiService();