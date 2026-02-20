import React from "react";
import { Text, View } from "react-native";

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  suffix?: string;
}

function StatCard({
  value,
  label,
  icon,
  suffix,
}: StatCardProps) {
  return (
    <View className="flex-1 mx-1">
      <View
        className="rounded-2xl p-4 h-[80px] flex-row items-center"
        style={{ backgroundColor: "#101010" }}
      >
        {/* Icon Circle */}
        {icon && (
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: "#FFCC00" }}
          >
            {icon}
          </View>
        )}

        {/* Text Content */}
        <View className="flex-1">
          <Text
            className="text-sm font-medium text-white mb-1"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text className="text-xl font-bold text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
            {suffix && <Text className="text-xl font-bold text-white"> {suffix}</Text>}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(StatCard);
