import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { useMutation } from "@tanstack/react-query";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import {
  GiftTokenRequest,
  GiftTokenResponse,
  ValidateTransferRequest,
  ValidateTransferResponse,
} from "../../services/token.interface";
import { tokenApi } from "../../services";

// Transfer token (gift)
export const useTransferToken = () => {
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (payload: GiftTokenRequest) => {
      const response: GiftTokenResponse =
        await tokenApi.transferToken(payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerProfile(variables.fromAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerTransactions(variables.fromAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.transfers(),
      });
    },
    onError: (error: any) => {
      console.error("[useTransferToken] Error:", error);
      throw error;
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutateAsync: (
      payload: GiftTokenRequest,
      options?: Parameters<typeof mutation.mutateAsync>[1]
    ) => {
      return (
        guard(() => mutation.mutateAsync(payload, options)) ??
        Promise.reject(new Error("Already submitting"))
      );
    },
  };
};

// Validate transfer
export const useValidateTransfer = () => {
  return useMutation({
    mutationFn: async (payload: ValidateTransferRequest) => {
      const response: ValidateTransferResponse =
        await tokenApi.validateTransfer(payload);
      return response.data;
    },
    onError: (error: any) => {
      console.error("[useValidateTransfer] Error:", error);
      throw error;
    },
  });
};