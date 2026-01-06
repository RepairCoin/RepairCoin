import { useMutation } from "@tanstack/react-query";
import { Alert, Linking } from "react-native";
import { BookingFormData, BookingResponse } from "@/interfaces/booking.interfaces";
import { usePaymentStore } from "@/store/payment.store";
import { bookingApi } from "@/services/booking.services";

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
