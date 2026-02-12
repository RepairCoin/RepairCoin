import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useShopBookingQuery, useCustomerBookingQuery } from "../hooks/queries";
import {
  useApproveOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
} from "../hooks/mutations";
import { getStatusColor } from "../utils";
import { BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { useAuthStore } from "@/shared/store/auth.store";

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const truncateAddress = (address: string) => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getStatusLabel = (status: BookingStatus, shopApproved?: boolean) => {
  switch (status) {
    case "pending":
      return "Pending Payment";
    case "paid":
      return shopApproved ? "Approved - In Progress" : "Paid - Awaiting Approval";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
};

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ icon, label, value, valueColor = "#fff" }: InfoRowProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-[#222]">
      <View className="w-8">{icon}</View>
      <Text className="text-gray-400 flex-1">{label}</Text>
      <Text className="font-medium" style={{ color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}

// Progress Stepper Component
const PROGRESS_STEPS = ["pending", "paid", "in_progress", "completed"] as const;
const STEP_LABELS: Record<string, string> = {
  pending: "Pending Payment",
  paid: "Payment Received",
  in_progress: "Approved",
  completed: "Completed",
};
const STEP_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  pending: "clock",
  paid: "credit-card",
  in_progress: "check",
  completed: "check-circle",
};
// Step colors - yellow for pending/paid, green for approved/completed
const STEP_COLORS: Record<string, string> = {
  pending: "#FFCC00",
  paid: "#FFCC00",
  in_progress: "#22c55e",
  completed: "#22c55e",
};

interface ProgressStepperProps {
  currentStatus: BookingStatus;
  shopApproved?: boolean;
}

function ProgressStepper({ currentStatus, shopApproved }: ProgressStepperProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Map booking status + approval to step index
  // pending (0) → paid (1) → approved (2) → completed (3)
  const getStepIndex = (): number => {
    if (currentStatus === "cancelled" || currentStatus === "refunded") {
      return -1;
    }
    if (currentStatus === "pending") {
      return 0;
    }
    if (currentStatus === "paid" && !shopApproved) {
      return 1;
    }
    if (currentStatus === "paid" && shopApproved) {
      return 2;
    }
    if (currentStatus === "completed") {
      return 3;
    }
    return 0;
  };

  const currentStepIndex = getStepIndex();
  const isCancelled =
    currentStatus === "cancelled" || currentStatus === "refunded";

  const getStepStatus = (
    stepIndex: number
  ): "completed" | "current" | "pending" => {
    if (isCancelled) {
      return stepIndex === 0 ? "completed" : "pending";
    }
    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return "current";
    return "pending";
  };

  const handleStepPress = (step: string) => {
    setActiveTooltip(activeTooltip === step ? null : step);
  };

  return (
    <View
      className="mx-4 bg-[#1a1a1a] rounded-xl p-4 mb-4"
      style={{ zIndex: 10, overflow: "visible" }}
    >
      {/* Header Container */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-400 text-xs uppercase tracking-wider">
          Booking Progress
        </Text>

        {/* Current Status Badge */}
        {(() => {
          const currentStep = PROGRESS_STEPS[currentStepIndex];
          const badgeColor = isCancelled ? "#ef4444" : STEP_COLORS[currentStep] || "#FFCC00";
          const badgeBgColor = isCancelled
            ? "rgba(239, 68, 68, 0.2)"
            : currentStep === "in_progress" || currentStep === "completed"
              ? "rgba(34, 197, 94, 0.2)"
              : "rgba(255, 204, 0, 0.2)";
          return (
            <View
              className="flex-row items-center px-2 py-1 rounded-full"
              style={{ backgroundColor: badgeBgColor }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: badgeColor,
                  marginRight: 6,
                }}
              />
              <Text
                className="text-xs font-medium"
                style={{ color: badgeColor }}
              >
                {isCancelled
                  ? currentStatus === "cancelled"
                    ? "Cancelled"
                    : "Refunded"
                  : STEP_LABELS[currentStep] || "Unknown"}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Progress Steps */}
      <View
        className="flex-row items-center justify-between pb-12"
        style={{ overflow: "visible" }}
      >
        {PROGRESS_STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === PROGRESS_STEPS.length - 1;
          const isActive = status === "completed" || status === "current";
          const showTooltip = activeTooltip === step;

          return (
            <View
              key={step}
              className={`flex-row items-center ${!isLast ? "flex-1" : ""}`}
            >
              {/* Step Icon with Tooltip */}
              <View className="items-center">
                {/* Icon Circle */}
                {(() => {
                  const stepColor = STEP_COLORS[step] || "#FFCC00";
                  const borderColor = step === "in_progress" || step === "completed"
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(255, 204, 0, 0.3)";
                  return (
                    <TouchableOpacity
                      onPress={() => handleStepPress(step)}
                      activeOpacity={0.7}
                      className="items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor:
                          status === "completed" || status === "current"
                            ? stepColor
                            : "#333",
                        borderWidth: status === "current" ? 3 : 0,
                        borderColor: borderColor,
                      }}
                    >
                      <Feather
                        name={STEP_ICONS[step]}
                        size={16}
                        color={isActive ? "#000" : "#666"}
                      />
                    </TouchableOpacity>
                  );
                })()}

                {/* Tooltip - Below Circle */}
                {showTooltip && (
                  <View
                    className="absolute items-center"
                    style={{
                      zIndex: 100,
                      top: 42,
                      left: -40,
                      width: 120,
                    }}
                  >
                    {/* Arrow pointing up */}
                    <View
                      style={{
                        width: 0,
                        height: 0,
                        borderLeftWidth: 6,
                        borderRightWidth: 6,
                        borderBottomWidth: 6,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderBottomColor: isActive ? STEP_COLORS[step] : "#444",
                      }}
                    />
                    <View
                      className="px-3 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: isActive ? STEP_COLORS[step] : "#444",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 5,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold text-center"
                        style={{ color: isActive ? "#000" : "#fff" }}
                      >
                        {STEP_LABELS[step]}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Connecting Line */}
              {!isLast && (
                <View
                  className="flex-1 mx-2"
                  style={{
                    height: 3,
                    backgroundColor:
                      getStepStatus(index + 1) === "completed" ||
                      status === "completed"
                        ? STEP_COLORS[PROGRESS_STEPS[index + 1]] || "#FFCC00"
                        : "#333",
                    borderRadius: 2,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userType } = useAuthStore();
  const isShopView = userType === "shop";

  // Use appropriate query based on user type - only enable the relevant query
  const shopBookingQuery = useShopBookingQuery(undefined, { enabled: isShopView });
  const customerBookingQuery = useCustomerBookingQuery(undefined, { enabled: !isShopView });

  const { data: bookings, isLoading, error } = isShopView
    ? shopBookingQuery
    : customerBookingQuery;

  const approveOrderMutation = useApproveOrderMutation();
  const completeOrderMutation = useCompleteOrderMutation();
  const cancelOrderMutation = useCancelOrderMutation();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const booking = useMemo(() => {
    if (!bookings || !id) return null;
    return bookings.find((b) => b.orderId === id);
  }, [bookings, id]);

  // Check if booking date has expired (past date with no completion)
  // Must be called before any early returns to maintain hook order
  const isBookingExpired = useMemo(() => {
    if (!booking?.bookingDate) return false;
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return bookingDate < now && booking.status === "paid";
  }, [booking?.bookingDate, booking?.status]);

  const handleApprove = () => {
    if (!booking) return;

    Alert.alert(
      "Approve Booking",
      "Are you sure you want to approve this booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => {
            approveOrderMutation.mutate(booking.orderId);
          },
        },
      ]
    );
  };

  const handleMarkComplete = () => {
    if (!booking) return;

    Alert.alert(
      "Mark as Complete",
      "Are you sure you want to mark this booking as complete? Customer will receive their RCN rewards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => {
            completeOrderMutation.mutate(booking.orderId);
          },
        },
      ]
    );
  };

  const handleCancelBooking = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (!booking) return;
    setShowCancelModal(false);
    cancelOrderMutation.mutate(booking.orderId);
  };

  const isActionLoading =
    approveOrderMutation.isPending ||
    completeOrderMutation.isPending ||
    cancelOrderMutation.isPending;

  if (isLoading) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-white text-lg font-semibold mt-4">
            Booking Not Found
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            The booking you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 bg-[#FFCC00] px-6 py-3 rounded-xl"
          >
            <Text className="text-black font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const isApproved = booking.shopApproved === true;
  // Use "approved" status color when paid and shop approved
  const effectiveStatus = booking.status === "paid" && isApproved ? "approved" : booking.status;
  const statusColor = getStatusColor(effectiveStatus);
  const bookingDateTime = booking.bookingDate || booking.createdAt;

  // Shop actions: pending or paid status
  const hasShopActions = isShopView && (booking.status === "pending" || booking.status === "paid");
  // Customer actions: paid/approved can cancel (if not expired), completed can review/book again
  const hasCustomerActions = !isShopView && (
    (booking.status === "paid" && !isBookingExpired) ||
    booking.status === "completed"
  );

  // Action buttons based on status and approval
  const renderActionButtons = () => {
    // Pending - waiting for payment
    if (booking.status === "pending") {
      return (
        <View className="space-y-3 gap-2">
          {/* Info Message */}
          <View className="flex-row items-start p-3 bg-[#1a1a1a] rounded-xl border border-yellow-800">
            <Ionicons name="information-circle" size={20} color="#eab308" />
            <Text className="text-yellow-400 text-sm ml-2 flex-1">
              Waiting for customer to complete payment.
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancelBooking}
            disabled={isActionLoading}
            className="py-4 rounded-xl items-center border border-red-700/50 bg-red-900/20"
          >
            <View className="flex-row items-center">
              <Feather name="x-circle" size={20} color="#ef4444" />
              <Text className="text-red-400 font-semibold text-base ml-2">
                Cancel Booking
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Paid but not approved - show Approve button
    if (booking.status === "paid" && !isApproved) {
      return (
        <View className="space-y-3">
          {/* Info Message */}
          <View className="flex-row items-start p-3 bg-[#1a1a1a] rounded-xl border border-blue-800">
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text className="text-blue-400 text-sm ml-2 flex-1">
              Payment received. Approve this booking to proceed with the
              service.
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancelBooking}
            disabled={isActionLoading}
            className="py-3 rounded-xl items-center border border-red-700/50"
          >
            <Text className="text-red-400 font-medium">Cancel Booking</Text>
          </TouchableOpacity>

          {/* Approve Button */}
          <TouchableOpacity
            onPress={handleApprove}
            disabled={isActionLoading}
            className="py-4 rounded-xl items-center bg-[#FFCC00]"
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View className="flex-row items-center">
                <Feather name="check" size={20} color="#000" />
                <Text className="text-black font-semibold text-base ml-2">
                  Approve Booking
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Paid and approved - show Mark Complete button
    if (booking.status === "paid" && isApproved) {
      return (
        <View className="space-y-3 gap-2">
          {/* Info Message */}
          <View className="flex-row items-start p-3 bg-[#1a1a1a] rounded-xl border border-green-800">
            <Ionicons name="information-circle" size={20} color="#22c55e" />
            <Text className="text-green-400 text-sm ml-2 flex-1">
              Booking approved. Mark as complete after the service is done to
              issue RCN rewards.
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancelBooking}
            disabled={isActionLoading}
            className="py-3 rounded-xl items-center border border-red-700/50"
          >
            <Text className="text-red-400 font-medium">Cancel Booking</Text>
          </TouchableOpacity>

          {/* Mark Complete Button */}
          <TouchableOpacity
            onPress={handleMarkComplete}
            disabled={isActionLoading}
            className="py-4 rounded-xl items-center"
            style={{ backgroundColor: "#22c55e" }}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View className="flex-row items-center">
                <Feather name="check-circle" size={20} color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">
                  Mark as Complete
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // Customer action buttons
  const renderCustomerActionButtons = () => {
    // Paid (not yet approved or approved) - show Cancel button
    if (booking.status === "paid") {
      return (
        <View className="space-y-3 gap-2">
          {/* Info Message */}
          <View className="flex-row items-start p-3 bg-[#1a1a1a] rounded-xl border border-blue-800">
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text className="text-blue-400 text-sm ml-2 flex-1">
              {isApproved
                ? "Your booking has been approved. The shop will complete the service soon."
                : "Payment received. Waiting for shop to approve your booking."}
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancelBooking}
            disabled={isActionLoading}
            className="py-4 rounded-xl items-center border border-red-700/50 bg-red-900/20"
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <View className="flex-row items-center">
                <Feather name="x-circle" size={20} color="#ef4444" />
                <Text className="text-red-400 font-semibold text-base ml-2">
                  Cancel Booking
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Completed - show Review and Book Again buttons
    if (booking.status === "completed") {
      return (
        <View className="space-y-3">
          {/* RCN Earned Info */}
          <View className="flex-row items-center p-3 bg-green-900/20 rounded-xl border border-green-700/50">
            <Feather name="check-circle" size={20} color="#22c55e" />
            <View className="ml-3 flex-1">
              <Text className="text-green-400 font-semibold">Service Completed</Text>
              <Text className="text-green-400/70 text-sm">
                You earned {booking.rcnEarned} RCN rewards!
              </Text>
            </View>
          </View>

          {/* Review Button */}
          <TouchableOpacity
            onPress={() => {
              if (booking.hasReview) return;
              const params = new URLSearchParams({
                serviceId: booking.serviceId || "",
                serviceName: booking.serviceName || "",
                shopName: booking.shopName || "",
              });
              router.push(`/customer/review/${booking.orderId}?${params.toString()}` as any);
            }}
            disabled={booking.hasReview}
            className={`py-4 rounded-xl mt-4 items-center ${booking.hasReview ? "bg-zinc-800" : "bg-[#FFCC00]"}`}
          >
            <View className="flex-row items-center">
              <Ionicons
                name={booking.hasReview ? "checkmark-circle" : "star"}
                size={20}
                color={booking.hasReview ? "#22c55e" : "#000"}
              />
              <Text className={`font-semibold text-base ml-2 ${booking.hasReview ? "text-green-500" : "text-black"}`}>
                {booking.hasReview ? "Already Reviewed" : "Write a Review"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Book Again Button */}
          <TouchableOpacity
            onPress={() => {
              router.push(`/customer/service/${booking.serviceId}` as any);
            }}
            className="py-4 rounded-xl items-center border border-[#FFCC00] mt-3"
          >
            <View className="flex-row items-center">
              <Feather name="refresh-cw" size={20} color="#FFCC00" />
              <Text className="text-[#FFCC00] font-semibold text-base ml-2">
                Book Again
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <ThemedView className="flex-1">
      <AppHeader title="Booking Details" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Service Image */}
        {booking.serviceImageUrl && (
          <View className="px-4 mb-4">
            <Image
              source={{ uri: booking.serviceImageUrl }}
              className="w-full h-48 rounded-xl"
              resizeMode="cover"
            />
          </View>
        )}

        {/* Progress Stepper */}
        <ProgressStepper currentStatus={booking.status} shopApproved={booking.shopApproved} />

        {/* Separator */}
        <View className="mx-4 mb-4 h-[1px] bg-[#333]" />

        {/* Service Info Card */}
        <View className="mx-4 mb-4">
          <Text className="text-[#FFCC00] text-2xl font-bold mb-2">
            {booking.serviceName}
          </Text>
          {booking.serviceDescription && (
            <Text className="text-gray-400 text-sm leading-5">
              {booking.serviceDescription}
            </Text>
          )}
        </View>

        {/* Separator */}
        <View className="mx-4 mb-4 h-[1px] bg-[#333]" />

        {/* Customer/Shop Info Card - conditional based on view type */}
        <View className="mx-4 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            {isShopView ? "Customer Information" : "Shop Information"}
          </Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-[#FFCC00]/20 items-center justify-center">
              <Feather name={isShopView ? "user" : "shopping-bag"} size={20} color="#FFCC00" />
            </View>
            <View className="ml-3 flex-1">
              {isShopView ? (
                <>
                  <Text className="text-white font-semibold">
                    {booking.customerName || "Anonymous Customer"}
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    {truncateAddress(booking.customerAddress)}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-semibold">
                    {booking.shopName || "Shop"}
                  </Text>
                  {booking.shopAddress && (
                    <Text className="text-gray-400 text-sm">
                      {booking.shopAddress}
                    </Text>
                  )}
                  {booking.shopPhone && (
                    <Text className="text-gray-400 text-sm mt-1">
                      <Feather name="phone" size={12} color="#999" /> {booking.shopPhone}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        {/* Separator */}
        <View className="mx-4 mb-4 h-[1px] bg-[#333]" />

        {/* Booking Details Card */}
        <View className="mx-4 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            Booking Details
          </Text>

          <InfoRow
            icon={<Feather name="calendar" size={16} color="#FFCC00" />}
            label="Date"
            value={formatDate(bookingDateTime)}
          />
          <InfoRow
            icon={<Feather name="clock" size={16} color="#FFCC00" />}
            label="Time"
            value={formatTime(bookingDateTime)}
          />
          <InfoRow
            icon={<Feather name="hash" size={16} color="#999" />}
            label="Booking ID"
            value={booking.orderId.slice(0, 8) + "..."}
          />
          <View className="flex-row items-center py-3">
            <View className="w-8">
              <Feather name="activity" size={16} color="#999" />
            </View>
            <Text className="text-gray-400 flex-1">Status</Text>
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: statusColor + "20" }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: statusColor }}
              >
                {getStatusLabel(booking.status, booking.shopApproved)}
              </Text>
            </View>
          </View>
          {booking.completedAt && (
            <InfoRow
              icon={<Feather name="check-circle" size={16} color="#22c55e" />}
              label="Completed"
              value={formatDate(booking.completedAt)}
              valueColor="#22c55e"
            />
          )}
        </View>

        {/* Separator */}
        <View className="mx-4 mb-4 h-[1px] bg-[#333]" />

        {/* Payment Info Card */}
        <View className="mx-4 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            Payment Details
          </Text>

          <InfoRow
            icon={<Feather name="dollar-sign" size={16} color="#FFCC00" />}
            label="Total Amount"
            value={`$${booking.totalAmount.toFixed(2)}`}
            valueColor="#FFCC00"
          />
          <InfoRow
            icon={<Text className="text-sm">🪙</Text>}
            label="RCN Earned"
            value={`${booking.rcnEarned} RCN`}
            valueColor="#FFCC00"
          />
          {booking.stripePaymentIntentId && (
            <View className="flex-row items-center py-3">
              <View className="w-8">
                <Feather name="credit-card" size={16} color="#999" />
              </View>
              <Text className="text-gray-400 flex-1">Payment Method</Text>
              <View className="flex-row items-center">
                <Ionicons name="card" size={16} color="#635bff" />
                <Text className="text-[#635bff] font-medium ml-1">Stripe</Text>
              </View>
            </View>
          )}
        </View>

        {/* Separator */}
        {booking.notes && (
          <View className="mx-4 mb-4">
            <View className="h-[1px] bg-[#333]" />
          </View>
        )}

        {/* Notes Card */}
        {booking.notes && (
          <View className="mx-4 mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
              Notes
            </Text>
            <Text className="text-white">{booking.notes}</Text>
          </View>
        )}

        {/* Action Buttons - Shop */}
        {hasShopActions && (
          <View className="mx-4 mb-8">{renderActionButtons()}</View>
        )}

        {/* Action Buttons - Customer */}
        {hasCustomerActions && (
          <View className="mx-4 mb-8">{renderCustomerActionButtons()}</View>
        )}

        {/* Completed State - Shop View Only (customers have action buttons) */}
        {booking.status === "completed" && isShopView && (
          <View className="mx-4 mb-8 p-4 bg-green-900/20 border border-green-700/50 rounded-xl">
            <View className="flex-row items-center">
              <Feather name="check-circle" size={24} color="#22c55e" />
              <View className="ml-3">
                <Text className="text-green-400 font-semibold">
                  Service Completed
                </Text>
                <Text className="text-green-400/70 text-sm">
                  RCN rewards have been issued to the customer.
                </Text>
              </View>
            </View>
          </View>
        )}

        {booking.status === "cancelled" && (
          <View className="mx-4 mb-8 p-4 bg-red-900/20 border border-red-700/50 rounded-xl">
            <View className="flex-row items-center">
              <Feather name="x-circle" size={24} color="#ef4444" />
              <View className="ml-3">
                <Text className="text-red-400 font-semibold">
                  Booking Cancelled
                </Text>
                <Text className="text-red-400/70 text-sm">
                  {isShopView
                    ? "This booking has been cancelled."
                    : "Your booking has been cancelled."}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Expired Booking - Customer View */}
        {!isShopView && isBookingExpired && (
          <View className="mx-4 mb-8 p-4 bg-orange-900/20 border border-orange-700/50 rounded-xl">
            <View className="flex-row items-center">
              <Feather name="alert-circle" size={24} color="#f97316" />
              <View className="ml-3 flex-1">
                <Text className="text-orange-400 font-semibold">
                  Booking Expired
                </Text>
                <Text className="text-orange-400/70 text-sm">
                  The scheduled date has passed. Please contact the shop for assistance.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-4">
          <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-red-900/30 items-center justify-center mb-3">
                <Feather name="alert-triangle" size={32} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold">
                Cancel Booking?
              </Text>
            </View>

            <Text className="text-gray-400 text-center mb-6">
              Are you sure you want to cancel this booking? This action cannot
              be undone.
            </Text>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700"
              >
                <Text className="text-gray-300 font-semibold text-center">
                  Keep Booking
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancel}
                disabled={cancelOrderMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-600"
              >
                {cancelOrderMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-center">
                    Yes, Cancel
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
