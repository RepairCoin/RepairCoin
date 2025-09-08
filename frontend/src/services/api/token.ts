import apiClient from './client';
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

export const getEarningSources = async (address: string): Promise<EarningSources | null> => {
  try {
    const response = await apiClient.get<EarningSources>(`/tokens/earning-sources/${address}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting earning sources:', error);
    return null;
  }
};

// Verification
export const verifyRedemption = async (data: VerifyRedemptionData): Promise<VerificationResult | null> => {
  try {
    const response = await apiClient.post<VerificationResult>('/tokens/verify-redemption', data);
    return response.data || null;
  } catch (error) {
    console.error('Error verifying redemption:', error);
    return null;
  }
};

export const verifyBatch = async (requests: VerifyRedemptionData[]): Promise<VerificationResult[]> => {
  try {
    const response = await apiClient.post<VerificationResult[]>('/tokens/verify-batch', { requests });
    return response.data || [];
  } catch (error) {
    console.error('Error verifying batch:', error);
    return [];
  }
};

// Token Statistics
export const getTokenStats = async (): Promise<TokenStats | null> => {
  try {
    const response = await apiClient.get<TokenStats>('/tokens/stats');
    return response.data || null;
  } catch (error) {
    console.error('Error getting token stats:', error);
    return null;
  }
};

export const getTokenPrice = async (): Promise<{
  priceUSD: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
} | null> => {
  try {
    const response = await apiClient.get<{
      priceUSD: number;
      priceChange24h: number;
      volume24h: number;
      marketCap: number;
    }>('/tokens/price');
    return response.data || null;
  } catch (error) {
    console.error('Error getting token price:', error);
    return null;
  }
};

// Cross-shop
export const verifyCrossShopRedemption = async (data: {
  customerAddress: string;
  shopId: string;
  amount: number;
}): Promise<CrossShopVerification | null> => {
  try {
    const response = await apiClient.post<CrossShopVerification>('/cross-shop/verify', data);
    return response.data || null;
  } catch (error) {
    console.error('Error verifying cross-shop redemption:', error);
    return null;
  }
};

export const getCrossShopBalance = async (customerAddress: string): Promise<{
  availableBalance: number;
  maxCrossShopAmount: number;
  homeShopId?: string;
  homeShopName?: string;
} | null> => {
  try {
    const response = await apiClient.get<{
      availableBalance: number;
      maxCrossShopAmount: number;
      homeShopId?: string;
      homeShopName?: string;
    }>(`/cross-shop/balance/${customerAddress}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting cross-shop balance:', error);
    return null;
  }
};

// RCN Breakdown
export const getRcnBreakdown = async (customerAddress: string): Promise<{
  onChainBalance: number;
  earnedBalance: number;
  referralBalance: number;
  bonusBalance: number;
  redeemedAmount: number;
  availableForRedemption: number;
  lockedAmount: number;
} | null> => {
  try {
    const response = await apiClient.get<{
      onChainBalance: number;
      earnedBalance: number;
      referralBalance: number;
      bonusBalance: number;
      redeemedAmount: number;
      availableForRedemption: number;
      lockedAmount: number;
    }>('/referral/rcn-breakdown');
    return response.data || null;
  } catch (error) {
    console.error('Error getting RCN breakdown:', error);
    return null;
  }
};

// Redemption Eligibility
export const checkRedemptionEligibility = async (
  customerAddress: string,
  shopId: string,
  amount: number
): Promise<{
  eligible: boolean;
  maxRedeemable: number;
  reason?: string;
}> => {
  try {
    const response = await apiClient.post<{
      eligible: boolean;
      maxRedeemable: number;
      reason?: string;
    }>('/referral/verify-redemption', {
      customerAddress,
      shopId,
      requestedAmount: amount,
    });
    
    return response.data || {
      eligible: false,
      maxRedeemable: 0,
      reason: 'Unable to verify redemption eligibility',
    };
  } catch (error) {
    console.error('Error checking redemption eligibility:', error);
    return {
      eligible: false,
      maxRedeemable: 0,
      reason: 'Unable to verify redemption eligibility',
    };
  }
};

// Transaction History
export const getTokenTransactionHistory = async (
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
}>> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Array<{
      id: string;
      type: string;
      amount: number;
      description: string;
      shopId?: string;
      shopName?: string;
      txHash?: string;
      createdAt: string;
    }>>(`/customers/${address}/transactions${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting token transaction history:', error);
    return [];
  }
};

// Leaderboard
export const getLeaderboard = async (params?: {
  period?: 'all' | 'month' | 'week';
  type?: 'earnings' | 'referrals' | 'tier';
  limit?: number;
}): Promise<Array<{
  rank: number;
  address: string;
  name?: string;
  value: number;
  tier?: string;
}>> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Array<{
      rank: number;
      address: string;
      name?: string;
      value: number;
      tier?: string;
    }>>(`/referral/leaderboard${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
};

// Named exports grouped as namespace for convenience
export const tokenApi = {
  // Balance
  getEarnedBalance,
  getEarningSources,
  
  // Verification
  verifyRedemption,
  verifyBatch,
  
  // Stats
  getTokenStats,
  getTokenPrice,
  
  // Cross-shop
  verifyCrossShopRedemption,
  getCrossShopBalance,
  
  // Breakdown
  getRcnBreakdown,
  checkRedemptionEligibility,
  
  // Transactions
  getTransactionHistory: getTokenTransactionHistory,
  
  // Leaderboard
  getLeaderboard,
} as const;