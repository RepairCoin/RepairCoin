import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  labelColor?: string;
  valueColor?: string;
}

function StatCard({
  value,
  label,
  icon,
  labelColor = "#FFCC00",
  valueColor = "#FFFFFF",
}: StatCardProps) {
  return (
    <View className="flex-1 mx-1">
      <LinearGradient
        colors={["#373737", "#121212"]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={{
          flex: 1,
          borderRadius: 16,
          padding: 16,
          gap: 8,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text
            className="text-base"
            style={{ color: labelColor }}
            numberOfLines={2}
          >
            {label}
          </Text>
          {icon && (
            <View className="w-8 h-8 rounded-full items-center justify-center">
              {icon}
            </View>
          )}
        </View>
        <Text
          className="text-2xl font-bold"
          style={{ color: valueColor }}
        >
          {value}
        </Text>
      </LinearGradient>
    </View>
  );
}

export default React.memo(StatCard);
