import React from "react";
import { Image, View, Text } from "react-native";
import { useCustomer } from "@/feature/customer/profile/hooks/useCustomer";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useEndBootWhenReady } from "@/shared/hooks/useEndBootWhenReady";
import GradientHeader from "@/shared/components/ui/GradientHeader";
import {
  CustomerWalletTab,
  MessageButton,
  NotificationBell,
} from "./../../components";

export default function CustomerDashboard() {
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { account } = useAuthStore();

  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address,
  );

  // Lift the cold-start boot splash once this screen has its data.
  useEndBootWhenReady(!!customerData);

  const customer = customerData?.customer;
  const firstName = customer?.name?.split(" ")[0] || "there";

  return (
    <View className="flex-1 bg-zinc-950">
      <GradientHeader>
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[34%] h-10"
            resizeMode="contain"
          />
          <View className="flex-row items-center gap-2">
            {customer?.profileImageUrl ? (
              <Image
                source={{ uri: customer.profileImageUrl }}
                className="w-10 h-10 rounded-full"
                style={{ borderWidth: 2, borderColor: "#FFCC00" }}
              />
            ) : (
              <View
                className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center"
                style={{ borderWidth: 2, borderColor: "#FFCC00" }}
              >
                <Text className="text-[#FFCC00] font-bold">
                  {(customer?.name?.[0] || "U").toUpperCase()}
                </Text>
              </View>
            )}
            <MessageButton userType="customer" />
            <NotificationBell userType="customer" />
          </View>
        </View>
        <View className="mt-3">
          <Text className="text-white text-xl font-bold">
            Welcome back! {firstName} 👋
          </Text>
        </View>
      </GradientHeader>

      <View className="flex-1 px-4">
        <CustomerWalletTab />
      </View>
    </View>
  );
}
