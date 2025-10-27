import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchTokenBalance } from "@/services/tokenServices";

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

export interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral" | "tier_bonus";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export interface TokenStats {
  totalSupply: number;
  circulatingSupply: number;
  totalMinted: number;
  totalBurned: number;
  averageRewardAmount: number;
  activeCustomers: number;
  activeShops: number;
}

export interface RedemptionRequest {
  shopId: string;
  amount: number;
  pin?: string;
}

export interface TransferRequest {
  from: string;
  to: string;
  amount: number;
}

export interface EligibilityResponse {
  eligible: boolean;
  reason?: string;
  maxRedeemable?: number;
}

// Query Keys
const QUERY_KEYS = {
  BALANCE: (address: string) => ["token", "balance", address],
  TRANSACTIONS: (address: string, limit?: number, offset?: number) => [
    "token",
    "transactions",
    address,
    { limit, offset },
  ],
  STATS: ["token", "stats"],
  PRICE: ["token", "price"],
  ELIGIBILITY: (address: string, shopId: string, amount: number) => [
    "token",
    "eligibility",
    address,
    shopId,
    amount,
  ],
  EARNING_OPPORTUNITIES: (address: string) => ["token", "earning", address],
  TRANSACTION_DETAILS: (hash: string) => ["token", "transaction", hash],
  GAS_ESTIMATE: (type: string, amount: number) => [
    "token",
    "gas",
    type,
    amount,
  ],
};

// Hook: Fetch Token Balance
export const useTokenBalance = (address?: string) => {
  const userAddress = useAuthStore((state) => state.userProfile?.address);
  const walletAddress = address || userAddress;

  return useQuery<BalanceData | null>({
    queryKey: QUERY_KEYS.BALANCE(walletAddress || ""),
    queryFn: async () => {
      const data = await fetchTokenBalance(walletAddress!);
      if (data) {
        // Round all numeric values to 2 decimal places
        const roundedData: BalanceData = {
          availableBalance:
            Math.round(data.data.availableBalance * 100) / 100,
          lifetimeEarned: Math.round(data.data.lifetimeEarned * 100) / 100,
          totalRedeemed: Math.round(data.data.totalRedeemed * 100) / 100,
          earningHistory: data.data.earningHistory
            ? {
                fromRepairs:
                  Math.round(
                    (data.data.earningHistory.fromRepairs || 0) * 100
                  ) / 100,
                fromReferrals:
                  Math.round(
                    (data.data.earningHistory.fromReferrals || 0) * 100
                  ) / 100,
                fromBonuses:
                  Math.round(
                    (data.data.earningHistory.fromBonuses || 0) * 100
                  ) / 100,
                fromTierBonuses:
                  Math.round(
                    (data.data.earningHistory.fromTierBonuses || 0) * 100
                  ) / 100,
              }
            : undefined,
        };
        return roundedData;
      }
      return null;
    },
    enabled: !!walletAddress,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};
