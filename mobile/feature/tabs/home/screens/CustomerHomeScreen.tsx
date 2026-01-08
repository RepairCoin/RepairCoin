import { Image, View, Text } from "react-native";
import React from "react";
import WalletTab from "../components/tabs/wallet";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuthStore } from "@/store/auth.store";
import { NotificationBell } from "@/feature/notification/components";

export default function CustomerDashboard() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const { data: customerData } = useGetCustomerByWalletAddress(account?.address);

  return (
    <View className="h-full w-full bg-zinc-950">
      <View className="h-full w-full pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <View style={{ marginRight: -10 }}>
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
        <WalletTab />
      </View>
    </View>
  );
}
