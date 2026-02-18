import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { appointmentApi, ManualBookingData } from "@/shared/services/appointment.services";

/**
 * Hook to create a manual booking (walk-in, phone booking)
 */
export function useManualBookingMutation() {
  const queryClient = useQueryClient();

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
    onSuccess: (data) => {
      // Invalidate bookings queries
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
      Alert.alert(
        "Booking Created",
        `Manual booking has been created successfully!`,
        [{ text: "OK" }]
      );
    },
    onError: (error: any) => {
      console.error("Failed to create manual booking:", error);
      const errorMessage = error.response?.data?.error || error.message || "";
      Alert.alert(
        "Error",
        errorMessage || "Failed to create manual booking. Please try again.",
        [{ text: "OK" }]
      );
    },
  });
}
