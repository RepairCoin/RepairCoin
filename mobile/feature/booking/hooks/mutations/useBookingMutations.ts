import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { bookingApi } from "@/shared/services/booking.services";
import { appointmentApi } from "@/shared/services/appointment.services";

export function useApproveOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.approveOrder(orderId);
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Success",
        "Booking has been approved! You can now mark it as complete after the service is done.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to approve order:", error);
      const errorMessage = error.response?.data?.error || error.message || "";

      // If already approved, just refresh the data silently
      if (errorMessage.includes("already approved")) {
        // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
        Alert.alert(
          "Info",
          "This booking has already been approved. You can now mark it as complete.",
          [{ text: "OK" }]
        );
        return;
      }

      Alert.alert(
        "Error",
        errorMessage || "Failed to approve booking. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}

export function useCompleteOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.updateOrderStatus(orderId, "completed");
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Success",
        "Booking marked as complete! Customer will receive their RCN rewards.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to complete order:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to complete booking. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.cancelOrder(orderId);
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert("Success", "Booking has been cancelled.", [{ text: "OK" }]);
    },
    onError: (error: any) => {
      console.error("Failed to cancel order:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to cancel booking. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}

export function useMarkNoShowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes?: string }) => {
      return appointmentApi.markOrderAsNoShow(orderId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Marked as No-Show",
        "The booking has been marked as a no-show. The customer's record has been updated.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to mark as no-show:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      Alert.alert(
        "Error",
        errorMessage || "Failed to mark booking as no-show. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}

export function useRescheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      newDate,
      newTimeSlot,
      reason,
    }: {
      orderId: string;
      newDate: string;
      newTimeSlot: string;
      reason?: string;
    }) => {
      return appointmentApi.directRescheduleOrder(orderId, newDate, newTimeSlot, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Rescheduled",
        "The appointment has been rescheduled successfully. The customer will be notified.",
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to reschedule:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      Alert.alert(
        "Error",
        errorMessage || "Failed to reschedule appointment. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}
