import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Notification } from "@/feature/notification/services/notification.interface";

interface CampaignCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

export default function CampaignCard({ notification, onPress }: CampaignCardProps) {
  const metadata = notification.metadata || {};
  const campaignName = metadata.campaignName || "Special Promotion";
  const shopName = metadata.shopName || "RepairCoin";
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  const hasCoupon = !!metadata.couponValue;
  const couponDisplay =
    metadata.couponType === "percentage"
      ? `${metadata.couponValue}% OFF`
      : `$${metadata.couponValue} OFF`;

  return (
    <TouchableOpacity
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
      className="bg-zinc-900 rounded-xl p-3 flex-row items-start"
    >
      {/* Megaphone Icon */}
      <View className="w-10 h-10 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-3">
        <MaterialCommunityIcons name="bullhorn" size={20} color="#FFCC00" />
      </View>

      {/* Campaign Info */}
      <View className="flex-1 mr-2">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {campaignName}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          from: <Text className="text-[#FFCC00]">{shopName}</Text>
        </Text>
        {hasCoupon && (
          <View className="bg-emerald-500/20 self-start rounded px-2 py-0.5 mt-1">
            <Text className="text-emerald-400 text-xs font-semibold">
              {couponDisplay}
            </Text>
          </View>
        )}
        <Text className="text-xs text-gray-500 mt-1">{timeAgo}</Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color="#FFCC00" style={{ marginTop: 4 }} />
    </TouchableOpacity>
  );
}
