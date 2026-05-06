import React from "react";
import { View, Text } from "react-native";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  optional?: boolean;
  iconBgColor?: string;
  customClassName?: string;
}

function SectionHeader({
  icon,
  title,
  optional,
  iconBgColor = "#FFCC00",
  customClassName
}: SectionHeaderProps) {
  return (
    <View className="flex-row items-center mb-4 mt-6">
      {icon && (
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: iconBgColor }}
        >
          {icon}
        </View>
      )}
      <Text className={`${customClassName ?? "text-white"} text-lg font-semibold`}>
        {title}
        {optional && <Text className="text-gray-200 ml-1">(Optional)</Text>}
      </Text>
    </View>
  );
}

export default React.memo(SectionHeader);
