import { Image, View, Text, Pressable } from "react-native";
import React from "react";
import { CustomerWalletTab } from "../components";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuthStore } from "@/store/auth.store";
import { NotificationBell } from "@/feature/notification/components";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CustomerDashboard() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const { data: customerData } = useGetCustomerByWalletAddress(account?.address);

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="flex-1 pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <View style={{ marginRight: -10 }} className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/customer/messages" as any)}
              style={{ width: 40, height: 40 }}
              className="bg-[#121212] rounded-full items-center justify-center"
            >
              <Feather name="message-circle" size={20} color="white" />
            </Pressable>
            <NotificationBell userType="customer" />
          </View>
        </View>
        <View className="flex-row my-4 justify-between items-center">
          <View className="flex-row">
            <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
              Hello!
            </Text>
            <Text className="text-lg font-semibold text-white">
              {customerData?.customer?.name}
            </Text>
          </View>
        </View>
        <CustomerWalletTab />
      </View>
    </View>
  );
}
