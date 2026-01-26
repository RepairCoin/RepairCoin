import { useState, useMemo, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useMyAppointmentsQuery, useCancelAppointmentMutation } from "@/shared/booking/useBooking";
import { MyAppointment } from "@/interfaces/appointment.interface";
import { BookingFilterTab, BookingStatusFilter } from "../../types";
import { getBookingDateRange, TIME_FILTERS, STATUS_FILTERS } from "../../constants";

// Check if appointment can be cancelled (24+ hours before + not already cancelled/completed)
export const canCancelAppointment = (appointment: MyAppointment) => {
  const now = new Date();
  const bookingDateTime = new Date(appointment.bookingDate);

  // If there's a time slot, include it in the calculation
  if (appointment.bookingTimeSlot) {
    const [hours, minutes] = appointment.bookingTimeSlot.split(":");
    bookingDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }

  // Calculate hours until appointment
  const hoursUntilAppointment = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const status = appointment.status.toLowerCase();
  const isCancellable = status === "pending" || status === "confirmed" || status === "paid";
  const isMoreThan24Hours = hoursUntilAppointment >= 24;

  return isCancellable && isMoreThan24Hours;
};

export function useBookingsTab() {
  const { startDate, endDate } = getBookingDateRange();

  const {
    data: appointmentData,
    isLoading,
    error,
    refetch,
  } = useMyAppointmentsQuery(startDate, endDate);

  const cancelMutation = useCancelAppointmentMutation();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<BookingFilterTab>("all");
  const [activeStatus, setActiveStatus] = useState<BookingStatusFilter>("all");
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<MyAppointment | null>(null);

  // Auto-switch to "all" time filter for completed/cancelled status
  useEffect(() => {
    if (activeStatus === "completed" || activeStatus === "cancelled" || activeStatus === "approved") {
      if (activeTab === "upcoming") {
        setActiveTab("all");
      }
    }
  }, [activeStatus, activeTab]);

  // Filter and sort appointments
  const filteredAppointments = useMemo(() => {
    if (!appointmentData) {
      return [];
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Helper to check if booking date has expired
    const isExpired = (apt: MyAppointment) => new Date(apt.bookingDate) < now;

    // Filter out expired pending bookings
    const validAppointments = appointmentData.filter((apt) => {
      const status = apt.status.toLowerCase();
      if (status === "pending" && isExpired(apt)) {
        return false;
      }
      return true;
    });

    const upcoming = validAppointments.filter(
      (apt) => new Date(apt.bookingDate) >= now
    );
    const past = validAppointments.filter(
      (apt) => new Date(apt.bookingDate) < now
    );

    // Sort upcoming by date ascending, past by date descending
    upcoming.sort(
      (a, b) =>
        new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );

    let filtered: MyAppointment[];
    switch (activeTab) {
      case "upcoming":
        filtered = upcoming;
        break;
      case "past":
        filtered = past;
        break;
      default:
        filtered = [...upcoming, ...past];
    }

    // Apply status filter
    if (activeStatus !== "all") {
      filtered = filtered.filter(
        (apt) => apt.status.toLowerCase() === activeStatus
      );
    }

    return filtered;
  }, [appointmentData, activeTab, activeStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAppointmentPress = useCallback((appointment: MyAppointment) => {
    router.push(`/customer/booking/${appointment.orderId}` as any);
  }, []);

  const handleCancelPress = useCallback((appointment: MyAppointment) => {
    setSelectedAppointment(appointment);
    setCancelModalVisible(true);
  }, []);

  const handleReviewPress = useCallback((appointment: MyAppointment) => {
    const params = new URLSearchParams({
      serviceId: appointment.serviceId || "",
      serviceName: appointment.serviceName || "",
      shopName: appointment.shopName || "",
    });
    router.push(`/customer/review/${appointment.orderId}?${params.toString()}` as any);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (!selectedAppointment) return;

    cancelMutation.mutate(selectedAppointment.orderId, {
      onSuccess: () => {
        setCancelModalVisible(false);
        setSelectedAppointment(null);
        Alert.alert("Success", "Your appointment has been cancelled.");
      },
      onError: (error: any) => {
        Alert.alert(
          "Error",
          error?.message || "Failed to cancel appointment. Please try again."
        );
      },
    });
  }, [selectedAppointment, cancelMutation]);

  const closeCancelModal = useCallback(() => {
    setCancelModalVisible(false);
    setSelectedAppointment(null);
  }, []);

  // Get current filter labels
  const currentTimeLabel = TIME_FILTERS.find(f => f.key === activeTab)?.label || "Upcoming";
  const currentStatusLabel = STATUS_FILTERS.find(f => f.key === activeStatus)?.label || "All Status";

  return {
    // Data
    filteredAppointments,
    isLoading,
    error,
    refreshing,

    // Time filter
    activeTab,
    setActiveTab,
    showTimeFilter,
    setShowTimeFilter,
    currentTimeLabel,

    // Status filter
    activeStatus,
    setActiveStatus,
    showStatusFilter,
    setShowStatusFilter,
    currentStatusLabel,

    // Cancel modal
    cancelModalVisible,
    selectedAppointment,
    closeCancelModal,
    handleConfirmCancel,
    isCancelPending: cancelMutation.isPending,

    // Actions
    handleRefresh,
    handleAppointmentPress,
    handleCancelPress,
    handleReviewPress,
    refetch,
  };
}
