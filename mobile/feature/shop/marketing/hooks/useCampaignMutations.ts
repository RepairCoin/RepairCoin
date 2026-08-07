import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys, useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { marketingApi } from "../services/marketing.services";
import { CreateCampaignData, UpdateCampaignData } from "../services/marketing.interface";

// Mobile never offers reward editing (no reward UI — see plan's "Rewards — read-only, and fenced
// off"). Structurally dropping `reward` from these input types means no caller of these hooks CAN
// send it, not just that they're told not to:
// - create: nothing to clear, but there's no reward UI to source a value from anyway.
// - update: omitting the key is a no-op server-side; an explicit null/{type:'none'} would SILENTLY
//   CLEAR a reward configured on web. Never send the key at all.
type CreateCampaignInput = Omit<CreateCampaignData, "reward">;
type UpdateCampaignInput = Omit<UpdateCampaignData, "reward">;

function show4xxError(showError: (message: string) => void, error: any, fallback: string) {
  // 4xx only — the axios interceptor already toasts network errors, timeouts, and 5xx globally,
  // so surfacing those here too would double-toast.
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) {
    showError(error.response?.data?.error || error.message || fallback);
  }
}

function invalidateCampaignLists(queryClient: ReturnType<typeof useQueryClient>, shopId?: string) {
  if (!shopId) return;
  // Prefix invalidation — queryKeys.shopCampaigns(shopId, status) keys include the status filter,
  // so this must match every status variant (and the infinite-query variant) in one call.
  queryClient.invalidateQueries({ queryKey: [...queryKeys.shops(), "campaigns", shopId] });
  queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaignStats(shopId) });
}

export function useCreateCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateCampaignInput) => marketingApi.createCampaign(shopId as string, data),
    onSuccess: () => invalidateCampaignLists(queryClient, shopId),
    onError: (error: any) => show4xxError(showError, error, "Failed to create campaign."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (data: CreateCampaignInput, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(data, options));
    },
  };
}

export function useUpdateCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: UpdateCampaignInput }) =>
      marketingApi.updateCampaign(campaignId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaign(res.data.id) });
      invalidateCampaignLists(queryClient, shopId);
    },
    onError: (error: any) => show4xxError(showError, error, "Failed to update campaign."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      variables: { campaignId: string; data: UpdateCampaignInput },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}

export function useDeleteCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (campaignId: string) => marketingApi.deleteCampaign(campaignId),
    onSuccess: () => invalidateCampaignLists(queryClient, shopId),
    onError: (error: any) => show4xxError(showError, error, "Failed to delete campaign."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (campaignId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(campaignId, options));
    },
  };
}

/**
 * ≤ SEND_NOW_MAX_RECIPIENTS → this. Above it, the caller should use
 * useScheduleCampaignMutation at now+60s instead (see useCampaignComposer's threshold logic).
 */
export function useSendCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError, showWarning } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (campaignId: string) => marketingApi.sendCampaign(campaignId),
    onSuccess: (_res, campaignId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaign(campaignId) });
      invalidateCampaignLists(queryClient, shopId);
    },
    onError: (error: any, campaignId) => {
      // Sending is synchronous and unqueued server-side — a client timeout does NOT mean the send
      // failed, and the `sent` flip only happens after the whole loop finishes. Treating this as a
      // failure (or offering retry) would double-email every recipient reached so far.
      if (error?.code === "ECONNABORTED") {
        showWarning("Still sending — this can take a minute. We'll update the status when it's done.");
        queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaign(campaignId) });
        return;
      }
      show4xxError(showError, error, "Failed to send campaign.");
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (campaignId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(campaignId, options));
    },
  };
}

export function useScheduleCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ campaignId, scheduledAt }: { campaignId: string; scheduledAt: string }) =>
      marketingApi.scheduleCampaign(campaignId, scheduledAt),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaign(res.data.id) });
      invalidateCampaignLists(queryClient, shopId);
    },
    onError: (error: any) => show4xxError(showError, error, "Failed to schedule campaign."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      variables: { campaignId: string; scheduledAt: string },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}

export function useCancelCampaignMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (campaignId: string) => marketingApi.cancelCampaign(campaignId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopCampaign(res.data.id) });
      invalidateCampaignLists(queryClient, shopId);
    },
    onError: (error: any) => show4xxError(showError, error, "Failed to cancel campaign."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (campaignId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(campaignId, options));
    },
  };
}

