import { ApiService } from './base';
import { ReferralData, Referral } from '@/constants/types';

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  pendingRewards: number;
  referralCode: string;
  shareUrl?: string;
}

export interface ReferralValidation {
  isValid: boolean;
  referrerAddress?: string;
  referrerName?: string;
  message?: string;
}

class ReferralApiService extends ApiService {
  /**
   * Generate referral code for customer
   */
  async generateCode(): Promise<{
    code: string;
    shareUrl: string;
  } | null> {
    const response = await this.post<any>('/referral/generate', {}, {
      includeAuth: true,
      authType: 'customer',
    });
    
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
   * Validate referral code
   */
  async validateCode(code: string): Promise<ReferralValidation> {
    const response = await this.get<any>(`/referral/validate/${code}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      isValid: false,
      message: response.error || 'Invalid referral code',
    };
  }

  /**
   * Get referral statistics
   */
  async getStats(): Promise<ReferralStats | null> {
    const response = await this.get<any>('/referral/stats', {
      includeAuth: true,
      authType: 'customer',
    });
    
    if (response.success && response.data) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        ...response.data,
        shareUrl: response.data.referralCode 
          ? `${baseUrl}/customer/register?ref=${response.data.referralCode}`
          : undefined,
      };
    }
    return null;
  }

  /**
   * Get referral leaderboard
   */
  async getLeaderboard(params?: {
    limit?: number;
    period?: 'all' | 'month' | 'week';
  }): Promise<Array<{
    rank: number;
    address: string;
    name?: string;
    referralCount: number;
    totalEarned: number;
  }>> {
    const queryString = params ? this.buildQueryString(params) : '';
    const response = await this.get<any[]>(`/referral/leaderboard${queryString}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  /**
   * Get referral history for customer
   */
  async getReferralHistory(address: string): Promise<Referral[]> {
    const response = await this.get<{ referrals: Referral[] }>(
      `/customers/${address}/referrals`,
      { includeAuth: true, authType: 'customer' }
    );
    
    if (response.success && response.data) {
      return response.data.referrals || [];
    }
    return [];
  }

  /**
   * Track referral link click
   */
  async trackClick(code: string): Promise<boolean> {
    const response = await this.post(`/referral/track-click`, { code });
    return response.success;
  }

  /**
   * Complete referral (called after first repair)
   */
  async completeReferral(
    referredAddress: string,
    referralCode: string
  ): Promise<{
    success: boolean;
    rewardAmount?: number;
    txHash?: string;
  }> {
    const response = await this.post<any>('/referral/complete', {
      referredAddress,
      referralCode,
    }, {
      includeAuth: true,
      authType: 'shop',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return { success: false };
  }

  /**
   * Get pending referral rewards
   */
  async getPendingRewards(address: string): Promise<{
    pendingAmount: number;
    pendingCount: number;
    referrals: Array<{
      referredAddress: string;
      status: string;
      expectedReward: number;
    }>;
  }> {
    const response = await this.get<any>(`/referral/pending-rewards/${address}`, {
      includeAuth: true,
      authType: 'customer',
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      pendingAmount: 0,
      pendingCount: 0,
      referrals: [],
    };
  }
}

export const referralApi = new ReferralApiService();