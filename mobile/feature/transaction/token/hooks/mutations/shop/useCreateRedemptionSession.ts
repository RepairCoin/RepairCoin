import { useMutation } from "@tanstack/react-query";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { tokenApi } from "../../../services/token.services";
import {
  CreateRedemptionSessionRequest,
  RedemptionSession,
  RedemptionCallbacks,
} from "../../../types";

export const useCreateRedemptionSession = (callbacks?: RedemptionCallbacks) => {
  const { onSessionCreated, onError } = callbacks || {};
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: CreateRedemptionSessionRequest) => {
      return await tokenApi.createRedemptionSession(request);
    },
    onSuccess: (response, variables) => {
      if (!response.data?.sessionId || !response.data?.expiresAt) {
        console.error("Invalid session response: missing sessionId or expiresAt");
        return;
      }

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
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (request: CreateRedemptionSessionRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(request, options));
    },
  };
};
