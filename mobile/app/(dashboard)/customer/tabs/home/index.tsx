import { Image, View, Text, Pressable } from "react-native";
import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import WalletTab from "./tabs/wallet";
import ApprovalTab from "./tabs/approval";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuthStore } from "@/store/auth.store";

type CustomerTabs = "Wallet" | "Approval";

export default function CustomerDashboard() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  // Use the token balance hook
  const {
    data: customerData,
  } = useGetCustomerByWalletAddress(account?.address);
  const [activeTab, setActiveTab] = useState<CustomerTabs>("Wallet");
  const customerTabs: CustomerTabs[] = ["Wallet", "Approval"];

  return (
    <View className="h-full w-full bg-zinc-950">
      <View className="h-full w-full pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <Pressable
            onPress={() => router.push("/customer/notification")}
            className="w-10 h-10 bg-[#121212] rounded-full items-center justify-center"
          >
            <Feather name="bell" size={20} color="white" />
          </Pressable>
        </View>
        <View className="flex-row my-4 justify-between items-center">
          <View className="flex-row">
            <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
              Hello!
            </Text>
            <Text className="text-lg font-semibold text-white">
              {customerData?.customer.name}
            </Text>
          </View>
        </View>
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl justify-between">
          {customerTabs.map((tab, i) => (
            <React.Fragment key={i}>
              <Pressable
                onPress={() => {
                  activeTab !== tab && setActiveTab(tab);
                }}
                className={`bg-${activeTab === tab ? "[#FFCC00]" : "[#121212]"} w-[50%] flex-row ${i === 0 && "rounded-l-lg"} ${i === 1 && "rounded-r-lg"} items-center justify-center`}
              >
                <Text
                  className={`text-base font-bold text-${activeTab === tab ? "black" : "gray-400"}`}
                >
                  {tab}
                </Text>
              </Pressable>
              {i === 0 && activeTab !== customerTabs[0] && activeTab !== customerTabs[1] && (
                <View className="w-[0.1%] bg-gray-400 my-2" />
              )}
            </React.Fragment>
          ))}
        </View>
        {activeTab === "Wallet" && <WalletTab />}
        {activeTab === "Approval" && <ApprovalTab />}
      </View>
    </View>
  );
}
