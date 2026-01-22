import { useState, useCallback, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
  RedemptionSession,
  SessionStatus,
  CreateRedemptionSessionRequest,
  RedemptionCallbacks,
} from "../../types";
import { useCreateRedemptionSession, useCancelRedemptionSession } from "../mutations";
import { useSessionTimer } from "./useSessionTimer";
import { useSessionPolling } from "./useSessionPolling";

/**
 * Hook for managing redemption session lifecycle
 */
export const useRedemptionSession = (callbacks?: RedemptionCallbacks) => {
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
};
