import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys, useAppToast } from "@/shared/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { shopApi } from "../../services/shop.services";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { Linking } from "react-native";

/**
 * Cheap, DB-only gate query — backs both the dashboard PayoutSetupBanner and the
 * StripeConnectModal's "is it now actually connected" re-check. This app has no RN
 * focus-manager wired into React Query (unlike web's refetchOnWindowFocus), so
 * refetchOnMount is forced on here — correctness of the block matters more than
 * saving a cheap DB-only call on every mount.
 */
export function useConnectSummaryQuery() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.connectSummary(),
    queryFn: () => shopApi.getConnectSummary(),
    enabled: !!shopId,
    select: (res) => res?.data,
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });
}

/**
 * Live Stripe read. Only meant to be enabled from the deep-link callback screen after
 * returning from the Stripe-hosted onboarding flow — do not enable this on every mount
 * elsewhere, it hits Stripe's API rather than just the DB.
 */
export function useConnectStatusQuery(options: { enabled: boolean }) {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.connectStatus(),
    queryFn: () => shopApi.getConnectStatus(),
    enabled: options.enabled && !!shopId,
    select: (res) => res?.data,
    staleTime: 0,
  });
}

export function useCreateConnectOnboardingLinkMutation() {
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async () => {
      return shopApi.getConnectOnboardingLink();
    },
    onSuccess: async (data) => {
      const url = data.data?.url;
      if (!url) {
        showError("Unable to start Stripe onboarding. Please try again.");
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        showError("Unable to open browser. Please try again or contact support.");
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe Connect onboarding link:", error);

      if (error.response?.status === 401) {
        showError("Please log in again to continue.");
      } else if (error.response?.status === 400) {
        showError(error.response?.data?.error || "Unable to start Stripe onboarding.");
      } else {
        showError(
          error.response?.data?.details?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to start Stripe onboarding. Please try again."
        );
      }
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(undefined, options));
    },
  };
}
