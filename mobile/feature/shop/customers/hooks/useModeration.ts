import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { queryKeys } from "@/shared/config/queryClient";
import { shopApi } from "@/feature/shop/services/shop.services";
import {
  BlockCustomerRequest,
  FlagReviewRequest,
} from "@/feature/shop/services/shop.interface";

// List of blocked customers for the current shop.
export function useBlockedCustomers() {
  return useQuery({
    queryKey: queryKeys.blockedCustomers(),
    queryFn: async () => {
      const res = await shopApi.getBlockedCustomers();
      return res?.data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

// Whether a specific customer is blocked by the current shop.
export function useCustomerBlockStatus(walletAddress?: string) {
  return useQuery({
    queryKey: queryKeys.customerBlockStatus(walletAddress || ""),
    queryFn: async () => {
      const res = await shopApi.getCustomerBlockStatus(walletAddress!);
      return res?.data?.isBlocked ?? false;
    },
    enabled: !!walletAddress,
    staleTime: 30 * 1000,
  });
}

export function useBlockCustomer(onSuccess?: () => void) {
  const qc = useQueryClient();
  const { showSuccess, showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: BlockCustomerRequest) =>
      shopApi.blockCustomer(request),
    onSuccess: (_data, variables) => {
      showSuccess("Customer blocked");
      qc.invalidateQueries({ queryKey: queryKeys.blockedCustomers() });
      qc.invalidateQueries({
        queryKey: queryKeys.customerBlockStatus(variables.customerWalletAddress),
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Failed to block customer:", error);
      let message = "Failed to block customer. Please try again.";
      if (error.response?.status === 409) {
        message = "This customer is already blocked.";
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      } else if (error.message) {
        message = error.message;
      }
      showError(message);
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: BlockCustomerRequest,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => {
      guard(() => mutation.mutate(request, options));
    },
  };
}

export function useFlagReview(onSuccess?: () => void) {
  const { showSuccess, showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: FlagReviewRequest) => shopApi.flagReview(request),
    onSuccess: () => {
      showSuccess("Review flagged. Sent to admin for review.");
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Failed to flag review:", error);
      let message = "Failed to flag review. Please try again.";
      if (error.response?.status === 409) {
        message = "You've already flagged this review.";
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      } else if (error.message) {
        message = error.message;
      }
      showError(message);
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: FlagReviewRequest,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => {
      guard(() => mutation.mutate(request, options));
    },
  };
}

export function useUnblockCustomer(onSuccess?: () => void) {
  const qc = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (walletAddress: string) =>
      shopApi.unblockCustomer(walletAddress),
    onSuccess: (_data, walletAddress) => {
      showSuccess("Customer unblocked");
      qc.invalidateQueries({ queryKey: queryKeys.blockedCustomers() });
      qc.invalidateQueries({
        queryKey: queryKeys.customerBlockStatus(walletAddress),
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Failed to unblock customer:", error);
      showError(
        error.response?.data?.error ||
          "Failed to unblock customer. Please try again.",
      );
    },
  });
}
