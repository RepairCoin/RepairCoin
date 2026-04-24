import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Linking } from "react-native";
import { BookingFormData, BookingResponse } from "@/shared/interfaces/booking.interfaces";
import { usePaymentStore } from "@/feature/booking/store/payment.store";
import { bookingApi } from "@/feature/booking/services/booking.services";
import { useAppToast } from "@/shared/hooks";
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
  const { showError } = useAppToast();

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
  });
}

export function useApproveOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useAppToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.approveOrder(orderId);
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Booking has been approved! You can now mark it as complete after the service is done.");
    },
    onError: (error: any) => {
      console.error("Failed to approve order:", error);
      const errorMessage = error.response?.data?.error || error.message || "";

      // If already approved, just refresh the data silently
      if (errorMessage.includes("already approved")) {
        // Invalidate all shop bookings queries (with any filters)
        queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
        showInfo("This booking has already been approved. You can now mark it as complete.");
        return;
      }

      showError(errorMessage || "Failed to approve booking. Please try again.");
    },
  });
}

export function useCompleteOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.updateOrderStatus(orderId, "completed");
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Booking marked as complete! Customer will receive their RCN rewards.");
    },
    onError: (error: any) => {
      console.error("Failed to complete order:", error);
      showError(error.message || "Failed to complete booking. Please try again.");
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.cancelOrder(orderId);
    },
    onSuccess: () => {
      // Invalidate all shop bookings queries (with any filters)
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Booking has been cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel order:", error);
      showError(error.message || "Failed to cancel booking. Please try again.");
    },
  });
}
