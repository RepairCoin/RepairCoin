import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "@/config/queryClient";
import {
  transferToken,
  validateTransfer,
  getTransferHistory,
  GiftTokenRequest,
  GiftTokenResponse,
  ValidateTransferRequest,
  ValidateTransferResponse,
  TransferHistoryResponse,
} from "@/services/tokenServices";

export const useToken = () => {
  /**
   * Hook to transfer/gift tokens to another user
   */
  const useTransferToken = () => {
    return useMutation({
      mutationFn: async (payload: GiftTokenRequest) => {
        const response: GiftTokenResponse = await transferToken(payload);
        return response.data;
      },
      onSuccess: (_, variables) => {
        // Invalidate relevant queries after successful transfer
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
    });
  };

  /**
   * Hook to validate a transfer before executing
   */
  const useValidateTransfer = () => {
    return useMutation({
      mutationFn: async (payload: ValidateTransferRequest) => {
        const response: ValidateTransferResponse = await validateTransfer(payload);
        return response.data;
      },
      onError: (error: any) => {
        console.error("[useValidateTransfer] Error:", error);
        throw error;
      },
    });
  };

  /**
   * Hook to get transfer history for a wallet address
   */
  const useTransferHistory = (
    address: string,
    options?: { limit?: number; offset?: number }
  ) => {
    return useQuery({
      queryKey: queryKeys.transferHistory(address, options),
      queryFn: async () => {
        const response: TransferHistoryResponse = await getTransferHistory(
          address,
          options
        );
        return response.data;
      },
      enabled: !!address,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    useTransferToken,
    useValidateTransfer,
    useTransferHistory,
  };
};
