import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import {
  createRedemptionSession,
  checkRedemptionSessionStatus,
  cancelRedemptionSession,
  processRedemption,
  getCustomerInfo,
  getCustomerBalance,
  RedemptionSession,
  CreateRedemptionSessionRequest,
  ProcessRedemptionRequest,
} from "@/services/ShopServices";
import { queryKeys } from "@/config/queryClient";

export interface CustomerData {
  address: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
  balance: number;
  lifetimeEarnings: number;
}

export type SessionStatus = "idle" | "waiting" | "processing" | "completed";

interface RedemptionCallbacks {
  onSessionCreated?: (session: RedemptionSession) => void;
  onSessionApproved?: (session: RedemptionSession) => void;
  onSessionRejected?: (session: RedemptionSession) => void;
  onSessionExpired?: (session: RedemptionSession) => void;
  onRedemptionComplete?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useCustomerLookup() {
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerData(null);
      setCustomerError(null);
    }
  }, [customerAddress]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      const [customerResponse, balanceResponse] = await Promise.all([
        getCustomerInfo(address),
        getCustomerBalance(address),
      ]);

      if (customerResponse && balanceResponse) {
        setCustomerData({
          address,
          tier: customerResponse.data?.customer?.tier || "BRONZE",
          balance: balanceResponse.data?.totalBalance || 0,
          lifetimeEarnings: customerResponse.data?.customer?.lifetime_earnings || 0,
        });
      } else {
        setCustomerError("Customer not found");
        setCustomerData(null);
      }
    } catch (error) {
      console.error("Error looking up customer:", error);
      setCustomerError("Failed to lookup customer");
      setCustomerData(null);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const resetCustomer = useCallback(() => {
    setCustomerAddress("");
    setCustomerData(null);
    setCustomerError(null);
  }, []);

  return {
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    lookupCustomer,
    resetCustomer,
  };
}

export function useSessionTimer(
  currentSession: RedemptionSession | null,
  sessionStatus: SessionStatus,
  onExpired?: () => void
) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (currentSession && (sessionStatus === "waiting" || sessionStatus === "processing")) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(currentSession.expiresAt).getTime();
        const diff = expiry - now;

        if (diff <= 0) {
          setTimeRemaining("00:00");
          onExpired?.();
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [currentSession, sessionStatus, onExpired]);

  return { timeRemaining };
}

export function useCreateRedemptionSession(callbacks?: RedemptionCallbacks) {
  const { onSessionCreated, onError } = callbacks || {};

  return useMutation({
    mutationFn: async (request: CreateRedemptionSessionRequest) => {
      return await createRedemptionSession(request);
    },
    onSuccess: (response, variables) => {
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
        error instanceof Error ? error : new Error("Failed to create redemption session")
      );
    },
  });
}

export function useCancelRedemptionSession(callbacks?: RedemptionCallbacks) {
  const { onError } = callbacks || {};

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await cancelRedemptionSession(sessionId);
    },
    onError: (error: any) => {
      console.error("Failed to cancel session:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to cancel session"));
    },
  });
}

export function useSessionPolling(
  shopId: string | undefined,
  callbacks?: RedemptionCallbacks
) {
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

    const request: ProcessRedemptionRequest = {
      customerAddress: currentSession.customerAddress,
      amount: currentSession.amount,
      sessionId,
    };

    try {
      const response = await processRedemption(shopId, request);
      onRedemptionComplete?.(response.data);

      // Invalidate relevant queries
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
          const response = await checkRedemptionSessionStatus(sessionId);
          const sessionData = response.data;

          // Update session expiry time
          setSessionData({ expiresAt: sessionData.expiresAt });

          if (sessionData.status === "approved") {
            setStatus("processing");
            stopPolling();
            onSessionApproved?.(sessionData);
            await processRedemptionAfterApproval(sessionId, currentSession);
            setStatus("completed");
          } else if (sessionData.status === "rejected") {
            stopPolling();
            setStatus("idle");
            onSessionRejected?.(sessionData);
          } else if (
            sessionData.status === "expired" ||
            new Date(sessionData.expiresAt) < new Date()
          ) {
            stopPolling();
            setStatus("idle");
            onSessionExpired?.(sessionData);
          } else if (sessionData.status === "used") {
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
}

export function useRedemptionSession(callbacks?: RedemptionCallbacks) {
  const shopData = useAuthStore((state) => state.userProfile);

  const [currentSession, setCurrentSession] = useState<RedemptionSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");

  const createSessionMutation = useCreateRedemptionSession({
    ...callbacks,
    onSessionCreated: (session) => {
      setCurrentSession(session);
      setSessionStatus("waiting");
      callbacks?.onSessionCreated?.(session);
    },
  });

  const cancelSessionMutation = useCancelRedemptionSession(callbacks);

  const { startPolling, stopPolling } = useSessionPolling(shopData?.id, {
    ...callbacks,
    onSessionExpired: (session) => {
      setSessionStatus("idle");
      setCurrentSession(null);
      callbacks?.onSessionExpired?.(session);
    },
    onSessionRejected: (session) => {
      setSessionStatus("idle");
      setCurrentSession(null);
      callbacks?.onSessionRejected?.(session);
    },
  });

  const { timeRemaining } = useSessionTimer(currentSession, sessionStatus, () => {
    setSessionStatus("completed");
    callbacks?.onSessionExpired?.(currentSession!);
  });

  const createSession = useCallback(
    (request: CreateRedemptionSessionRequest) => {
      createSessionMutation.mutate(request, {
        onSuccess: () => {
          // Start polling after session is created
          if (currentSession) {
            startPolling(
              currentSession.sessionId,
              currentSession,
              (data) => setCurrentSession((prev) => (prev ? { ...prev, ...data } : null)),
              setSessionStatus
            );
          }
        },
      });
    },
    [createSessionMutation, currentSession, startPolling]
  );

  useEffect(() => {
    // Start polling when session is created
    if (currentSession && sessionStatus === "waiting") {
      startPolling(
        currentSession.sessionId,
        currentSession,
        (data) => setCurrentSession((prev) => (prev ? { ...prev, ...data } : null)),
        setSessionStatus
      );
    }
  }, [currentSession?.sessionId, sessionStatus]);

  const cancelSession = useCallback(
    (sessionId: string) => {
      cancelSessionMutation.mutate(sessionId, {
        onSuccess: () => {
          stopPolling();
          setCurrentSession(null);
          setSessionStatus("idle");
        },
      });
    },
    [cancelSessionMutation, stopPolling]
  );

  const resetSession = useCallback(() => {
    stopPolling();
    setCurrentSession(null);
    setSessionStatus("idle");
  }, [stopPolling]);

  return {
    currentSession,
    sessionStatus,
    timeRemaining,
    createSession,
    cancelSession,
    resetSession,
    isCreatingSession: createSessionMutation.isPending,
    isCancellingSession: cancelSessionMutation.isPending,
    createSessionError: createSessionMutation.error,
    cancelSessionError: cancelSessionMutation.error,
  };
}

export function useRedemption(callbacks?: RedemptionCallbacks) {
  const customerLookup = useCustomerLookup();
  const redemptionSession = useRedemptionSession(callbacks);

  const resetRedemption = useCallback(() => {
    customerLookup.resetCustomer();
    redemptionSession.resetSession();
  }, [customerLookup, redemptionSession]);

  return {
    ...customerLookup,
    ...redemptionSession,
    resetRedemption,
  };
}
