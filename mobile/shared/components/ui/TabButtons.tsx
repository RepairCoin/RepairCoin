import { View, Text, TouchableOpacity } from "react-native";

interface Tab {
  key: string;
  label: string;
}

interface TabButtonsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabButtons({ tabs, activeTab, onTabChange }: TabButtonsProps) {
  const getTabClassName = (index: number, isActive: boolean) => {
    const baseClass = "flex-1 py-3";
    const bgClass = isActive ? "bg-[#FFCC00]" : "bg-zinc-800";

    if (index === 0) {
      return `${baseClass} rounded-l-xl ${bgClass}`;
    }
    if (index === tabs.length - 1) {
      return `${baseClass} rounded-r-xl ${bgClass}`;
    }
    return `${baseClass} ${bgClass}`;
  };

  return (
    <View className="flex-row px-4 mb-4">
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={getTabClassName(index, isActive)}
          >
            <Text
              className={`text-center font-semibold ${isActive ? "text-black" : "text-gray-400"}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
