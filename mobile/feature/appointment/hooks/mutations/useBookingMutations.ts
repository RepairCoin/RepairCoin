import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Linking } from "react-native";
import { BookingFormData, BookingResponse } from "@/shared/interfaces/booking.interfaces";
import { usePaymentStore } from "@/shared/store/payment.store";
import { bookingApi } from "@/shared/services/booking.services";
import { queryKeys } from "@/shared/config/queryClient";

export function useCreateBookingMutation() {
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response: BookingResponse = await bookingApi.createPaymentIntent(data);
      return response.data;
    },
  });
}

export function useCreateStripeCheckoutMutation() {
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      return bookingApi.createStripeCheckout(data);
    },
    onSuccess: async (response) => {
      const orderId = response.data.orderId;
      const sessionId = response.data.sessionId;

      usePaymentStore.getState().setActiveSession({
        type: "service_booking",
        orderId,
        sessionId,
        amount: response.data.amount,
        rcnRedeemed: response.data.rcnRedeemed,
      });

      const checkoutUrl = response.data.checkoutUrl;
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          usePaymentStore.getState().clearSession();
          Alert.alert(
            "Unable to Open Browser",
            "Please try again or contact support.",
            [{ text: "OK" }]
          );
        }
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe checkout:", error);

      if (error.response?.status === 401) {
        Alert.alert(
          "Authentication Required",
          "Please log in again to continue with your booking.",
          [{ text: "OK" }]
        );
      } else if (error.response?.status === 400) {
        Alert.alert(
          "Booking Failed",
          error.response?.data?.error || "Invalid booking request",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Booking Failed",
          error.message || "Failed to initiate booking. Please try again.",
          [{ text: "OK" }]
        );
      }
    },
  });
}

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
