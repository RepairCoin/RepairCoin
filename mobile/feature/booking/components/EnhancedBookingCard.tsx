import { View, Text, TouchableOpacity, Alert, Image } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { BookingData } from "@/shared/interfaces/booking.interfaces";
import { router } from "expo-router";
import { getBookingStatusColor } from "@/shared/constants/booking-colors";

const getDisplayStatus = (booking: BookingData): string => {
  if (booking.status === "expired") return "expired";
  if (booking.status === "paid" && booking.shopApproved) return "approved";
  return booking.status;
};

const getDisplayStatusColor = (booking: BookingData): string => {
  if (booking.status === "paid" && booking.shopApproved) {
    return getBookingStatusColor("approved");
  }
  return getBookingStatusColor(booking.status);
};

const getStatusIcon = (
  booking: BookingData,
): keyof typeof Ionicons.glyphMap => {
  const status = getDisplayStatus(booking);
  switch (status) {
    case "approved":
      return "checkmark-circle-outline";
    case "completed":
      return "checkmark-done-circle-outline";
    case "paid":
      return "time-outline";
    case "cancelled":
      return "close-circle-outline";
    case "expired":
      return "alert-circle-outline";
    default:
      return "ellipse-outline";
  }
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface EnhancedBookingCardProps {
  booking: BookingData;
  showDate?: boolean;
  onApprove?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
  onNoShow?: (orderId: string) => void;
  isProcessing?: boolean;
}

export default function EnhancedBookingCard({
  booking,
  showDate = true,
  onApprove,
  onComplete,
  onNoShow,
  isProcessing = false,
}: EnhancedBookingCardProps) {
  const statusColor = getDisplayStatusColor(booking);
  const displayStatus = getDisplayStatus(booking);
  const needsApproval = booking.status === "paid" && !booking.shopApproved;
  const isApproved = booking.status === "paid" && booking.shopApproved;
  const bookingId = `BK-${booking.orderId.slice(0, 6).toUpperCase()}`;

  const handleApprove = () => {
    if (!onApprove) return;
    Alert.alert("Approve Booking", "Approve this booking request?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => onApprove(booking.orderId) },
    ]);
  };

  const handleComplete = () => {
    if (!onComplete) return;
    Alert.alert(
      "Complete Order",
      "Mark this service as completed? The customer will receive their RCN rewards.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: () => onComplete(booking.orderId) },
      ],
    );
  };

  const handleNoShow = () => {
    if (!onNoShow) return;
    Alert.alert("Mark No-Show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "No-Show",
        style: "destructive",
        onPress: () => onNoShow(booking.orderId),
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shop/booking/${booking.orderId}`)}
      activeOpacity={0.7}
      className="bg-[#1a1a1a] rounded-xl mb-3 overflow-hidden"
    >
      {/* Color accent bar */}
      <View className="h-1" style={{ backgroundColor: statusColor }} />

      <View className="p-4">
        {/* Header: Image + Service name + Status badge */}
        <View className="flex-row items-start mb-2">
          {/* Service Image */}
          <View className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 mr-3">
            {booking.serviceImageUrl ? (
              <Image
                source={{ uri: booking.serviceImageUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Ionicons name="cube-outline" size={20} color="#4B5563" />
              </View>
            )}
          </View>

          {/* Service name + ID */}
          <View className="flex-1 mr-3">
            <Text className="text-white font-bold text-base" numberOfLines={1}>
              {booking.serviceName}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5 font-mono">
              {bookingId}
            </Text>
          </View>

          {/* Status badge */}
          <View
            className="flex-row items-center px-2.5 py-1 rounded-full"
            style={{ backgroundColor: statusColor + "20" }}
          >
            <Ionicons
              name={getStatusIcon(booking)}
              size={12}
              color={statusColor}
            />
            <Text
              className="text-xs font-semibold capitalize ml-1"
              style={{ color: statusColor }}
            >
              {displayStatus}
            </Text>
          </View>
        </View>

        {/* Info grid */}
        <View className="flex-row gap-2 mb-3">
          {showDate && (
            <View className="flex-1 bg-[#111] rounded-lg p-2.5">
              <View className="flex-row items-center mb-1">
                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                <Text className="text-gray-500 text-[10px] ml-1 uppercase">
                  Date
                </Text>
              </View>
              <Text className="text-white text-xs font-medium">
                {formatDate(booking.bookingTimeSlot || booking.bookingDate || booking.createdAt)}
              </Text>
            </View>
          )}
          <View className="flex-1 bg-[#111] rounded-lg p-2.5">
            <View className="flex-row items-center mb-1">
              <Ionicons name="time-outline" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] ml-1 uppercase">
                Time
              </Text>
            </View>
            <Text className="text-[#FFCC00] text-xs font-semibold">
              {formatTime(booking.bookingTimeSlot || booking.bookingDate || booking.createdAt)}
            </Text>
          </View>
          <View className="flex-1 bg-[#111] rounded-lg p-2.5">
            <View className="flex-row items-center mb-1">
              <Ionicons name="wallet-outline" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] ml-1 uppercase">
                Amount
              </Text>
            </View>
            <Text className="text-white text-xs font-semibold">
              ${booking.totalAmount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Customer info */}
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-full bg-gray-800 items-center justify-center mr-2">
            <Feather name="user" size={14} color="#9CA3AF" />
          </View>
          <Text className="text-gray-300 text-sm" numberOfLines={1}>
            {booking.customerName ||
              `${booking.customerAddress.slice(0, 6)}...${booking.customerAddress.slice(-4)}`}
          </Text>
        </View>

        {/* Action buttons */}
        {needsApproval && onApprove && (
          <View className="flex-row gap-2 pt-2 border-t border-gray-800">
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                handleApprove();
              }}
              disabled={isProcessing}
              className="flex-1 flex-row items-center justify-center bg-[#FFCC00] py-2.5 rounded-lg"
              style={{ opacity: isProcessing ? 0.5 : 1 }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#000"
              />
              <Text className="text-black text-sm font-semibold ml-1.5">
                Approve
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isApproved && (onComplete || onNoShow) && (
          <View className="flex-row gap-2 pt-2 border-t border-gray-800">
            {onNoShow && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleNoShow();
                }}
                className="flex-1 py-2.5 rounded-lg border border-orange-500/50 items-center"
              >
                <Text className="text-orange-400 text-sm font-medium">
                  No-Show
                </Text>
              </TouchableOpacity>
            )}
            {onComplete && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleComplete();
                }}
                disabled={isProcessing}
                className="flex-1 flex-row items-center justify-center bg-green-500 py-2.5 rounded-lg"
                style={{ opacity: isProcessing ? 0.5 : 1 }}
              >
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={16}
                  color="#000"
                />
                <Text className="text-black text-sm font-semibold ml-1.5">
                  Complete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
