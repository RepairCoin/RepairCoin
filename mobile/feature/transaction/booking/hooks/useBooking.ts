import { bookingApi } from "../services/booking.services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import {
  BookingFilters,
  BookingFormData,
  BookingResponse,
} from "@/shared/interfaces/booking.interfaces";
import { MyAppointment } from "@/shared/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/transaction/appointment/services/appointment.services";
import { Linking } from "react-native";
import { usePaymentStore } from "../store/payment.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";

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
      return await appointmentApi.getMyAppointments(startDate, endDate) as MyAppointment[];
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
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
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
          showError("Unable to open browser. Please try again or contact support.");
        }
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe checkout:", error);

      if (error.response?.status === 401) {
        showError("Please log in again to continue with your booking.");
      } else if (error.response?.status === 400) {
        showError(error.response?.data?.error || "Invalid booking request");
      } else {
        showError(error.message || "Failed to initiate booking. Please try again.");
      }
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (data: BookingFormData, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(data, options));
    },
  };
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
