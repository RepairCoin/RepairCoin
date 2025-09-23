import PrimaryButton from "@/components/PrimaryButton";
import Screen from "@/components/Screen";
import { Entypo } from "@expo/vector-icons";
import { Image, View, Text, Pressable } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";

type CustomerTabs = "Wallet" | "Referral" | "Approval";

export default function CustomerDashboard() {
  const { logout } = useAuthStore((state) => state);
  const [activeTab, setActiveTab] = useState<CustomerTabs>("Wallet");
  const customerTabs: CustomerTabs[] = ["Wallet", "Referral", "Approval"];

  return (
    <Screen>
      <View className="pt-14 px-6">
        <Image
          source={require("@/assets/images/logo.png")}
          className="w-[40%] h-10"
          resizeMode="contain"
        />
        <View className="flex-row my-4">
          <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
            Hello!
          </Text>
          <Text className="text-lg font-semibold text-white">John Doe!</Text>
        </View>
        <View className="flex-row w-full h-12 bg-[#121212] rounded-xl justify-between">
          {customerTabs.map((tab, i) => (
            <>
              <Pressable
                onPress={() => {
                  activeTab !== tab && setActiveTab(tab);
                }}
                key={i}
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
            </>
          ))}
        </View>
        {/* <PrimaryButton title="Logout" onPress={logout} /> */}
      </View>
    </Screen>
  );
}
