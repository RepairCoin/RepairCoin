import apiClient from "@/utilities/axios";

// Interfaces
export interface BalanceData {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  earningHistory?: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
  homeShop?: string;
}

export interface BalanceResponse {
  data: BalanceData;
  success: boolean;
}

/**
 * Fetch token balance for a wallet address
 */
export const fetchTokenBalance = async (
  address: string
): Promise<BalanceResponse | null> => {
  try {
    return await apiClient.get<BalanceResponse>(`/tokens/balance/${address}`);
  } catch (error) {
    console.error("Failed to get tokens balance:", error);
    throw error;
  }
};
