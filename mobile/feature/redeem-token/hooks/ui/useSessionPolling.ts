import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { shopApi } from "@/shared/services/shop.services";
import { tokenApi } from "@/feature/redeem-token/services/token.services";
import { RedemptionSession, SessionStatus, RedemptionCallbacks } from "../../types";

/**
 * Hook for polling session status
 */
export const useSessionPolling = (
  shopId: string | undefined,
  callbacks?: RedemptionCallbacks
) => {
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const {
    onSessionApproved,
    onSessionRejected,
    onSessionExpired,
    onRedemptionComplete,
    onError,
  } = callbacks || {};

  const pollingInterval = 2000;
  const maxPollingAttempts = 150;

  const processRedemptionAfterApproval = async (
    sessionId: string,
    currentSession: RedemptionSession | null
  ) => {
    if (!shopId || !currentSession) {
      throw new Error("Shop ID or session not found");
    }

    const request: {
      customerAddress: string;
      amount: number;
      sessionId: string;
    } = {
      customerAddress: currentSession.customerAddress,
      amount: currentSession.maxAmount || currentSession.amount || 0,
      sessionId,
    };

    try {
      const response = await shopApi.processRedemption(shopId, request);
      onRedemptionComplete?.(response.data);

      queryClient.invalidateQueries({
        queryKey: queryKeys.shops(),
      });
    } catch (error) {
      console.error("Redemption error:", error);
      onError?.(error instanceof Error ? error : new Error("Redemption failed"));
      throw error;
    }
  };

  const startPolling = useCallback(
    (
      sessionId: string,
      currentSession: RedemptionSession | null,
      setSessionData: (data: Partial<RedemptionSession>) => void,
      setStatus: (status: SessionStatus) => void
    ) => {
      pollCountRef.current = 0;

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        pollCountRef.current++;

        if (pollCountRef.current > maxPollingAttempts) {
          stopPolling();
          setStatus("idle");
          onError?.(new Error("Session polling timeout"));
          return;
        }

        try {
          const response = await tokenApi.checkRedemptionSessionStatus(sessionId);
          const sessionData = response.data;

          setSessionData({ expiresAt: sessionData?.expiresAt });

          if (sessionData?.status === "approved") {
            setStatus("processing");
            stopPolling();
            onSessionApproved?.(sessionData);
            await processRedemptionAfterApproval(sessionId, currentSession);
            setStatus("completed");
          } else if (sessionData?.status === "rejected") {
            stopPolling();
            setStatus("idle");
            onSessionRejected?.(sessionData);
          } else if (
            sessionData?.status === "expired" ||
            new Date(sessionData?.expiresAt || "") < new Date()
          ) {
            stopPolling();
            setStatus("idle");
            if (sessionData) {
              onSessionExpired?.(sessionData);
            }
          } else if (sessionData?.status === "used") {
            stopPolling();
            setStatus("completed");
            onRedemptionComplete?.(sessionData);
          }
        } catch (error) {
          console.error("Error checking session status:", error);
          if (pollCountRef.current > 5) {
            stopPolling();
            setStatus("idle");
            onError?.(
              error instanceof Error ? error : new Error("Failed to check session status")
            );
          }
        }
      }, pollingInterval);
    },
    [
      maxPollingAttempts,
      pollingInterval,
      onSessionApproved,
      onSessionRejected,
      onSessionExpired,
      onRedemptionComplete,
      onError,
      shopId,
      queryClient,
    ]
  );

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
  };
};
