import { ApiService } from './base';
import { BalanceData, CrossShopVerification } from '@/constants/types';

export interface VerifyRedemptionData {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export interface EarningSources {
  homeShop: {
    shopId: string;
    shopName: string;
    totalEarned: number;
    breakdown: {
      repairs: number;
      bonuses: number;
    };
  };
  otherShops: Array<{
    shopId: string;
    shopName: string;
    totalEarned: number;
  }>;
  referrals: {
    totalEarned: number;
    count: number;
  };
  summary: {
    totalEarned: number;
    homeShopEarned: number;
    crossShopEarned: number;
    referralEarned: number;
  };
}

export interface TokenStats {
  totalSupply: number;
  circulatingSupply: number;
  totalMinted: number;
  totalBurned: number;
  averageHolding: number;
  holders: number;
  velocity: number;
}

export interface VerificationResult {
  canRedeem: boolean;
  availableForRedemption: number;
  isHomeShop: boolean;
  homeShopBalance: number;
  crossShopBalance: number;
  message?: string;
  details?: {
    totalEarned: number;
    totalRedeemed: number;
    marketPurchased: number;
  };
}

class TokenApiService extends ApiService {
  /**
   * Get earned balance breakdown for customer
   */
  async getEarnedBalance(address: string): Promise<BalanceData | null> {
    const response = await this.get<BalanceData>(`/tokens/earned-balance/${address}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get earning sources breakdown
   */
  async getEarningSources(address: string): Promise<EarningSources | null> {
    const response = await this.get<EarningSources>(`/tokens/earning-sources/${address}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Verify redemption eligibility
   */
  async verifyRedemption(data: VerifyRedemptionData): Promise<VerificationResult | null> {
    const response = await this.post<VerificationResult>('/tokens/verify-redemption', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Batch verify redemptions
   */
  async verifyBatch(requests: VerifyRedemptionData[]): Promise<VerificationResult[]> {
    const response = await this.post<VerificationResult[]>('/tokens/verify-batch', {
      requests,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<TokenStats | null> {
    const response = await this.get<TokenStats>('/tokens/stats');
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get token price info
   */
  async getTokenPrice(): Promise<{
    priceUSD: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
  } | null> {
    const response = await this.get<any>('/tokens/price');
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Verify cross-shop redemption eligibility
   */
  async verifyCrossShopRedemption(data: {
    customerAddress: string;
    shopId: string;
    amount: number;
  }): Promise<CrossShopVerification | null> {
    const response = await this.post<CrossShopVerification>('/cross-shop/verify', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get cross-shop balance for customer
   */
  async getCrossShopBalance(customerAddress: string): Promise<{
    availableBalance: number;
    maxCrossShopAmount: number;
    homeShopId?: string;
    homeShopName?: string;
  } | null> {
    const response = await this.get<any>(`/cross-shop/balance/${customerAddress}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get RCN breakdown for customer
   */
  async getRcnBreakdown(customerAddress: string): Promise<{
    onChainBalance: number;
    earnedBalance: number;
    referralBalance: number;
    bonusBalance: number;
    redeemedAmount: number;
    availableForRedemption: number;
    lockedAmount: number;
  } | null> {
    const response = await this.get<any>(`/referral/rcn-breakdown`, {
      includeAuth: true,
      authType: 'customer',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Check redemption eligibility at shop
   */
  async checkRedemptionEligibility(
    customerAddress: string,
    shopId: string,
    amount: number
  ): Promise<{
    eligible: boolean;
    maxRedeemable: number;
    reason?: string;
  }> {
    const response = await this.post<any>('/referral/verify-redemption', {
      customerAddress,
      shopId,
      requestedAmount: amount,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      eligible: false,
      maxRedeemable: 0,
      reason: response.error || 'Unable to verify redemption eligibility',
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    address: string,
    params?: {
      type?: 'earned' | 'redeemed' | 'bonus' | 'referral';
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    shopId?: string;
    shopName?: string;
    txHash?: string;
    createdAt: string;
  }>> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<any[]>(`/customers/${address}/transactions${queryString}`, {
      includeAuth: true,
      authType: 'customer',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboard(params?: {
    period?: 'all' | 'month' | 'week';
    type?: 'earnings' | 'referrals' | 'tier';
    limit?: number;
  }): Promise<Array<{
    rank: number;
    address: string;
    name?: string;
    value: number;
    tier?: string;
  }>> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<any[]>(`/referral/leaderboard${queryString}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }
}

export const tokenApi = new TokenApiService();