import { useApproveRedemptionSession as useApproveSession } from "../useTokenQueries";

/**
 * Hook for approving a redemption session
 */
export const useApproveRedemptionSession = () => {
  return useApproveSession();
};
