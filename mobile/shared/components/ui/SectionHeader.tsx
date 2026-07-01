import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  optional?: boolean;
  iconBgColor?: string;
  customClassName?: string;
  /** When provided, renders a right-aligned "See All" action. */
  onSeeAll?: () => void;
  seeAllLabel?: string;
}

function SectionHeader({
  icon,
  title,
  optional,
  iconBgColor = "#FFCC00",
  customClassName,
  onSeeAll,
  seeAllLabel = "See All",
}: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-4 mt-6">
      <View className="flex-row items-center flex-1">
        {icon && (
          <View
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: iconBgColor }}
          >
            {icon}
          </View>
        )}
        <Text
          className={`${customClassName ?? "text-white"} text-lg font-semibold`}
          numberOfLines={1}
        >
          {title}
          {optional && <Text className="text-gray-200 ml-1">(Optional)</Text>}
        </Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
          <Text className="text-[#FFCC00] text-sm font-semibold">
            {seeAllLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(SectionHeader);
