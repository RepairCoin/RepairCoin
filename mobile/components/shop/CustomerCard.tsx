import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

interface CustomerCardProps {
  name: string;
  tier: string;
  lifetimeEarnings: number;
  lastTransactionDate: string;
  onPress?: () => void;
}

const getTierColor = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "gold":
      return "#FFD700";
    case "silver":
      return "#C0C0C0";
    case "bronze":
      return "#CD7F32";
    default:
      return "#666";
  }
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
  onPress,
}: CustomerCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1a1a1a] rounded-xl p-4 mx-4 mb-3 border border-[#333]"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Feather name="user" size={18} color="#fff" />
            <Text className="text-white font-semibold text-base ml-2">
              {name || "Unknown Customer"}
            </Text>
          </View>
          
          <View className="flex-row items-center mb-2">
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: getTierColor(tier) + "20" }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: getTierColor(tier) }}
              >
                {tier?.toUpperCase() || "BRONZE"}
              </Text>
            </View>
            
            <View className="flex-row items-center ml-3">
              <Feather name="dollar-sign" size={14} color="#ffcc00" />
              <Text className="text-[#ffcc00] text-sm ml-1">
                {lifetimeEarnings?.toFixed(2) || "0.00"} RCN
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center">
            <Feather name="clock" size={12} color="#666" />
            <Text className="text-[#666] text-xs ml-1">
              {formatDate(lastTransactionDate)}
            </Text>
          </View>
        </View>
        
        <Feather name="chevron-right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );
}