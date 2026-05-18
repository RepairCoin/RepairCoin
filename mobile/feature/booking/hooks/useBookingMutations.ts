import { Linking } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { bookingApi } from "../services/booking.services";
import {
  appointmentApi,
  ManualBookingData,
} from "@/feature/transaction/appointment/services/appointment.services";
import { usePaymentStore } from "../store/payment.store";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import {
  BookingFormData,
  BookingResponse,
} from "@/feature/booking/services/booking.interfaces";

// ─── Booking Mutations ──────────────────────────────────────────────────────

export function useCreateBookingMutation() {
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response: BookingResponse =
        await bookingApi.createPaymentIntent(data);
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
          showError(
            "Unable to open browser. Please try again or contact support."
          );
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
        showError(
          error.message || "Failed to initiate booking. Please try again."
        );
      }
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      data: BookingFormData,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(data, options));
    },
  };
}

// ─── Order Status Mutations ─────────────────────────────────────────────────

export function useApproveOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.approveOrder(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess("Booking approved! Mark it complete after service is done.");
    },
    onError: (error: any) => {
      console.error("Failed to approve order:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";

      if (errorMessage.includes("already approved")) {
        queryClient.invalidateQueries({
          queryKey: ["repaircoin", "bookings", "shop"],
        });
        showInfo("Booking already approved. You can mark it as complete.");
        return;
      }

      showError(
        errorMessage || "Failed to approve booking. Please try again."
      );
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      orderId: string,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(orderId, options));
    },
  };
}

export function useCompleteOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.updateOrderStatus(orderId, "completed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess("Booking complete! Customer will receive RCN rewards.");
    },
    onError: (error: any) => {
      console.error("Failed to complete order:", error);
      showError(
        error.message || "Failed to complete booking. Please try again."
      );
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      orderId: string,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(orderId, options));
    },
  };
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      notes,
    }: {
      orderId: string;
      reason: string;
      notes?: string;
    }) => {
      return bookingApi.cancelOrder(orderId, reason, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "appointments"],
      });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
      showSuccess("Booking has been cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel order:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to cancel booking.";
      showError(message);
    },
  });
}

export function useCancelOrderByShopMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }) => {
      return bookingApi.cancelOrderByShop(
        orderId,
        reason || "Cancelled by shop"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
      showSuccess("Booking cancelled. Full refund will be processed.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel order by shop:", error);
      showError(
        error.message || "Failed to cancel booking. Please try again."
      );
    },
  });
}

export function useMarkNoShowMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes?: string;
    }) => {
      return appointmentApi.markOrderAsNoShow(orderId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess("Marked as no-show. Customer's record updated.");
    },
    onError: (error: any) => {
      console.error("Failed to mark as no-show:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage || "Failed to mark as no-show. Please try again."
      );
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

// ─── Reschedule Mutations ───────────────────────────────────────────────────

export function useRescheduleMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

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
      return appointmentApi.directRescheduleOrder(
        orderId,
        newDate,
        newTimeSlot,
        reason
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess("Appointment rescheduled. Customer will be notified.");
    },
    onError: (error: any) => {
      console.error("Failed to reschedule:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to reschedule. Please try again.");
    },
  });
}

export function useApproveRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return appointmentApi.approveRescheduleRequest(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "reschedule-requests"],
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      showSuccess(
        "The reschedule request has been approved. The appointment has been updated."
      );
    },
    onError: (error: any) => {
      console.error("Failed to approve reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to approve reschedule request. Please try again."
      );
    },
  });
}

export function useRejectRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason?: string;
    }) => {
      return appointmentApi.rejectRescheduleRequest(requestId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "reschedule-requests"],
      });
      showSuccess(
        "The reschedule request has been rejected. The customer will be notified."
      );
    },
    onError: (error: any) => {
      console.error("Failed to reject reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to reject reschedule request. Please try again."
      );
    },
  });
}

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
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      showSuccess(
        "Reschedule request sent. The shop will review it shortly."
      );
    },
    onError: (error: any) => {
      console.error("Failed to create reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to send reschedule request. Please try again."
      );
    },
  });
}

export function useCancelRescheduleRequestMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      return appointmentApi.cancelRescheduleRequest(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
      });
      showSuccess("Reschedule request cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel reschedule request:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to cancel reschedule request. Please try again."
      );
    },
  });
}

// ─── Manual Booking Mutation ────────────────────────────────────────────────

export function useManualBookingMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      shopId,
      bookingData,
    }: {
      shopId: string;
      bookingData: ManualBookingData;
    }) => {
      return appointmentApi.createManualBooking(shopId, bookingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
      showSuccess("Manual booking has been created successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to create manual booking:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "";
      showError(
        errorMessage ||
          "Failed to create manual booking. Please try again."
      );
    },
  });
}
