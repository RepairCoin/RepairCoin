import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceOrderWithDetails, BookingStage } from "../../types";
import * as Clipboard from "expo-clipboard";

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
    year: "numeric",
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

function getTierColor(tier?: string) {
  switch (tier?.toLowerCase()) {
    case "gold":
      return "#FFCC00";
    case "silver":
      return "#9CA3AF";
    case "bronze":
      return "#F97316";
    default:
      return "#6B7280";
  }
}

interface OrderDetailModalProps {
  visible: boolean;
  order: ServiceOrderWithDetails | null;
  onClose: () => void;
}

type DetailTab = "overview" | "timeline";

export default function OrderDetailModal({
  visible,
  order,
  onClose,
}: OrderDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  if (!order) return null;

  const currentStage = getBookingStage(order);
  const currentIndex = BOOKING_STAGES.indexOf(currentStage);

  const copyAddress = async () => {
    await Clipboard.setStringAsync(order.customerAddress);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#0D0D0D]">
        {/* Header */}
        <View className="pt-14 px-4 pb-3 border-b border-gray-800">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold font-mono">
              BK-{order.orderId.slice(0, 6).toUpperCase()}
            </Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Progress Bar */}
          <View className="mb-3">
            <View className="flex-row justify-between mb-1.5">
              {BOOKING_STAGES.map((stage, index) => {
                const isActive = index <= currentIndex;
                const isCurrent = index === currentIndex;
                return (
                  <View key={stage} className="items-center">
                    <View
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: isActive
                          ? isCurrent
                            ? "#FFCC00"
                            : "#22C55E"
                          : "#4B5563",
                      }}
                    />
                    <Text
                      className={`text-[9px] mt-0.5 capitalize ${
                        isActive ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {stage}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View className="h-1 bg-gray-700 rounded-full">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${(currentIndex / (BOOKING_STAGES.length - 1)) * 100}%`,
                  backgroundColor: "#FFCC00",
                }}
              />
            </View>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-4">
            {(["overview", "timeline"] as const).map((tab) => (
              <Pressable key={tab} onPress={() => setActiveTab(tab)}>
                <Text
                  className={`text-sm font-medium capitalize pb-2 ${
                    activeTab === tab ? "text-white" : "text-gray-500"
                  }`}
                >
                  {tab}
                </Text>
                {activeTab === tab && (
                  <View className="h-0.5 bg-[#FFCC00] rounded-full" />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "overview" && (
            <View className="gap-4">
              {/* Service Info */}
              <View className="bg-[#1a1a1a] rounded-xl p-3 flex-row">
                <View className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 mr-3">
                  {order.serviceImageUrl ? (
                    <Image
                      source={{ uri: order.serviceImageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Ionicons name="cube-outline" size={24} color="#4B5563" />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">
                    {order.serviceName}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {order.serviceCategory || "Service"}
                  </Text>
                  <View className="flex-row gap-2 mt-1">
                    {(order.rcnEarned ?? 0) > 0 && (
                      <View className="bg-[#FFCC00]/20 px-2 py-0.5 rounded-full">
                        <Text className="text-[#FFCC00] text-[10px]">
                          +{order.rcnEarned} RCN
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Customer Details */}
              <View className="bg-[#1a1a1a] rounded-xl p-3">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="person-outline" size={16} color="#9CA3AF" />
                  <Text className="text-white text-sm font-semibold ml-2">
                    Customer Details
                  </Text>
                </View>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white text-sm">
                        {order.customerName || "Customer"}
                      </Text>
                      {order.customerTier && (
                        <View
                          className="px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: getTierColor(order.customerTier) + "4D",
                            backgroundColor: getTierColor(order.customerTier) + "1A",
                          }}
                        >
                          <Text
                            className="text-[9px] uppercase font-medium"
                            style={{ color: getTierColor(order.customerTier) }}
                          >
                            {order.customerTier}
                          </Text>
                        </View>
                      )}
                    </View>
                    {order.customerPhone && (
                      <Text className="text-gray-400 text-xs">
                        {order.customerPhone}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-500 text-xs">Wallet</Text>
                    <Pressable
                      onPress={copyAddress}
                      className="flex-row items-center gap-1"
                    >
                      <Text className="text-gray-400 text-xs font-mono">
                        {order.customerAddress.slice(0, 8)}...
                        {order.customerAddress.slice(-6)}
                      </Text>
                      <Ionicons name="copy-outline" size={12} color="#6B7280" />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Booking Details */}
              <View className="bg-[#1a1a1a] rounded-xl p-3">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  <Text className="text-white text-sm font-semibold ml-2">
                    Booking Details
                  </Text>
                </View>
                <View className="flex-row flex-wrap">
                  <View className="w-1/2 mb-2">
                    <Text className="text-gray-500 text-xs mb-0.5">Date Booked</Text>
                    <Text className="text-white text-sm">
                      {formatDate(order.createdAt)}
                    </Text>
                  </View>
                  <View className="w-1/2 mb-2">
                    <Text className="text-gray-500 text-xs mb-0.5">Service Date</Text>
                    <Text className="text-white text-sm">
                      {formatDate(order.bookingDate)}
                    </Text>
                  </View>
                  <View className="w-1/2">
                    <Text className="text-gray-500 text-xs mb-0.5">Time</Text>
                    <Text className="text-white text-sm">
                      {formatTime(order.bookingTime || order.bookingTimeSlot)}
                    </Text>
                  </View>
                  <View className="w-1/2">
                    <Text className="text-gray-500 text-xs mb-0.5">Amount</Text>
                    <Text className="text-white text-sm font-semibold">
                      ${order.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Payment & Rewards */}
              <View className="bg-[#1a1a1a] rounded-xl p-3">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="card-outline" size={16} color="#9CA3AF" />
                  <Text className="text-white text-sm font-semibold ml-2">
                    Payment & Rewards
                  </Text>
                </View>
                <View className="gap-2">
                  {(order.rcnEarned ?? 0) > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-gray-500 text-xs">RCN Earned</Text>
                      <Text className="text-[#FFCC00] text-xs">
                        +{order.rcnEarned} RCN
                      </Text>
                    </View>
                  )}
                  {(order.promoRcn ?? 0) > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-gray-500 text-xs">Promo RCN</Text>
                      <Text className="text-purple-400 text-xs">
                        +{order.promoRcn} RCN
                      </Text>
                    </View>
                  )}
                  {(order.rcnRedeemed ?? 0) > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-gray-500 text-xs">RCN Redeemed</Text>
                      <Text className="text-green-400 text-xs">
                        -{order.rcnRedeemed} RCN
                      </Text>
                    </View>
                  )}
                  {!(order.rcnEarned ?? 0) &&
                    !(order.promoRcn ?? 0) &&
                    !(order.rcnRedeemed ?? 0) && (
                      <Text className="text-gray-500 text-xs">
                        No reward data
                      </Text>
                    )}
                </View>
              </View>

              {/* Notes */}
              {order.notes && (
                <View className="bg-[#1a1a1a] rounded-xl p-3">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="document-text-outline"
                      size={16}
                      color="#9CA3AF"
                    />
                    <Text className="text-white text-sm font-semibold ml-2">
                      Customer Notes
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs">{order.notes}</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === "timeline" && (
            <View className="gap-3">
              <TimelineItem
                color="#22C55E"
                title="Booking Created"
                date={formatDate(order.createdAt)}
              />
              {order.status !== "pending" && (
                <TimelineItem
                  color="#22C55E"
                  title="Payment Received"
                  date={formatDate(order.createdAt)}
                />
              )}
              {order.shopApproved && (
                <TimelineItem
                  color="#22C55E"
                  title="Booking Approved"
                  date={formatDate(order.approvedAt)}
                />
              )}
              {order.rescheduledAt && (
                <TimelineItem
                  color="#FFCC00"
                  title="Booking Rescheduled"
                  date={formatDate(order.rescheduledAt)}
                  subtitle={
                    order.rescheduleReason
                      ? `Reason: ${order.rescheduleReason}`
                      : undefined
                  }
                />
              )}
              {order.status === "completed" && (
                <TimelineItem
                  color="#3B82F6"
                  title="Service Completed"
                  date={formatDate(order.completedAt)}
                />
              )}
              {order.status === "cancelled" && (
                <TimelineItem
                  color="#EF4444"
                  title="Booking Cancelled"
                  date={formatDate(order.updatedAt)}
                />
              )}
              {order.status === "no_show" && (
                <TimelineItem
                  color="#F59E0B"
                  title="Marked as No-Show"
                  date={formatDate(order.updatedAt)}
                />
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function TimelineItem({
  color,
  title,
  date,
  subtitle,
}: {
  color: string;
  title: string;
  date: string;
  subtitle?: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View
        className="w-2.5 h-2.5 rounded-full mt-1"
        style={{ backgroundColor: color }}
      />
      <View>
        <Text className="text-white text-xs">{title}</Text>
        <Text className="text-gray-500 text-[10px]">{date}</Text>
        {subtitle && (
          <Text className="text-gray-400 text-[10px]">{subtitle}</Text>
        )}
      </View>
    </View>
  );
}
