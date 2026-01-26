import { bookingApi } from "@/shared/services/booking.services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import {
  BookingFilters,
  BookingFormData,
  BookingResponse,
} from "@/interfaces/booking.interfaces";
import { MyAppointment } from "@/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";
import { Alert, Linking } from "react-native";
import { usePaymentStore } from "@/shared/store/payment.store";

interface QueryOptions {
  enabled?: boolean;
}

// ============================================================================
// BOOKING QUERIES
// ============================================================================

export function useShopBookingQuery(filters?: BookingFilters, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.shopBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getShopBookings(filters);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds - refresh more frequently for booking status updates
    enabled: options?.enabled ?? true,
  });
}

export function useCustomerBookingQuery(filters?: BookingFilters, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.customerBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getCustomerBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useMyAppointmentsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.myAppointments(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getMyAppointments(startDate, endDate);
      return response.data as MyAppointment[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================================================
// BOOKING MUTATIONS
// ============================================================================

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

      // Store the session data so we can validate and confirm on success screen
      // This prevents stale navigation and enables payment confirmation
      usePaymentStore.getState().setActiveSession({
        type: "service_booking",
        orderId,
        sessionId,
        amount: response.data.amount,
        rcnRedeemed: response.data.rcnRedeemed,
      });

      // Open the Stripe checkout URL in the browser
      const checkoutUrl = response.data.checkoutUrl;
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          // Clear the session since we couldn't open the browser
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

export function useCancelAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return await appointmentApi.cancelAppointment(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
    },
  });
}

// ============================================================================
// LEGACY FACTORY PATTERN (for backward compatibility)
// ============================================================================

export function useBooking() {
  return {
    useShopBookingQuery: (filters?: BookingFilters) => useShopBookingQuery(filters),
    useCustomerBookingQuery: (filters?: BookingFilters) => useCustomerBookingQuery(filters),
    useCreateBookingMutation,
    useCreateStripeCheckoutMutation,
  };
}
