import apiClient from './client';
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

// Referral Code
export const generateReferralCode = async (): Promise<{
  code: string;
  shareUrl: string;
} | null> => {
  try {
    const response = await apiClient.post<{ code: string }>('/referral/generate', {});
    
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

export const validateReferralCode = async (code: string): Promise<ReferralValidation> => {
  try {
    const response = await apiClient.get<ReferralValidation>(`/referral/validate/${code}`);
    return response.data || { isValid: false, message: 'Invalid referral code' };
  } catch (error) {
    console.error('Error validating referral code:', error);
    return {
      isValid: false,
      message: 'Invalid referral code',
    };
  }
};

// Statistics
export const getReferralStats = async (): Promise<ReferralStats | null> => {
  try {
    const response = await apiClient.get<ReferralStats>('/referral/stats');
    
    if (response.data) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        ...response.data,
        shareUrl: response.data.referralCode
          ? `${baseUrl}/register/customer?ref=${response.data.referralCode}`
          : undefined,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return null;
  }
};

// Leaderboard
export const getReferralLeaderboard = async (params?: {
  limit?: number;
  period?: 'all' | 'month' | 'week';
}): Promise<Array<{
  rank: number;
  address: string;
  name?: string;
  referralCount: number;
  totalEarned: number;
}>> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Array<{
      rank: number;
      address: string;
      name?: string;
      referralCount: number;
      totalEarned: number;
    }>>(`/referral/leaderboard${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting referral leaderboard:', error);
    return [];
  }
};

// History
export const getReferralHistory = async (address: string): Promise<Referral[]> => {
  try {
    const response = await apiClient.get<{ referrals: Referral[] }>(`/customers/${address}/referrals`);
    return response.data?.referrals || [];
  } catch (error) {
    console.error('Error getting referral history:', error);
    return [];
  }
};

// Tracking
export const trackReferralClick = async (code: string): Promise<boolean> => {
  try {
    await apiClient.post('/referral/track-click', { code });
    return true;
  } catch (error) {
    console.error('Error tracking referral click:', error);
    return false;
  }
};

// Completion
export const completeReferral = async (
  referredAddress: string,
  referralCode: string
): Promise<{
  success: boolean;
  rewardAmount?: number;
  txHash?: string;
}> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      rewardAmount?: number;
      txHash?: string;
    }>('/referral/complete', {
      referredAddress,
      referralCode,
    });
    
    return response.data || { success: false };
  } catch (error) {
    console.error('Error completing referral:', error);
    return { success: false };
  }
};

// Pending Rewards
export const getPendingReferralRewards = async (address: string): Promise<{
  pendingAmount: number;
  pendingCount: number;
  referrals: Array<{
    referredAddress: string;
    status: string;
    expectedReward: number;
  }>;
}> => {
  try {
    const response = await apiClient.get<{
      pendingAmount: number;
      pendingCount: number;
      referrals: Array<{
        referredAddress: string;
        status: string;
        expectedReward: number;
      }>;
    }>(`/referral/pending-rewards/${address}`);
    
    return response.data || {
      pendingAmount: 0,
      pendingCount: 0,
      referrals: [],
    };
  } catch (error) {
    console.error('Error getting pending referral rewards:', error);
    return {
      pendingAmount: 0,
      pendingCount: 0,
      referrals: [],
    };
  }
};

// Named exports grouped as namespace for convenience
export const referralApi = {
  // Code Management
  generateCode: generateReferralCode,
  validateCode: validateReferralCode,
  
  // Statistics
  getStats: getReferralStats,
  getLeaderboard: getReferralLeaderboard,
  getHistory: getReferralHistory,
  
  // Tracking & Completion
  trackClick: trackReferralClick,
  complete: completeReferral,
  
  // Rewards
  getPendingRewards: getPendingReferralRewards,
} as const;