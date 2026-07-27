import { View, Text, Pressable } from "react-native";
import { CustomerServiceTab } from "@/feature/services/services/service.interface";
import { CUSTOMER_SERVICE_TABS } from "@/shared/constants/services";

interface CustomerTabBarProps {
  activeTab: CustomerServiceTab;
  onTabChange: (tab: CustomerServiceTab) => void;
}

export function CustomerTabBar({ activeTab, onTabChange }: CustomerTabBarProps) {
  return (
    <View className="flex-row w-full bg-[#121212] rounded-2xl p-1 border border-zinc-800">
      {CUSTOMER_SERVICE_TABS.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            className={`flex-1 items-center justify-center py-2.5 rounded-xl ${
              isActive ? "bg-[#FFCC00]" : ""
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                isActive ? "text-black" : "text-gray-400"
              }`}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
