import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi } from "@/shared/services/appointment.services";
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
