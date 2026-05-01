import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../../services/booking.services";
import { appointmentApi } from "@/feature/transaction/appointment/services/appointment.services";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";

export function useApproveOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (orderId: string) => {
      return bookingApi.approveOrder(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Booking approved! Mark it complete after service is done.");
    },
    onError: (error: any) => {
      console.error("Failed to approve order:", error);
      const errorMessage = error.response?.data?.error || error.message || "";

      if (errorMessage.includes("already approved")) {
        queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
        showInfo("Booking already approved. You can mark it as complete.");
        return;
      }

      showError(errorMessage || "Failed to approve booking. Please try again.");
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (orderId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
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
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Booking complete! Customer will receive RCN rewards.");
    },
    onError: (error: any) => {
      console.error("Failed to complete order:", error);
      showError(error.message || "Failed to complete booking. Please try again.");
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (orderId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(orderId, options));
    },
  };
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ orderId, reason, notes }: { orderId: string; reason: string; notes?: string }) => {
      return bookingApi.cancelOrder(orderId, reason, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
      showSuccess("Booking has been cancelled.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel order:", error);
      const message = error.response?.data?.error || error.message || "Failed to cancel booking.";
      showError(message);
    },
  });
}

export function useCancelOrderByShopMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return bookingApi.cancelOrderByShop(orderId, reason || "Cancelled by shop");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });
      queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
      showSuccess("Booking cancelled. Full refund will be processed.");
    },
    onError: (error: any) => {
      console.error("Failed to cancel order by shop:", error);
      showError(error.message || "Failed to cancel booking. Please try again.");
    },
  });
}

export function useMarkNoShowMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes?: string }) => {
      return appointmentApi.markOrderAsNoShow(orderId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Marked as no-show. Customer's record updated.");
    },
    onError: (error: any) => {
      console.error("Failed to mark as no-show:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to mark as no-show. Please try again.");
    },
  });
}

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
      return appointmentApi.directRescheduleOrder(orderId, newDate, newTimeSlot, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Appointment rescheduled. Customer will be notified.");
    },
    onError: (error: any) => {
      console.error("Failed to reschedule:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to reschedule. Please try again.");
    },
  });
}
