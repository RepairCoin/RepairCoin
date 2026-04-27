import { useMemo, useState, useCallback } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useShopBookingQuery, useCustomerBookingQuery } from "../../queries";
import {
  useApproveOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
  useCancelOrderByShopMutation,
  useMarkNoShowMutation,
  useRescheduleMutation,
  useCreateRescheduleRequestMutation,
} from "../../mutations";
import { getStatusColor } from "../../utils";
import { BookingData, BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { messageApi } from "@/feature/messages/services/message.services";

export function useBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userType } = useAuthStore();
  const isShopView = userType === "shop";

  // Queries
  const shopBookingQuery = useShopBookingQuery(undefined, { enabled: isShopView });
  const customerBookingQuery = useCustomerBookingQuery(undefined, { enabled: !isShopView });
  const { data: bookings, isLoading, error } = isShopView ? shopBookingQuery : customerBookingQuery;

  // Mutations
  const approveOrderMutation = useApproveOrderMutation();
  const completeOrderMutation = useCompleteOrderMutation();
  const cancelOrderMutation = useCancelOrderMutation();
  const cancelOrderByShopMutation = useCancelOrderByShopMutation();
  const markNoShowMutation = useMarkNoShowMutation();
  const rescheduleMutation = useRescheduleMutation();
  const createRescheduleRequestMutation = useCreateRescheduleRequestMutation();

  // Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCustomerRescheduleModal, setShowCustomerRescheduleModal] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);

  // Derived data
  const booking = useMemo(() => {
    if (!bookings || !id) return null;
    return bookings.find((b) => b.orderId === id);
  }, [bookings, id]);

  const isOrderExpired = useMemo(() => booking?.status === "expired", [booking?.status]);

  const isBookingExpired = useMemo(() => {
    if (!booking?.bookingDate) return false;
    if (booking.status === "expired") return true;
    if (booking.status !== "paid") return false;
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    const hoursSinceBooking = (now.getTime() - bookingDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceBooking >= 24;
  }, [booking?.bookingDate, booking?.status]);

  const imageSource = useMemo(
    () => (booking?.serviceImageUrl ? { uri: booking.serviceImageUrl } : null),
    [booking?.serviceImageUrl]
  );

  const isApproved = booking?.shopApproved === true;

  const effectiveStatus = booking
    ? booking.status === "expired"
      ? "expired"
      : booking.status === "paid" && isApproved
      ? "approved"
      : booking.status
    : "pending";

  const statusColor = getStatusColor(effectiveStatus);
  const bookingDateTime = booking?.bookingTimeSlot || booking?.bookingDate || booking?.createdAt || "";

  const isCancelledOrTerminal = booking
    ? ["cancelled", "expired", "no_show", "refunded"].includes(booking.status)
    : false;

  const hasShopActions = isShopView && booking && !isCancelledOrTerminal
    ? booking.status === "pending" || (booking.status === "paid" && !isBookingExpired)
    : false;

  const hasCustomerActions = !isShopView && booking && !isCancelledOrTerminal
    ? (booking.status === "paid" && !isBookingExpired) || booking.status === "completed"
    : false;

  const isActionLoading =
    approveOrderMutation.isPending ||
    completeOrderMutation.isPending ||
    cancelOrderMutation.isPending ||
    cancelOrderByShopMutation.isPending ||
    markNoShowMutation.isPending ||
    rescheduleMutation.isPending ||
    createRescheduleRequestMutation.isPending;

  // Handlers
  const handleMessageCustomer = useCallback(async (customerAddress: string) => {
    if (isMessaging) return;
    try {
      setIsMessaging(true);
      const response = await messageApi.getOrCreateConversation(customerAddress);
      if (response.success && response.data) {
        router.push(`/shop/messages/${response.data.conversationId}` as any);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to open conversation. Please try again.");
    } finally {
      setIsMessaging(false);
    }
  }, [isMessaging]);

  const handleApprove = useCallback(() => {
    if (!booking) return;
    Alert.alert("Approve Booking", "Are you sure you want to approve this booking?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveOrderMutation.mutate(booking.orderId) },
    ]);
  }, [booking, approveOrderMutation]);

  const handleMarkComplete = useCallback(() => {
    if (!booking) return;
    Alert.alert(
      "Mark as Complete",
      "Are you sure you want to mark this booking as complete? Customer will receive their RCN rewards.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: () => completeOrderMutation.mutate(booking.orderId) },
      ]
    );
  }, [booking, completeOrderMutation]);

  const handleCancelBooking = useCallback(() => {
    if (!booking) return;

    if (isShopView) {
      // Shop cancel — no reason required by shop-cancel endpoint
      setShowCancelModal(true);
      return;
    }

    // Customer cancel — show reason selection
    Alert.alert(
      "Cancel Booking",
      "Please select a reason for cancellation:",
      [
        { text: "Schedule Conflict", onPress: () => cancelOrderMutation.mutate({ orderId: booking.orderId, reason: "schedule_conflict" }) },
        { text: "Found Alternative", onPress: () => cancelOrderMutation.mutate({ orderId: booking.orderId, reason: "found_alternative" }) },
        { text: "Too Expensive", onPress: () => cancelOrderMutation.mutate({ orderId: booking.orderId, reason: "too_expensive" }) },
        { text: "Changed My Mind", onPress: () => cancelOrderMutation.mutate({ orderId: booking.orderId, reason: "changed_mind" }) },
        { text: "Other", onPress: () => cancelOrderMutation.mutate({ orderId: booking.orderId, reason: "other" }) },
        { text: "Back", style: "cancel" },
      ]
    );
  }, [booking, isShopView, cancelOrderMutation]);

  const confirmCancel = useCallback(() => {
    if (!booking) return;
    setShowCancelModal(false);
    if (isShopView) {
      cancelOrderByShopMutation.mutate({ orderId: booking.orderId });
    }
  }, [booking, isShopView, cancelOrderByShopMutation]);

  const handleMarkNoShow = useCallback((notes?: string) => {
    if (!booking) return;
    setShowNoShowModal(false);
    markNoShowMutation.mutate({ orderId: booking.orderId, notes });
  }, [booking, markNoShowMutation]);

  const handleReschedule = useCallback((newDate: string, newTimeSlot: string, reason?: string) => {
    if (!booking) return;
    setShowRescheduleModal(false);
    rescheduleMutation.mutate({ orderId: booking.orderId, newDate, newTimeSlot, reason });
  }, [booking, rescheduleMutation]);

  const handleCustomerRescheduleRequest = useCallback((newDate: string, newTimeSlot: string, reason?: string) => {
    if (!booking) return;
    setShowCustomerRescheduleModal(false);
    createRescheduleRequestMutation.mutate({
      orderId: booking.orderId,
      requestedDate: newDate,
      requestedTimeSlot: newTimeSlot,
      reason,
    });
  }, [booking, createRescheduleRequestMutation]);

  const handleWriteReview = useCallback(() => {
    if (!booking || booking.hasReview) return;
    const params = new URLSearchParams({
      serviceId: booking.serviceId || "",
      serviceName: booking.serviceName || "",
      shopName: booking.shopName || "",
    });
    router.push(`/customer/review/${booking.orderId}?${params.toString()}` as any);
  }, [booking]);

  const handleBookAgain = useCallback(() => {
    if (!booking) return;
    router.push(`/customer/service/${booking.serviceId}` as any);
  }, [booking]);

  return {
    // Data
    booking,
    isLoading,
    error,
    isShopView,
    isApproved,
    isOrderExpired,
    isBookingExpired,
    imageSource,
    statusColor,
    bookingDateTime,
    hasShopActions,
    hasCustomerActions,
    isActionLoading,
    isMessaging,

    // Modal state
    showCancelModal,
    setShowCancelModal,
    showNoShowModal,
    setShowNoShowModal,
    showRescheduleModal,
    setShowRescheduleModal,
    showCustomerRescheduleModal,
    setShowCustomerRescheduleModal,

    // Mutation loading states
    cancelIsPending: cancelOrderMutation.isPending || cancelOrderByShopMutation.isPending,
    noShowIsPending: markNoShowMutation.isPending,
    rescheduleIsPending: rescheduleMutation.isPending,
    customerRescheduleIsPending: createRescheduleRequestMutation.isPending,

    // Handlers
    handleMessageCustomer,
    handleApprove,
    handleMarkComplete,
    handleCancelBooking,
    confirmCancel,
    handleMarkNoShow,
    handleReschedule,
    handleCustomerRescheduleRequest,
    handleWriteReview,
    handleBookAgain,
  };
}
