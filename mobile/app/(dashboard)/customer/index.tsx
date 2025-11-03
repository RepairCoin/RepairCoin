import { Image, View, Text, Pressable } from "react-native";
import React, { useState } from "react";
import WalletTab from "./tabs/wallet/WalletTab";
import ApprovalTab from "@/app/(dashboard)/customer/tabs/approval/ApprovalTab";
import ReferralTab from "@/app/(dashboard)/customer/tabs/referral/ReferralTab";
import { useAuthStore } from "@/store/authStore";
import { useCustomer } from "@/hooks";

type CustomerTabs = "Wallet" | "Referral" | "Approval";

export default function CustomerDashboard() {
  const { account } = useAuthStore();

  // Use the token balance hook
  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useCustomer(account?.address);
  const [activeTab, setActiveTab] = useState<CustomerTabs>("Wallet");
  const customerTabs: CustomerTabs[] = ["Wallet", "Referral", "Approval"];

  return (
    <View className="h-full w-full bg-zinc-950">
      <View className="h-full w-full pt-14 px-4">
        <Image
          source={require("@/assets/images/logo.png")}
          className="w-[40%] h-10"
          resizeMode="contain"
        />
        <View className="flex-row my-4 justify-between items-center">
          <View className="flex-row">
            <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
              Hello!
            </Text>
            <Text className="text-lg font-semibold text-white">{customerData?.customer.name}</Text>
          </View>
        </View>
        <View className="flex-row w-full h-12 bg-[#121212] rounded-xl justify-between">
          {customerTabs.map((tab, i) => (
            <React.Fragment key={i}>
              <Pressable
                onPress={() => {
                  activeTab !== tab && setActiveTab(tab);
                }}
                className={`bg-${activeTab === tab ? "[#FFCC00]" : "[#121212]"} w-[33%] flex-row ${i === 0 && "rounded-l-xl"} ${i === 2 && "rounded-r-xl"} items-center justify-center`}
              >
                <Text
                  className={`text-lg font-bold text-${activeTab === tab ? "black" : "gray-400"}`}
                >
                  {tab}
                </Text>
              </Pressable>
              {i !== 2 && activeTab === customerTabs[2 - 2 * i] && (
                <View className="w-[0.1%] bg-gray-400 my-2" />
              )}
            </React.Fragment>
          ))}
        </View>
        {/* <PrimaryButton title="Logout" onPress={logout} /> */}
        {activeTab === "Wallet" && <WalletTab />}
        {activeTab === "Referral" && <ReferralTab />}
        {activeTab === "Approval" && <ApprovalTab />}
      </View>
    </View>
  );
}
