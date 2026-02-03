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
import { useCustomer } from "@/shared/hooks/customer/useCustomer";

export default function CustomerAccountScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );

  return (
    <View className="w-full h-full bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-16 pb-4">
        <Text className="text-white text-xl font-semibold">Profile</Text>
        <TouchableOpacity
          onPress={() => router.push("/customer/settings")}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="rounded-2xl flex-row items-center">
          <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center">
            <Ionicons name="person" size={32} color="#FFCC00" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white text-lg font-bold">
              {customerData?.customer?.name || "User"}
            </Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {customerData?.customer?.email || "No email"}
            </Text>
            <View className="flex-row items-center mt-1">
              <View className="bg-[#FFCC00]/20 px-2 py-0.5 rounded-full">
                <Text className="text-[#FFCC00] text-xs font-medium capitalize">
                  {customerData?.customer?.tier || "Bronze"} Member
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
