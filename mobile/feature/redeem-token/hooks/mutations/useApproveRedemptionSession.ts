import { useApproveRedemptionSession as useApproveSession } from "@/hooks/useTokenQueries";

/**
 * Hook for approving a redemption session
 */
export const useApproveRedemptionSession = () => {
  return useApproveSession();
};
