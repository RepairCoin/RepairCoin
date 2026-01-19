import { useMutation } from "@tanstack/react-query";
import { tokenApi } from "@/services/token.services";
import { RedemptionCallbacks } from "../../types";

/**
 * Hook for cancelling a redemption session
 */
export const useCancelRedemptionSession = (callbacks?: RedemptionCallbacks) => {
  const { onError } = callbacks || {};

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await tokenApi.cancelRedemptionSession(sessionId);
    },
    onError: (error: any) => {
      console.error("Failed to cancel session:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to cancel session"));
    },
  });
};
