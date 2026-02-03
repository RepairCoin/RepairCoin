// Libraries
import React from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

// Hooks
import { useAuthStore } from "@/shared/store/auth.store";
import { useShop } from "@/shared/hooks/shop/useShop";

export default function ShopAccountScreen() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();

  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");

  const getSubscriptionStatus = () => {
    if (shopData?.operational_status === "subscription_qualified") {
      return { label: "Active", color: "#22C55E", bgColor: "bg-green-500/20" };
    }
    return { label: "Inactive", color: "#EF4444", bgColor: "bg-red-500/20" };
  };

  const subscriptionStatus = getSubscriptionStatus();

  return (
    <View className="w-full h-full bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-16 pb-4">
        <Text className="text-white text-xl font-semibold">Profile</Text>
        <TouchableOpacity
          onPress={() => router.push("/shop/settings")}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="rounded-2xl flex-row items-center">
          <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center">
            <Ionicons name="storefront" size={32} color="#FFCC00" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white text-lg font-bold">
              {shopData?.name || "Shop"}
            </Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {shopData?.email || "No email"}
            </Text>
            <View className="flex-row items-center mt-1 gap-2">
              <View className="bg-[#FFCC00]/20 px-2 py-0.5 rounded-full">
                <Text className="text-[#FFCC00] text-xs font-medium">
                  Shop Owner
                </Text>
              </View>
              <View className={`${subscriptionStatus.bgColor} px-2 py-0.5 rounded-full`}>
                <Text style={{ color: subscriptionStatus.color }} className="text-xs font-medium">
                  {subscriptionStatus.label}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
