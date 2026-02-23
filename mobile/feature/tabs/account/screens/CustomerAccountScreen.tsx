// Libraries
import React from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

// Hooks
import { useAuthStore } from "@/shared/store/auth.store";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";

// Components
import { TierProgressCard } from "../components";

// Constants
const COLORS = {
  primary: "#FFCC00",
  success: "#22C55E",
  error: "#EF4444",
  background: "#09090b",
  card: "#18181b",
  border: "#27272a",
};

const TIER_CONFIG = {
  bronze: {
    color: "#CD7F32",
    gradient: ["#CD7F32", "#8B4513"],
    icon: "shield-outline" as const,
  },
  silver: {
    color: "#C0C0C0",
    gradient: ["#C0C0C0", "#808080"],
    icon: "shield-half-outline" as const,
  },
  gold: {
    color: "#FFD700",
    gradient: ["#FFD700", "#FFA500"],
    icon: "shield-checkmark" as const,
  },
};

export default function CustomerAccountScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );

  const customer = customerData?.customer;

  const getTierConfig = (tier: string) => {
    const tierLower = tier?.toLowerCase() || "bronze";
    return TIER_CONFIG[tierLower as keyof typeof TIER_CONFIG] || TIER_CONFIG.bronze;
  };

  const tierConfig = getTierConfig(customer?.tier || "bronze");

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toFixed(0) || "0";
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Banner with Gradient */}
        <View className="relative">
          <LinearGradient
            colors={[tierConfig.gradient[0], tierConfig.gradient[1], "#09090b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="h-44"
          />

          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(9,9,11,0.8)", "rgba(9,9,11,1)"]}
            className="absolute bottom-0 left-0 right-0 h-24"
          />

          {/* Settings Button */}
          <TouchableOpacity
            onPress={() => router.push("/customer/settings")}
            className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Edit Profile Button */}
          <TouchableOpacity
            onPress={() => router.push("/customer/profile/edit-profile")}
            className="absolute top-12 right-16 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <Feather name="edit-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Info Section */}
        <View className="px-4 -mt-16 relative z-10">
          <View className="flex-row items-end">
            {/* Avatar */}
            <View
              className="w-28 h-28 rounded-full border-4 border-zinc-950 overflow-hidden items-center justify-center"
              style={{ backgroundColor: `${tierConfig.color}30` }}
            >
              <Text
                className="text-3xl font-bold"
                style={{ color: tierConfig.color }}
              >
                {getInitials(customer?.name || "User")}
              </Text>
            </View>

            {/* Name & Tier Badge */}
            <View className="flex-1 ml-4 pb-2">
              <Text className="text-white text-xl font-bold" numberOfLines={1}>
                {customer?.name || "User"}
              </Text>

              {/* Tier Badge */}
              <TouchableOpacity
                onPress={() => router.push("/customer/tier-info")}
                className="flex-row items-center mt-2"
              >
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: `${tierConfig.color}20` }}
                >
                  <Ionicons
                    name={tierConfig.icon}
                    size={16}
                    color={tierConfig.color}
                  />
                  <Text
                    className="text-xs font-semibold capitalize ml-1.5"
                    style={{ color: tierConfig.color }}
                  >
                    {customer?.tier || "Bronze"} Member
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={tierConfig.color}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View className="flex-row mx-4 mt-4 bg-zinc-900 rounded-2xl p-4">
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(customer?.lifetimeEarnings || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Earned</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(customer?.totalRedemptions || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Redeemed</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {customer?.totalRepairs || 0}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Repairs</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {customer?.referralCount || 0}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Referrals</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row mx-4 mt-4 gap-3">
          <TouchableOpacity
            onPress={() => router.push("/customer/referral")}
            className="flex-1 bg-[#FFCC00] rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="people" size={18} color="#000" />
            <Text className="text-black font-semibold ml-2">Refer Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/customer/qrcode")}
            className="flex-1 bg-zinc-800 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="qr-code" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">My QR</Text>
          </TouchableOpacity>
        </View>

        {/* Tier Progress Card */}
        <TierProgressCard
          currentTier={customer?.tier || "bronze"}
          lifetimeEarnings={customer?.lifetimeEarnings || 0}
        />

        {/* Account Details Section */}
        <View className="mx-4 mt-4 bg-zinc-900 rounded-2xl overflow-hidden">
          <Text className="text-zinc-500 text-xs font-semibold px-4 pt-4 pb-2">
            ACCOUNT DETAILS
          </Text>

          {/* Email */}
          {customer?.email && (
            <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Email</Text>
                <Text className="text-white text-sm mt-0.5">{customer.email}</Text>
              </View>
            </View>
          )}

          {/* Phone */}
          {customer?.phone && (
            <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="call-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Phone</Text>
                <Text className="text-white text-sm mt-0.5">{customer.phone}</Text>
              </View>
            </View>
          )}

          {/* Referral Code */}
          {customer?.referralCode && (
            <View className="flex-row items-center px-4 py-3">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="gift-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Referral Code</Text>
                <Text className="text-[#FFCC00] text-sm font-semibold mt-0.5">
                  {customer.referralCode}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/customer/referral")}
                className="bg-zinc-800 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-white text-xs font-medium">Share</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Member Since */}
        {customer?.joinDate && (
          <View className="mx-4 mt-4 bg-zinc-900 rounded-2xl px-4 py-3">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Member Since</Text>
                <Text className="text-white text-sm mt-0.5">
                  {new Date(customer.joinDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
