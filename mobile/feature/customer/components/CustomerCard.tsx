import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

interface CustomerCardProps {
  name: string;
  tier: string;
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  total_transactions?: number;
  referralCount?: number;
  totalRedemptions?: number;
  joinDate?: string;
  isSuspended?: boolean;
  suspensionReason?: string | null;
  onPress?: () => void;
  onMessagePress?: () => void;
}

const getTierConfig = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "gold":
      return {
        color: "#FFD700",
        bgColor: "rgba(255, 215, 0, 0.15)",
        icon: "crown",
      };
    case "silver":
      return {
        color: "#C0C0C0",
        bgColor: "rgba(192, 192, 192, 0.15)",
        icon: "medal",
      };
    case "bronze":
      return {
        color: "#CD7F32",
        bgColor: "rgba(205, 127, 50, 0.15)",
        icon: "medal-outline",
      };
    default:
      return {
        color: "#666",
        bgColor: "rgba(102, 102, 102, 0.15)",
        icon: "medal-outline",
      };
  }
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const formatDate = (dateString: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

const formatJoinDate = (dateString?: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

function CustomerCard({
  name,
  tier,
  lifetimeEarnings,
  lastTransactionDate,
  total_transactions,
  referralCount,
  totalRedemptions,
  joinDate,
  isSuspended,
  suspensionReason,
  onPress,
  onMessagePress,
}: CustomerCardProps) {
  const tierConfig = getTierConfig(tier);
  const formattedDate = lastTransactionDate ? formatDate(lastTransactionDate) : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-3">
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#1a1a1a",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        <View className="p-4">
          <View className="flex-row items-center">
            {/* Avatar with gradient border */}
            <View
              className="w-14 h-14 rounded-full items-center justify-center mr-4"
              style={{
                backgroundColor: tierConfig.bgColor,
                borderWidth: 2,
                borderColor: tierConfig.color + "40",
              }}
            >
              <Text
                className="text-xl font-bold"
                style={{ color: tierConfig.color }}
              >
                {getInitials(name)}
              </Text>
            </View>

            {/* Info Section */}
            <View className="flex-1">
              {/* Name & Actions */}
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className="text-white font-semibold text-base flex-1 mr-2"
                  numberOfLines={1}
                >
                  {name || "Unknown Customer"}
                </Text>
                <View className="flex-row items-center gap-2">
                  {onMessagePress && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        onMessagePress();
                      }}
                      activeOpacity={0.7}
                      className="bg-blue-500/20 rounded-full p-1.5"
                    >
                      <Ionicons name="chatbubble" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                  <View className="bg-zinc-800 rounded-full p-1.5">
                    <Feather name="chevron-right" size={14} color="#9CA3AF" />
                  </View>
                </View>
              </View>

              {/* Tier Badge & Last Activity */}
              <View className="flex-row items-center gap-2">
                {/* Tier Badge */}
                <View
                  className="flex-row items-center px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: tierConfig.bgColor }}
                >
                  <MaterialCommunityIcons
                    name={tierConfig.icon as any}
                    size={12}
                    color={tierConfig.color}
                  />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: tierConfig.color }}
                  >
                    {tier?.toUpperCase() || "BRONZE"}
                  </Text>
                </View>

                {/* Suspended Badge */}
                {isSuspended && (
                  <View className="flex-row items-center px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }}>
                    <Ionicons name="ban-outline" size={10} color="#EF4444" />
                    <Text className="text-xs font-semibold ml-1" style={{ color: "#EF4444" }}>
                      SUSPENDED
                    </Text>
                  </View>
                )}

                {/* Last Activity */}
                {formattedDate && !isSuspended && (
                  <View className="flex-row items-center bg-zinc-800/50 px-2 py-1 rounded-full">
                    <Feather name="clock" size={10} color="#6B7280" />
                    <Text className="text-gray-500 text-xs ml-1">
                      {formattedDate}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Stats Bar */}
          <View className="flex-row items-center mt-4 pt-3 border-t border-zinc-800">
            {/* RCN Earnings */}
            <View className="flex-1 flex-row items-center">
              <View className="bg-[#FFCC00]/10 rounded-full p-1.5 mr-2">
                <Ionicons name="wallet" size={14} color="#FFCC00" />
              </View>
              <View>
                <Text className="text-gray-500 text-[10px] uppercase tracking-wide">
                  Earned
                </Text>
                <Text className="text-[#FFCC00] text-sm font-bold">
                  {lifetimeEarnings?.toFixed(0) || "0"} RCN
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View className="w-px h-8 bg-zinc-800 mx-3" />

            {/* Transactions */}
            <View className="flex-1 flex-row items-center">
              <View className="bg-blue-500/10 rounded-full p-1.5 mr-2">
                <Feather name="repeat" size={14} color="#3B82F6" />
              </View>
              <View>
                <Text className="text-gray-500 text-[10px] uppercase tracking-wide">
                  Transactions
                </Text>
                <Text className="text-white text-sm font-bold">
                  {total_transactions ?? 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Secondary Stats Row */}
          {(referralCount !== undefined || totalRedemptions !== undefined || joinDate) && (
            <View className="flex-row items-center mt-2 pt-2 border-t border-zinc-800/50">
              {totalRedemptions !== undefined && (
                <View className="flex-row items-center mr-4">
                  <Ionicons name="arrow-down-circle-outline" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-xs ml-1">
                    {totalRedemptions} redeemed
                  </Text>
                </View>
              )}
              {referralCount !== undefined && referralCount > 0 && (
                <View className="flex-row items-center mr-4">
                  <Ionicons name="people-outline" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-xs ml-1">
                    {referralCount} referral{referralCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
              {joinDate && (
                <View className="flex-row items-center ml-auto">
                  <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-xs ml-1">
                    {formatJoinDate(joinDate)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(CustomerCard);
