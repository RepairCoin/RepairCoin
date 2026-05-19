import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi } from "@/feature/services/services/service.services";
import { useAppToast } from "@/shared/hooks";

export function useShopDisputesQuery(shopId: string, filter?: string) {
  return useQuery({
    queryKey: ["shopDisputes", shopId, filter],
    queryFn: () => serviceApi.getShopDisputes(shopId, filter),
    enabled: !!shopId,
    staleTime: 60 * 1000,
  });
}

export function useApproveDisputeMutation(shopId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: ({ disputeId, notes }: { disputeId: string; notes?: string }) =>
      serviceApi.approveDispute(shopId, disputeId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopDisputes"] });
      showSuccess("Dispute approved. No-show penalty reversed.");
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || "Failed to approve dispute");
    },
  });
}

export function useRejectDisputeMutation(shopId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: ({ disputeId, reason }: { disputeId: string; reason: string }) =>
      serviceApi.rejectDispute(shopId, disputeId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopDisputes"] });
      showSuccess("Dispute rejected.");
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || "Failed to reject dispute");
    },
  });
}
