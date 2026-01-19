import { useRedemptionSessions as useRedemptionSessionsQuery } from "@/hooks/useTokenQueries";
import { RedemptionSession } from "../../types";

/**
 * Hook for fetching customer's redemption sessions
 */
export const useRedemptionSessions = () => {
  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
    refetch: refetchSessions,
  } = useRedemptionSessionsQuery();

  const sessions = sessionsData?.sessions || [];
  const pendingSessions = sessions.filter(
    (session: RedemptionSession) => session.status === "pending"
  );

  return {
    sessionsData,
    sessions,
    pendingSessions,
    isLoadingSessions,
    refetchSessions,
  };
};
