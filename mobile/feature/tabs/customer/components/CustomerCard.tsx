import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface CustomerCardProps {
  name: string;
  tier: string;
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  total_transactions?: number;
  onPress?: () => void;
}

const getTierConfig = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "gold":
      return { color: "#FFD700", bgColor: "#FFD70020", icon: "crown" };
    case "silver":
      return { color: "#C0C0C0", bgColor: "#C0C0C020", icon: "medal" };
    case "bronze":
      return { color: "#CD7F32", bgColor: "#CD7F3220", icon: "medal-outline" };
    default:
      return { color: "#666", bgColor: "#66666620", icon: "medal-outline" };
  }
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const formatDate = (dateString: string) => {
  if (!dateString) return "No transactions";
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

export default function CustomerCard({
  name,
  tier,
  lifetimeEarnings,
  lastTransactionDate,
  total_transactions,
  onPress,
}: CustomerCardProps) {
  const tierConfig = getTierConfig(tier);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="mx-4 mb-3">
      <LinearGradient
        colors={["#2A2A2C", "#1A1A1C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          padding: 16,
        }}
      >
        <View className="flex-row items-center">
          {/* Avatar */}
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: tierConfig.color + "30" }}
          >
            <Text
              className="text-lg font-bold"
              style={{ color: tierConfig.color }}
            >
              {getInitials(name)}
            </Text>
          </View>

          {/* Info */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-white font-semibold text-base" numberOfLines={1}>
                {name || "Unknown Customer"}
              </Text>
              <Feather name="chevron-right" size={18} color="#666" />
            </View>

            <View className="flex-row items-center gap-2 mb-2">
              {/* Tier Badge */}
              <View
                className="flex-row items-center px-2 py-1 rounded-full"
                style={{ backgroundColor: tierConfig.bgColor }}
              >
                <MaterialCommunityIcons
                  name={tierConfig.icon as any}
                  size={12}
                  color={tierConfig.color}
                />
                <Text
                  className="text-xs font-medium ml-1"
                  style={{ color: tierConfig.color }}
                >
                  {tier?.toUpperCase() || "BRONZE"}
                </Text>
              </View>

              {/* Last Activity */}
              {lastTransactionDate && (
                <View className="flex-row items-center">
                  <Feather name="clock" size={10} color="#666" />
                  <Text className="text-[#666] text-xs ml-1">
                    {formatDate(lastTransactionDate)}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats Row */}
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center">
                <Ionicons name="wallet-outline" size={14} color="#FFCC00" />
                <Text className="text-[#FFCC00] text-sm font-medium ml-1">
                  {lifetimeEarnings?.toFixed(0) || "0"} RCN
                </Text>
              </View>

              {total_transactions !== undefined && (
                <View className="flex-row items-center">
                  <Feather name="repeat" size={12} color="#888" />
                  <Text className="text-[#888] text-xs ml-1">
                    {total_transactions} transactions
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
