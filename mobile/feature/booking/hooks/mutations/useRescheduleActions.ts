import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { appointmentApi } from "@/shared/services/appointment.services";

/**
 * Hook to approve a reschedule request
 */
export function useApproveRescheduleRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return appointmentApi.approveRescheduleRequest(requestId);
    },
    onSuccess: () => {
      // Invalidate reschedule requests and bookings
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "reschedule-requests"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Approved",
        "The reschedule request has been approved. The appointment has been updated.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to approve reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      Alert.alert(
        "Error",
        errorMessage || "Failed to approve reschedule request. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}

/**
 * Hook to reject a reschedule request
 */
export function useRejectRescheduleRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      return appointmentApi.rejectRescheduleRequest(requestId, reason);
    },
    onSuccess: () => {
      // Invalidate reschedule requests
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "reschedule-requests"] });
      Alert.alert(
        "Rejected",
        "The reschedule request has been rejected. The customer will be notified.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to reject reschedule request:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      Alert.alert(
        "Error",
        errorMessage || "Failed to reject reschedule request. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}
