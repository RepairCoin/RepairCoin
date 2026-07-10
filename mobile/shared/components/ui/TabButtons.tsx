import { View, Text, TouchableOpacity } from "react-native";
import { useHaptics } from "@/shared/hooks/useHaptics";

interface Tab {
  key: string;
  label: string;
  sublabel?: string;
}

interface TabButtonsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function TabButtons({
  tabs,
  activeTab,
  onTabChange,
  className = "px-4 mb-4",
}: TabButtonsProps) {
  const haptics = useHaptics();

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
    <View className={`flex-row ${className}`}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => {
              haptics.selection();
              onTabChange(tab.key);
            }}
            className={getTabClassName(index, isActive)}
          >
            <Text
              className={`text-center font-semibold ${isActive ? "text-black" : "text-gray-400"}`}
            >
              {tab.label}
            </Text>
            {tab.sublabel && (
              <Text
                className={`text-center text-xs mt-0.5 ${
                  isActive ? "text-black/60" : "text-gray-500"
                }`}
              >
                {tab.sublabel}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
