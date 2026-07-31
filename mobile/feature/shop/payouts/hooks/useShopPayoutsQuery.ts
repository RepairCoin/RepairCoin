import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys, useAppToast } from "@/shared/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopApi } from "../../services/shop.services";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

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

/**
 * Mints a Stripe-HOSTED onboarding link (Account Link) for the "Get Paid" setup and opens
 * it in the auth browser. Connect embedded components can't run in a mobile WebView (their
 * auth step opens a popup a WebView can't service), so onboarding happens on Stripe's
 * hosted page and returns via the repaircoin:// deep link — the same composition the
 * subscription checkout uses. A 409 means the shop already owns a Standard Stripe account;
 * the backend's message explains that, so surface it verbatim.
 */
export function useCreateHostedOnboardingLinkMutation() {
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      return shopApi.createConnectHostedOnboardingLink();
    },
    onSuccess: async (data) => {
      const url = data.data?.url;
      if (!url) {
        showError("Unable to start payment onboarding. Please try again.");
        return;
      }

      // Resolves when the shop lands back on the deep link OR just dismisses the browser.
      // Either way, re-read live status — reaching return_url proves nothing by itself.
      await WebBrowser.openAuthSessionAsync(url, "repaircoin://shop/payouts/callback");
      queryClient.invalidateQueries({ queryKey: queryKeys.connectSummary() });
      queryClient.invalidateQueries({ queryKey: queryKeys.connectStatus() });
    },
    onError: (error: any) => {
      console.error("Failed to create hosted onboarding link:", error);

      if (error.response?.status === 401) {
        showError("Please log in again to continue.");
      } else {
        showError(
          error.response?.data?.error ||
            error.message ||
            "Failed to start payment onboarding. Please try again."
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
