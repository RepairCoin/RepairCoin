import apiClient from './client';
import {
  Shop,
  Customer,
  Transaction,
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

// Shop Management
export const registerShop = async (data: ShopRegistrationData): Promise<Shop | null> => {
  try {
    const response = await apiClient.post<Shop>('/shops/register', data);
    return response.data || null;
  } catch (error) {
    console.error('Error registering shop:', error);
    return null;
  }
};

export const getShop = async (shopId: string): Promise<Shop | null> => {
  try {
    const response = await apiClient.get<Shop>(`/shops/${shopId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting shop:', error);
    return null;
  }
};

export const getShopByWallet = async (address: string): Promise<Shop | null> => {
  try {
    const response = await apiClient.get<Shop>(`/shops/wallet/${address}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting shop by wallet:', error);
    return null;
  }
};

export const updateShop = async (shopId: string, updates: Partial<Shop>): Promise<Shop | null> => {
  try {
    const response = await apiClient.put<Shop>(`/shops/${shopId}`, updates);
    return response.data || null;
  } catch (error) {
    console.error('Error updating shop:', error);
    return null;
  }
};

export const getShops = async (params?: FilterParams & {
  verified?: boolean;
  active?: boolean;
  crossShopEnabled?: boolean;
}): Promise<Shop[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Shop[]>(`/shops${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting shops:', error);
    return [];
  }
};

// Customer Management
export const getShopCustomers = async (shopId: string, params?: FilterParams): Promise<Customer[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Customer[]>(`/shops/${shopId}/customers${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting shop customers:', error);
    return [];
  }
};

// Transactions
export const getShopTransactions = async (shopId: string, params?: FilterParams): Promise<Transaction[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<Transaction[]>(`/shops/${shopId}/transactions${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting shop transactions:', error);
    return [];
  }
};

// Rewards
export const issueReward = async (
  shopId: string,
  data: IssueRewardData
): Promise<{
  success: boolean;
  txHash?: string;
  totalRewarded?: number;
  tierBonus?: number;
}> => {
  try {
    const response = await apiClient.post<{
      txHash?: string;
      totalRewarded?: number;
      tierBonus?: number;
    }>(`/shops/${shopId}/issue-reward`, data);
    
    return {
      success: true,
      txHash: response.data?.txHash,
      totalRewarded: response.data?.totalRewarded,
      tierBonus: response.data?.tierBonus,
    };
  } catch (error) {
    console.error('Error issuing reward:', error);
    return { success: false };
  }
};

// Redemption
export const initiateRedemption = async (
  shopId: string,
  data: RedeemTokensData
): Promise<RedemptionSession | null> => {
  try {
    const response = await apiClient.post<RedemptionSession>(`/shops/${shopId}/redeem`, data);
    return response.data || null;
  } catch (error) {
    console.error('Error initiating redemption:', error);
    return null;
  }
};

export const getRedemptionSession = async (
  shopId: string,
  sessionId: string
): Promise<RedemptionSession | null> => {
  try {
    const response = await apiClient.get<RedemptionSession>(`/shops/${shopId}/redemption-session/${sessionId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting redemption session:', error);
    return null;
  }
};

export const cancelRedemption = async (shopId: string, sessionId: string): Promise<boolean> => {
  try {
    await apiClient.delete(`/shops/${shopId}/redemption-session/${sessionId}`);
    return true;
  } catch (error) {
    console.error('Error canceling redemption:', error);
    return false;
  }
};

// Statistics
export const getShopStats = async (shopId: string): Promise<{
  totalCustomers: number;
  totalTransactions: number;
  totalRcnIssued: number;
  totalRcnRedeemed: number;
  averageTransactionValue: number;
  topCustomers: Customer[];
} | null> => {
  try {
    const response = await apiClient.get<{
      totalCustomers: number;
      totalTransactions: number;
      totalRcnIssued: number;
      totalRcnRedeemed: number;
      averageTransactionValue: number;
      topCustomers: Customer[];
    }>(`/shops/${shopId}/stats`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting shop stats:', error);
    return null;
  }
};

// Tier Bonus
export const previewTierBonus = async (data: {
  customerAddress: string;
  repairAmount: number;
  shopId?: string;
}): Promise<TierBonusPreview | null> => {
  try {
    const response = await apiClient.post<TierBonusPreview>('/tier-bonus/preview', data);
    return response.data || null;
  } catch (error) {
    console.error('Error previewing tier bonus:', error);
    return null;
  }
};

export const getTierBonusStats = async (shopId: string): Promise<{
  totalBonusesIssued: number;
  bonusesByTier: Record<string, number>;
  topBonusRecipients: Array<{
    customerAddress: string;
    totalBonus: number;
    tier: string;
  }>;
} | null> => {
  try {
    const response = await apiClient.get<{
      totalBonusesIssued: number;
      bonusesByTier: Record<string, number>;
      topBonusRecipients: Array<{
        customerAddress: string;
        totalBonus: number;
        tier: string;
      }>;
    }>(`/tier-bonus/stats/${shopId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting tier bonus stats:', error);
    return null;
  }
};

export const calculateTierBonus = async (data: {
  customerAddress: string;
  baseAmount: number;
  repairAmount: number;
}): Promise<{
  baseReward: number;
  tierBonus: number;
  totalReward: number;
  tier: string;
} | null> => {
  try {
    const response = await apiClient.post<{
      baseReward: number;
      tierBonus: number;
      totalReward: number;
      tier: string;
    }>('/tier-bonus/calculate', data);
    return response.data || null;
  } catch (error) {
    console.error('Error calculating tier bonus:', error);
    return null;
  }
};

// RCN Purchase
export const initiatePurchase = async (
  shopId: string,
  data: {
    rcnAmount: number;
    paymentMethod: 'crypto' | 'fiat' | 'bank_transfer';
  }
): Promise<PurchaseSession | null> => {
  try {
    const response = await apiClient.post<PurchaseSession>('/purchase/initiate', { shopId, ...data });
    return response.data || null;
  } catch (error) {
    console.error('Error initiating purchase:', error);
    return null;
  }
};

export const completePurchase = async (data: {
  sessionId: string;
  paymentReference: string;
  txHash?: string;
}): Promise<ShopPurchase | null> => {
  try {
    const response = await apiClient.post<ShopPurchase>('/purchase/complete', data);
    return response.data || null;
  } catch (error) {
    console.error('Error completing purchase:', error);
    return null;
  }
};

export const getRcnBalance = async (shopId: string): Promise<{
  purchasedBalance: number;
  usedBalance: number;
  availableBalance: number;
} | null> => {
  try {
    const response = await apiClient.get<{
      purchasedBalance: number;
      usedBalance: number;
      availableBalance: number;
    }>(`/purchase/balance/${shopId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting RCN balance:', error);
    return null;
  }
};

export const getPurchaseHistory = async (
  shopId: string,
  params?: FilterParams
): Promise<ShopPurchase[]> => {
  try {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<ShopPurchase[]>(`/purchase/history/${shopId}${queryString}`);
    return response.data || [];
  } catch (error) {
    console.error('Error getting purchase history:', error);
    return [];
  }
};

// Verification & Settings
export const requestVerification = async (shopId: string, documents?: any): Promise<boolean> => {
  try {
    await apiClient.post(`/shops/${shopId}/request-verification`, { documents });
    return true;
  } catch (error) {
    console.error('Error requesting verification:', error);
    return false;
  }
};

export const toggleCrossShop = async (shopId: string, enabled: boolean): Promise<boolean> => {
  try {
    await apiClient.put(`/shops/${shopId}/cross-shop`, { enabled });
    return true;
  } catch (error) {
    console.error('Error toggling cross-shop:', error);
    return false;
  }
};

// Shop Profile Enhancements
export interface GalleryPhoto {
  id: number;
  photoUrl: string;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
}

export const updateShopProfile = async (
  shopId: string,
  data: {
    bannerUrl?: string;
    aboutText?: string;
    logoUrl?: string;
  }
): Promise<boolean> => {
  try {
    const response = await apiClient.put<{ success: boolean; message: string }>(`/shops/${shopId}/profile`, data);
    // API client interceptor returns response.data, so response is already { success, message }
    return (response as any).success || false;
  } catch (error) {
    console.error('Error updating shop profile:', error);
    return false;
  }
};

export const getGalleryPhotos = async (shopId: string): Promise<GalleryPhoto[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: GalleryPhoto[] }>(`/shops/${shopId}/gallery`);
    // API client interceptor returns response.data, so response is already { success, data }
    return (response as any).data || [];
  } catch {
    // Gallery is optional - silently return empty array if not available
    return [];
  }
};

export const addGalleryPhoto = async (
  shopId: string,
  data: { photoUrl: string; caption?: string }
): Promise<{ id: number } | null> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: { id: number } }>(`/shops/${shopId}/gallery`, data);
    // API client interceptor returns response.data, so response is already { success, data }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error adding gallery photo:', error);
    return null;
  }
};

export const deleteGalleryPhoto = async (shopId: string, photoId: number): Promise<boolean> => {
  try {
    await apiClient.delete(`/shops/${shopId}/gallery/${photoId}`);
    return true;
  } catch (error) {
    console.error('Error deleting gallery photo:', error);
    return false;
  }
};

export const updateGalleryPhotoCaption = async (
  shopId: string,
  photoId: number,
  caption: string
): Promise<boolean> => {
  try {
    await apiClient.put(`/shops/${shopId}/gallery/${photoId}/caption`, { caption });
    return true;
  } catch (error) {
    console.error('Error updating gallery photo caption:', error);
    return false;
  }
};

export const updateGalleryPhotoOrder = async (
  shopId: string,
  photoId: number,
  displayOrder: number
): Promise<boolean> => {
  try {
    await apiClient.put(`/shops/${shopId}/gallery/${photoId}/order`, { displayOrder });
    return true;
  } catch (error) {
    console.error('Error updating gallery photo order:', error);
    return false;
  }
};

// Named exports grouped as namespace for convenience
export const shopApi = {
  // Management
  register: registerShop,
  get: getShop,
  getByWallet: getShopByWallet,
  update: updateShop,
  list: getShops,
  
  // Customers
  getCustomers: getShopCustomers,
  
  // Transactions
  getTransactions: getShopTransactions,
  
  // Rewards
  issueReward,
  
  // Redemption
  initiateRedemption,
  getRedemptionSession,
  cancelRedemption,
  
  // Stats
  getStats: getShopStats,
  
  // Tier Bonus
  previewTierBonus,
  getTierBonusStats,
  calculateTierBonus,
  
  // RCN Purchase
  initiatePurchase,
  completePurchase,
  getRcnBalance,
  getPurchaseHistory,
  
  // Settings
  requestVerification,
  toggleCrossShop,

  // Profile & Gallery
  updateProfile: updateShopProfile,
  getGallery: getGalleryPhotos,
  addGalleryPhoto,
  deleteGalleryPhoto,
  updateGalleryPhotoCaption,
  updateGalleryPhotoOrder,
} as const;