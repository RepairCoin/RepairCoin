import { apiClient } from '@/utilities/axios';

interface CustomerData {
  data: {
    customer: {
      address: string;
      name: string;
      email: string;
      phone: string;
      tier: string;
      lifetimeEarnings: number;
      referralCode: string;
      referralCount: number;
      dailyEarnings: number;
      monthlyEarnings: number;
      lastEarnedDate: string;
      joinDate: string;
      isActive: boolean;
      isSuspended: boolean;
      suspensionReason: string | null;
      id: number;
      shopId: string;
      stripeCustomerId: string;
      createdAt: string;
      updatedAt: string;
    },
    blockchainBalance: number,
    tierBenefits: {
      earningMultiplier: number,
      redemptionRate: number,
      crossShopRedemption: boolean,
      tierBonus: number,
      features: string[]
    },
    earningCapacity: {},
    tierProgression: {}
  },
  success: boolean,
  message: string
}

export const getCustomerByWalletAddress = async (address: string): Promise<CustomerData> => {
  try {
    return await apiClient.get<CustomerData>(`/customers/${address}`);
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    throw error;
  }
}

export const getRCNBalanceByWalletAddress = async (address: string) => {
  try {
    return await apiClient.get(`/tokens/earned-balance/${address}`);
  } catch (error) {
    console.error('Failed to fetch balance:', error);
    throw error;
  }
}

export const getEarningHistoryByWalletAddress = async (address: string, token?: string) => {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return await apiClient.get(`/customers/${address}/transactions`, config);
  } catch (error) {
    console.error('Failed to fetch earning history:', error);
    throw error;
  }
}

export const calculateTierByAddress = async (address: string, repairAmount: number) => {
  try {
    return await apiClient.post('/shops/tier-bonus/calculate', {
      customerAddress: address,
      repairAmount
    });
  } catch (error) {
    console.error('Failed to calculate tier:', error);
    throw error;
  }
}