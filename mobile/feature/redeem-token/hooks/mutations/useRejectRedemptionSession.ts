import { useRejectRedemptionSession as useRejectSession } from "@/hooks/useTokenQueries";

/**
 * Hook for rejecting a redemption session
 */
export const useRejectRedemptionSession = () => {
  return useRejectSession();
};
