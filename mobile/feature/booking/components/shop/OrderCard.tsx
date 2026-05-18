import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceOrderWithDetails, BookingStage } from "../../types";

const BOOKING_STAGES: BookingStage[] = [
  "requested",
  "paid",
  "approved",
  "scheduled",
  "completed",
];

function getBookingStage(order: ServiceOrderWithDetails): BookingStage {
  if (order.status === "completed") return "completed";
  if (order.shopApproved && order.bookingDate) return "scheduled";
  if (order.shopApproved) return "approved";
  if (order.status === "paid") return "paid";
  return "requested";
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString?: string): string {
  if (!timeString) return "-";
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function getStatusBadge(order: ServiceOrderWithDetails) {
  const needsApproval = order.status === "paid" && !order.shopApproved;

  if (needsApproval)
    return { label: "Needs Approval", bg: "bg-[#FFCC00]/20", text: "text-[#FFCC00]", icon: "time-outline" as const };
  if (order.status === "paid" && order.shopApproved)
    return { label: "Approved", bg: "bg-green-500/20", text: "text-green-400", icon: "checkmark-circle-outline" as const };
  if (order.status === "completed")
    return { label: "Completed", bg: "bg-blue-500/20", text: "text-blue-400", icon: "checkmark-circle-outline" as const };
  if (order.status === "cancelled")
    return { label: "Cancelled", bg: "bg-red-500/20", text: "text-red-400", icon: "close-circle-outline" as const };
  if (order.status === "no_show")
    return { label: "No-Show", bg: "bg-orange-500/20", text: "text-orange-400", icon: "alert-circle-outline" as const };
  if (order.status === "pending")
    return { label: "Pending", bg: "bg-purple-500/20", text: "text-purple-400", icon: "time-outline" as const };
  return { label: order.status, bg: "bg-gray-500/20", text: "text-gray-400", icon: "ellipse-outline" as const };
}

interface OrderCardProps {
  order: ServiceOrderWithDetails;
  onPress: () => void;
  onApprove: () => void;
  onMarkComplete: () => void;
  onMarkNoShow: () => void;
  isProcessing: boolean;
}

export default function OrderCard({
  order,
  onPress,
  onApprove,
  onMarkComplete,
  onMarkNoShow,
  isProcessing,
}: OrderCardProps) {
  const currentStage = getBookingStage(order);
  const currentIndex = BOOKING_STAGES.indexOf(currentStage);
  const badge = getStatusBadge(order);
  const needsApproval = order.status === "paid" && !order.shopApproved;
  const isApproved = order.status === "paid" && order.shopApproved;

  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1a1a1a] rounded-xl p-3 mb-3 border border-gray-800 active:border-[#FFCC00]/50"
    >
      {/* Header: Service + Status */}
      <View className="flex-row mb-2.5">
        <View className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 mr-3">
          {order.serviceImageUrl ? (
            <Image
              source={{ uri: order.serviceImageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Ionicons name="cube-outline" size={20} color="#4B5563" />
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {order.serviceName}
          </Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {order.customerName || "Customer"} •{" "}
            {order.customerAddress.slice(0, 6)}...
            {order.customerAddress.slice(-4)}
          </Text>
          <View className={`flex-row items-center self-start mt-1 px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Ionicons name={badge.icon} size={10} color={badge.text.includes("FFCC00") ? "#FFCC00" : badge.text.includes("green") ? "#4ADE80" : badge.text.includes("blue") ? "#60A5FA" : badge.text.includes("red") ? "#F87171" : badge.text.includes("orange") ? "#FB923C" : "#A78BFA"} />
            <Text className={`text-[10px] font-medium ml-1 ${badge.text}`}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Grid */}
      <View className="flex-row gap-1.5 mb-2.5">
        <View className="flex-1 bg-[#101010] rounded-lg p-1.5 items-center">
          <Text className="text-gray-500 text-[9px] uppercase">Booked</Text>
          <Text className="text-white text-[11px] font-medium">
            {formatDate(order.createdAt)}
          </Text>
        </View>
        <View className="flex-1 bg-[#101010] rounded-lg p-1.5 items-center">
          <Text className="text-gray-500 text-[9px] uppercase">Date</Text>
          <Text className="text-white text-[11px] font-medium">
            {formatDate(order.bookingDate)}
          </Text>
        </View>
        <View className="flex-1 bg-[#101010] rounded-lg p-1.5 items-center">
          <Text className="text-gray-500 text-[9px] uppercase">Time</Text>
          <Text className="text-white text-[11px] font-medium">
            {formatTime(order.bookingTime || order.bookingTimeSlot)}
          </Text>
        </View>
        <View className="flex-1 bg-[#101010] rounded-lg p-1.5 items-center">
          <Text className="text-gray-500 text-[9px] uppercase">Cost</Text>
          <Text className="text-white text-[11px] font-medium">
            ${order.totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="mb-2.5">
        <View className="flex-row justify-between mb-1">
          {BOOKING_STAGES.map((stage, index) => (
            <View key={stage} className="items-center">
              <View
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    index <= currentIndex
                      ? index === currentIndex
                        ? "#FFCC00"
                        : "#22C55E"
                      : "#4B5563",
                }}
              />
              <Text
                className={`text-[8px] mt-0.5 capitalize ${
                  index <= currentIndex ? "text-white" : "text-gray-600"
                }`}
              >
                {stage}
              </Text>
            </View>
          ))}
        </View>
        <View className="h-0.5 bg-gray-700 rounded-full">
          <View
            className="h-full rounded-full bg-[#FFCC00]"
            style={{
              width: `${(currentIndex / (BOOKING_STAGES.length - 1)) * 100}%`,
            }}
          />
        </View>
      </View>

      {/* Booking ID + Actions */}
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-500 text-xs">
          ID:{" "}
          <Text className="text-white font-mono">
            BK-{order.orderId.slice(0, 6).toUpperCase()}
          </Text>
        </Text>

        {needsApproval && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onApprove();
            }}
            disabled={isProcessing}
            className="flex-row items-center bg-[#FFCC00] px-3 py-1.5 rounded-lg"
            style={{ opacity: isProcessing ? 0.5 : 1 }}
          >
            <Ionicons name="checkmark-circle-outline" size={12} color="#000" />
            <Text className="text-black text-xs font-medium ml-1">Approve</Text>
          </Pressable>
        )}

        {isApproved && (
          <View className="flex-row gap-2">
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onMarkNoShow();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-orange-400/50"
            >
              <Text className="text-orange-400 text-xs font-medium">
                No-Show
              </Text>
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onMarkComplete();
              }}
              disabled={isProcessing}
              className="flex-row items-center bg-green-500 px-3 py-1.5 rounded-lg"
              style={{ opacity: isProcessing ? 0.5 : 1 }}
            >
              <Ionicons name="checkmark-circle-outline" size={12} color="#000" />
              <Text className="text-black text-xs font-medium ml-1">
                Complete
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}
