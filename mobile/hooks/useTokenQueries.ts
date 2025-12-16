import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import {
  approvalRedemptionSession,
  fetchMyRedemptionSessions,
  fetchTokenBalance,
  rejectRedemptionSession,
  RedemptionSessionsResponse
} from "@/services/tokenServices";

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

// Interface for approval request
export interface ApprovalRequest {
  sessionId: string;
  signature: string;
  transactionHash?: string;
}

// Hook: Fetch Token Balance
export const useTokenBalance = (walletAddress?: string) => {
  return useQuery<BalanceData | null>({
    queryKey: queryKeys.tokenBalance(walletAddress || ""),
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

// Hook: Fetch Redemption Sessions
export const useRedemptionSessions = () => {
  const { userProfile } = useAuthStore();
  const walletAddress = userProfile?.address;

  return useQuery<RedemptionSessionsResponse>({
    queryKey: queryKeys.redemptionSessions(walletAddress || ""),
    queryFn: async () => {
      const response: RedemptionSessionsResponse = await fetchMyRedemptionSessions();
      return response;
    },
    enabled: !!walletAddress,
    staleTime: 10000, // 10 seconds (more frequent for active sessions)
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Hook: Approve Redemption Session
export const useApproveRedemptionSession = () => {
  return useMutation({
    mutationFn: async ({ sessionId, signature, transactionHash }: ApprovalRequest) => {
      console.log('[useApproveRedemptionSession] Approving session:', {
        sessionId,
        signature: signature.substring(0, 10) + '...', // Log only first 10 chars
        hasTransactionHash: !!transactionHash
      });
      
      const response = await approvalRedemptionSession(sessionId, signature);
      console.log('[useApproveRedemptionSession] Response:', response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log('[useApproveRedemptionSession] Success:', {
        sessionId: variables.sessionId,
        status: data?.data?.status
      });
    },
    onError: (error: any, variables) => {
      console.error('[useApproveRedemptionSession] Error:', {
        sessionId: variables.sessionId,
        error: error?.message || error
      });
    },
    retry: 2, // Reduced retries for user actions
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Faster retry for UX
  });
};

// Hook: Reject Redemption Session
export const useRejectRedemptionSession = () => {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      console.log('[useRejectRedemptionSession] Rejecting session:', {
        sessionId
      });
      
      const response = await rejectRedemptionSession(sessionId);
      console.log('[useRejectRedemptionSession] Response:', response);
      return response;
    },
    onSuccess: (data, sessionId) => {
      console.log('[useRejectRedemptionSession] Success:', {
        sessionId,
        status: data?.data?.status
      });
    },
    onError: (error: any, sessionId) => {
      console.error('[useRejectRedemptionSession] Error:', {
        sessionId,
        error: error?.message || error
      });
    },
    retry: 2, // Reduced retries for user actions
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Faster retry for UX
  });
};
