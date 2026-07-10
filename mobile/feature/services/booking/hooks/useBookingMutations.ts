import { Linking } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "@/feature/services/services/service.services";
import { ManualBookingData } from "@/feature/services/services/service.interface";
import { usePaymentStore } from "@/feature/services/payment/store/payment.store";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import {
  BookingFormData,
  BookingResponse,
} from "@/feature/services/services/service.interface";

// ─── Booking Mutations ──────────────────────────────────────────────────────

export function useCreateBookingMutation() {
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response: BookingResponse =
        await serviceApi.createPaymentIntent(data);
      return response.data;
    },
  });
}

export function useCreateStripeCheckoutMutation() {
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      return serviceApi.createStripeCheckout(data);
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
      return serviceApi.approveOrder(orderId);
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
    mutationFn: async ({ orderId }: { orderId: string; customerAddress?: string }) => {
      return serviceApi.updateOrderStatus(orderId, "completed");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
      });
      if (variables.customerAddress) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerTransactions(variables.customerAddress),
        });
      }
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
      variables: { orderId: string; customerAddress?: string },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}

export function useCancelOrderMutation(options?: { suppressErrorToast?: boolean }) {
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
      return serviceApi.cancelOrder(orderId, reason, notes);
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
      // Callers that surface the error themselves (e.g. a native Alert for the
      // hard-stop 24-hour rule) pass suppressErrorToast to avoid a double toast.
      if (options?.suppressErrorToast) return;
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
      return serviceApi.cancelOrderByShop(
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
      return serviceApi.markOrderAsNoShow(orderId, notes);
    },
    onSuccess: () => {
      // Mirror cancelOrder's invalidation set. "shopBookings" is a separate cache
      // read by the bookings/calendar screen, and refetchType "all" is required
      // because that screen is unmounted (inactive) while the detail screen is
      // open — the global refetchOnMount:false would otherwise serve it stale.
      const refetchType = "all" as const;
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "shop"],
        refetchType,
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "bookings", "customer"],
        refetchType,
      });
      queryClient.invalidateQueries({
        queryKey: ["repaircoin", "appointments"],
        refetchType,
      });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"], refetchType });
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
      return await serviceApi.cancelAppointment(orderId);
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
      return serviceApi.directRescheduleOrder(
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
      return serviceApi.createManualBooking(shopId, bookingData);
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
