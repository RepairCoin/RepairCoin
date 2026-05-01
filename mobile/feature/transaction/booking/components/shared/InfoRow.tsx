import React from "react";
import { View, Text } from "react-native";

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

export default function InfoRow({ icon, label, value, valueColor = "#fff" }: InfoRowProps) {
  return (
    <View className="flex-row items-center py-3.5 border-b border-gray-800/50">
      <View className="w-9 h-9 items-center justify-center">
        {icon}
      </View>
      <Text className="text-gray-400 flex-1 text-sm">{label}</Text>
      <Text className="font-semibold text-sm" style={{ color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}
