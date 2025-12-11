import { bookingApi } from "@/services/booking.services";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import {
  BookingFilters,
  BookingFormData,
  BookingResponse,
} from "@/interfaces/booking.interfaces";
import { Alert, Linking } from "react-native";
import { useBookingStore } from "@/store/booking.store";

export function useBooking() {
  const useShopBookingQuery = (filters?: BookingFilters) => {
    return useQuery({
      queryKey: queryKeys.bookings(filters),
      queryFn: async () => {
        const response: BookingResponse =
          await bookingApi.getShopBookings(filters);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useCustomerBookingQuery = (filters?: BookingFilters) => {
    return useQuery({
      queryKey: queryKeys.bookings(filters),
      queryFn: async () => {
        const response: BookingResponse =
          await bookingApi.getCustomerBookings(filters);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useCreateBookingMutation = () => {
    return useMutation({
      mutationFn: async (data: BookingFormData) => {
        const response: BookingResponse =
          await bookingApi.createPaymentIntent(data);
        return response.data;
      },
    });
  };

  // Hook for creating Stripe Checkout session (web-based payment to avoid Apple IAP fees)
  const useCreateStripeCheckoutMutation = () => {
    return useMutation({
      mutationFn: async (data: BookingFormData) => {
        return bookingApi.createStripeCheckout(data);
      },
      onSuccess: async (response) => {
        const orderId = response.data.orderId;
        const sessionId = response.data.sessionId;
        console.log("Stripe checkout session created for booking:", { orderId, sessionId });

        // Store the order_id and session_id so we can validate and confirm on success screen
        // This prevents stale navigation and enables payment confirmation
        useBookingStore.getState().setActiveCheckout(orderId, sessionId);

        // Open the Stripe checkout URL in the browser
        const checkoutUrl = response.data.checkoutUrl;
        if (checkoutUrl) {
          const canOpen = await Linking.canOpenURL(checkoutUrl);
          if (canOpen) {
            await Linking.openURL(checkoutUrl);
          } else {
            // Clear the session since we couldn't open the browser
            useBookingStore.getState().clearSession();
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
  };

  return {
    useShopBookingQuery,
    useCustomerBookingQuery,
    useCreateBookingMutation,
    useCreateStripeCheckoutMutation,
  };
}
