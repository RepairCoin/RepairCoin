import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi } from "@/feature/transaction/appointment/services/appointment.services";
import { useAppToast } from "@/shared/hooks";

/**
 * Hook to approve a reschedule request
 */
export function useApproveRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return appointmentApi.approveRescheduleRequest(requestId);
    },
    onSuccess: () => {
      // Invalidate reschedule requests and bookings
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "reschedule-requests"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("The reschedule request has been approved. The appointment has been updated.");
    },
    onError: (error: any) => {
      console.error("Failed to approve reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to approve reschedule request. Please try again.");
    },
  });
}

/**
 * Hook to reject a reschedule request
 */
/**
 * Hook for customer to request a reschedule
 */
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
      return appointmentApi.createRescheduleRequest(
        orderId,
        requestedDate,
        requestedTimeSlot,
        reason
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });
      showSuccess("Reschedule request sent. The shop will review it shortly.");
    },
    onError: (error: any) => {
      console.error("Failed to create reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to send reschedule request. Please try again.");
    },
  });
}

/**
 * Hook for customer to cancel their pending reschedule request
 */
export function useCancelRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return appointmentApi.cancelRescheduleRequest(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });
      showSuccess("Reschedule request cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to cancel reschedule request. Please try again.");
    },
  });
}

export function useRejectRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      return appointmentApi.rejectRescheduleRequest(requestId, reason);
    },
    onSuccess: () => {
      // Invalidate reschedule requests
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "reschedule-requests"] });
      showSuccess("The reschedule request has been rejected. The customer will be notified.");
    },
    onError: (error: any) => {
      console.error("Failed to reject reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to reject reschedule request. Please try again.");
    },
  });
}
