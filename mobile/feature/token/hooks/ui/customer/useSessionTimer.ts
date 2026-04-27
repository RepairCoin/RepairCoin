import { useState, useEffect } from "react";
import { RedemptionSession, SessionStatus } from "../../types";

/**
 * Hook for managing session countdown timer
 */
export const useSessionTimer = (
  currentSession: RedemptionSession | null,
  sessionStatus: SessionStatus,
  onExpired?: () => void
) => {
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
};
