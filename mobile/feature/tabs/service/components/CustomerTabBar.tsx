import { View, Text, Pressable } from "react-native";
import { CustomerServiceTab } from "../types";
import { CUSTOMER_SERVICE_TABS } from "../constants";

interface CustomerTabBarProps {
  activeTab: CustomerServiceTab;
  onTabChange: (tab: CustomerServiceTab) => void;
}

export function CustomerTabBar({ activeTab, onTabChange }: CustomerTabBarProps) {
  const getTabStyle = (tab: CustomerServiceTab, index: number) => {
    const isActive = activeTab === tab;
    let roundedClass = "";
    if (index === 0) roundedClass = "rounded-l-lg";
    else if (index === CUSTOMER_SERVICE_TABS.length - 1) roundedClass = "rounded-r-lg";

    return `flex-1 items-center justify-center ${
      isActive ? "bg-[#FFCC00]" : "bg-[#121212]"
    } ${roundedClass}`;
  };

  return (
    <View className="flex-row w-full h-10 bg-[#121212] rounded-xl">
      {CUSTOMER_SERVICE_TABS.map((tab, i) => (
        <Pressable
          key={i}
          onPress={() => onTabChange(tab)}
          className={getTabStyle(tab, i)}
        >
          <Text
            className={`text-base font-bold ${
              activeTab === tab ? "text-black" : "text-gray-400"
            }`}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
