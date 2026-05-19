import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi } from "@/feature/services/services/service.services";
import {
  RescheduleRequest,
  RescheduleRequestStatus,
} from "@/feature/services/services/service.interface";
import { useAppToast } from "@/shared/hooks";

export function useRescheduleRequestsQuery(
  status?: RescheduleRequestStatus | "all",
  options?: { enabled?: boolean }
) {
  return useQuery<RescheduleRequest[]>({
    queryKey: ["repaircoin", "reschedule-requests", status || "all"],
    queryFn: () => serviceApi.getShopRescheduleRequests(status),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useRescheduleRequestCountQuery(
  options?: { enabled?: boolean }
) {
  return useQuery<number>({
    queryKey: ["repaircoin", "reschedule-requests", "count"],
    queryFn: () => serviceApi.getShopRescheduleRequestCount(),
    staleTime: 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useApproveRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return serviceApi.approveRescheduleRequest(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "reschedule-requests"],
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess(
        "The reschedule request has been approved. The appointment has been updated."
      );
    },
    onError: (error: any) => {
      console.error("Failed to approve reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to approve reschedule request. Please try again."
      );
    },
  });
}

export function useRejectRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason?: string;
    }) => {
      return serviceApi.rejectRescheduleRequest(requestId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "reschedule-requests"],
      });
      showSuccess(
        "The reschedule request has been rejected. The customer will be notified."
      );
    },
    onError: (error: any) => {
      console.error("Failed to reject reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to reject reschedule request. Please try again."
      );
    },
  });
}

export function useCreateRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      orderId,
      requestedDate,
      requestedTimeSlot,
      reason,
    }: {
      orderId: string;
      requestedDate: string;
      requestedTimeSlot: string;
      reason?: string;
    }) => {
      return serviceApi.createRescheduleRequest(
        orderId,
        requestedDate,
        requestedTimeSlot,
        reason
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      showSuccess(
        "Reschedule request sent. The shop will review it shortly."
      );
    },
    onError: (error: any) => {
      console.error("Failed to create reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to send reschedule request. Please try again."
      );
    },
  });
}

export function useCancelRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return serviceApi.cancelRescheduleRequest(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      showSuccess("Reschedule request cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to cancel reschedule request. Please try again."
      );
    },
  });
}
