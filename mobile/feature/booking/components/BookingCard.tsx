import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BookingStatus } from "@/interfaces/booking.interfaces";
import { BookingCardProps } from "../types";

const getStatusColor = (status: BookingStatus) => {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "paid":
      return "#3b82f6";
    case "pending":
      return "#eab308";
    case "cancelled":
      return "#ef4444";
    case "refunded":
      return "#a855f7";
    default:
      return "#666";
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatBookingDate = (dateString: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const truncateAddress = (address: string) => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function BookingCard({
  serviceName,
  customerAddress,
  customerName,
  status,
  totalAmount,
  createdAt,
  bookingDate,
  onPress,
}: BookingCardProps) {
  const statusColor = getStatusColor(status);
  const formattedBookingDate = bookingDate ? formatBookingDate(bookingDate) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1a1a1a] rounded-xl p-4 mx-4 mb-3 border border-[#333]"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white font-semibold text-base flex-1" numberOfLines={1}>
              {serviceName}
            </Text>
            <View
              className="px-2 py-1 rounded-full ml-2"
              style={{ backgroundColor: statusColor + "20" }}
            >
              <Text
                className="text-xs font-medium capitalize"
                style={{ color: statusColor }}
              >
                {status}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Feather name="user" size={14} color="#999" />
            <Text className="text-[#999] text-sm ml-2">
              {customerName || truncateAddress(customerAddress)}
            </Text>
          </View>

          {/* Scheduled Date */}
          {formattedBookingDate && (
            <View className="flex-row items-center mb-2 bg-[#FFCC00]/10 px-2 py-1 rounded self-start">
              <Feather name="calendar" size={12} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-xs ml-1 font-medium">
                {formattedBookingDate}
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Feather name="clock" size={12} color="#666" />
              <Text className="text-[#666] text-xs ml-1">
                {formatDate(createdAt)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Feather name="dollar-sign" size={14} color="#ffcc00" />
              <Text className="text-[#ffcc00] text-sm font-semibold">
                {totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
