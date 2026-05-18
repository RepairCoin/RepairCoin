import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { 
  ApprovalRequest, 
  BalanceData, 
  CreateRedemptionSessionRequest, 
  MyRedemptionSessionsResponse, 
  RedemptionCallbacks, 
  RedemptionSession 
} from "../../services/token.interface";
import { tokenApi } from "../../services";

export const useRedemptionSessions = () => {
  const { userProfile } = useAuthStore();
  const walletAddress = userProfile?.address;

  const query = useQuery<MyRedemptionSessionsResponse>({
    queryKey: queryKeys.redemptionSessions(walletAddress || ""),
    queryFn: async () => {
      const response: MyRedemptionSessionsResponse =
        await tokenApi.fetchMyRedemptionSessions();
      return response;
    },
    enabled: !!walletAddress,
    staleTime: 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const sessions = query.data?.sessions || [];
  const pendingSessions = sessions.filter(
    (session: RedemptionSession) => session.status === "pending"
  );

  return {
    ...query,
    sessionsData: query.data,
    sessions,
    pendingSessions,
    isLoadingSessions: query.isLoading,
    refetchSessions: query.refetch,
  };
};

export const useApproveRedemptionSession = () => {
  return useMutation({
    mutationFn: async ({
      sessionId,
      signature,
      transactionHash,
    }: ApprovalRequest) => {
      console.log("[useApproveRedemptionSession] Approving session:", {
        sessionId,
        signature: signature.substring(0, 10) + "...",
        hasTransactionHash: !!transactionHash,
      });

      const response = await tokenApi.approvalRedemptionSession(
        sessionId,
        signature,
      );
      console.log("[useApproveRedemptionSession] Response:", response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log("[useApproveRedemptionSession] Success:", {
        sessionId: variables.sessionId,
        status: data?.data?.status,
      });
    },
    onError: (error: any, variables) => {
      console.error("[useApproveRedemptionSession] Error:", {
        sessionId: variables.sessionId,
        error: error?.message || error,
      });
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};

export const useRejectRedemptionSession = () => {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      console.log("[useRejectRedemptionSession] Rejecting session:", {
        sessionId,
      });

      const response = await tokenApi.rejectRedemptionSession(sessionId);
      console.log("[useRejectRedemptionSession] Response:", response);
      return response;
    },
    onSuccess: (data, sessionId) => {
      console.log("[useRejectRedemptionSession] Success:", {
        sessionId,
        status: data?.data?.status,
      });
    },
    onError: (error: any, sessionId) => {
      console.error("[useRejectRedemptionSession] Error:", {
        sessionId,
        error: error?.message || error,
      });
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};

export const useCancelRedemptionSession = (
  callbacks?: RedemptionCallbacks
) => {
  const { onError } = callbacks || {};

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await tokenApi.cancelRedemptionSession(sessionId);
    },
    onError: (error: any) => {
      console.error("Failed to cancel session:", error);
      onError?.(
        error instanceof Error ? error : new Error("Failed to cancel session")
      );
    },
  });
};

export const useCreateRedemptionSession = (
  callbacks?: RedemptionCallbacks
) => {
  const { onSessionCreated, onError } = callbacks || {};
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: CreateRedemptionSessionRequest) => {
      return await tokenApi.createRedemptionSession(request);
    },
    onSuccess: (response, variables) => {
      if (!response.data?.sessionId || !response.data?.expiresAt) {
        console.error(
          "Invalid session response: missing sessionId or expiresAt"
        );
        return;
      }

      const session: RedemptionSession = {
        sessionId: response.data.sessionId,
        customerAddress: variables.customerAddress,
        shopId: variables.shopId,
        amount: variables.amount,
        status: "pending",
        expiresAt: response.data.expiresAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSessionCreated?.(session);
    },
    onError: (error: any) => {
      console.error("Failed to create redemption session:", error);
      onError?.(
        error instanceof Error
          ? error
          : new Error("Failed to create redemption session")
      );
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: CreateRedemptionSessionRequest,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(request, options));
    },
  };
};

export const useTokenBalance = (walletAddress?: string) => {
  return useQuery<BalanceData | null>({
    queryKey: queryKeys.tokenBalance(walletAddress || ""),
    queryFn: async () => {
      const data = await tokenApi.fetchTokenBalance(walletAddress!);
      if (data) {
        const roundedData: BalanceData = {
          availableBalance:
            Math.round((data.data?.availableBalance || 0) * 100) / 100,
          lifetimeEarned:
            Math.round((data.data?.lifetimeEarned || 0) * 100) / 100,
          totalRedeemed:
            Math.round((data.data?.totalRedeemed || 0) * 100) / 100,
          earningHistory: data.data?.earningHistory
            ? {
                fromRepairs:
                  Math.round(
                    (data.data?.earningHistory?.fromRepairs || 0) * 100,
                  ) / 100,
                fromReferrals:
                  Math.round(
                    (data.data?.earningHistory?.fromReferrals || 0) * 100,
                  ) / 100,
                fromBonuses:
                  Math.round(
                    (data.data.earningHistory.fromBonuses || 0) * 100,
                  ) / 100,
                fromTierBonuses:
                  Math.round(
                    (data.data.earningHistory.fromTierBonuses || 0) * 100,
                  ) / 100,
              }
            : undefined,
        };
        return roundedData;
      }
      return null;
    },
    enabled: !!walletAddress,
    staleTime: 30000,
  });
};