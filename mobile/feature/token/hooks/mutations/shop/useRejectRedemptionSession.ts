import { useRejectRedemptionSession as useRejectSession } from "../useTokenQueries";

/**
 * Hook for rejecting a redemption session
 */
export const useRejectRedemptionSession = () => {
  return useRejectSession();
};
