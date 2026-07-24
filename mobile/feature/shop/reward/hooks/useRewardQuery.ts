import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys, useAppToast } from "@/shared/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopApi } from "../../services/shop.services";
import { RewardRequest } from "../../services/shop.interface";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { getShopActionErrorMessage } from "@/shared/utilities/shopApiError";

export function useShopBalance() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shop(shopId || ""),
    queryFn: () => shopApi.getShopById(shopId!),
    enabled: !!shopId,
    select: (data) => data.data?.purchasedRcnBalance ?? 0,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

export function useRecentRewards() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: ["recentRewards", shopId],
    queryFn: () => shopApi.getRecentRewards(shopId!, 5),
    enabled: !!shopId,
    staleTime: 30 * 1000,
    select: (res) => res?.data?.transactions || res?.data || [],
  });
}

export function useIssueReward(resetInputs?: () => void) {
  const rqClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const shopWalletAddress = useAuthStore((state) => state.account?.address);
  const { showSuccess, showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: RewardRequest) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      return shopApi.issueReward(shopId, request);
    },
    onSuccess: (data, variables) => {
      showSuccess(
        `Successfully issued ${data.data?.totalReward} RCN to customer!`
      );

      if (resetInputs) {
        resetInputs();
      }

      if (variables.customerAddress) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.customerInfo(variables.customerAddress),
        });
        rqClient.invalidateQueries({
          queryKey: queryKeys.customerTransactions(variables.customerAddress),
        });
      }

      if (shopWalletAddress) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.shopByWalletAddress(shopWalletAddress),
        });
      }

      rqClient.invalidateQueries({
        queryKey: ["recentRewards", shopId],
      });
    },
    onError: (error: any) => {
      console.error("Failed to issue reward:", error);

      // The endpoint is gated by requireShopOwnership /
      // requireShopPermission('rewards:issue') / requireActiveSubscription, and
      // answers 403/404 with the actual reason in the body. Showing
      // error.message here leaked axios's "Request failed with status code 403".
      showError(
        getShopActionErrorMessage(error, {
          action: "issue rewards",
          permissionHint: "Issue Rewards access",
          fallback: "Failed to issue reward. Please try again.",
        })
      );
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: RewardRequest,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(request, options));
    },
    // Guarded too, so a double tap can't fire two rewards (and two toasts).
    mutateAsync: async (
      request: RewardRequest,
      options?: Parameters<typeof mutation.mutateAsync>[1]
    ) => {
      return guard(() => mutation.mutateAsync(request, options));
    },
  };
}