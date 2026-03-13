import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi, ManualBookingData } from "@/shared/services/appointment.services";
import { useAppToast } from "@/shared/hooks";

/**
 * Hook to create a manual booking (walk-in, phone booking)
 */
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
      // Invalidate bookings queries
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      showSuccess("Manual booking has been created successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to create manual booking:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      showError(errorMessage || "Failed to create manual booking. Please try again.");
    },
  });
}
