import React from "react";
import { View, Text } from "react-native";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  iconBgColor?: string;
}

function SectionHeader({
  icon,
  title,
  iconBgColor = "#FFCC00",
}: SectionHeaderProps) {
  return (
    <View className="flex-row items-center mb-4 mt-6">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: iconBgColor }}
      >
        {icon}
      </View>
      <Text className="text-white text-lg font-semibold">{title}</Text>
    </View>
  );
}

export default React.memo(SectionHeader);
