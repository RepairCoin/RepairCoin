import React from "react";
import { View, Text } from "react-native";

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 mb-2">
          {title}
        </Text>
      )}
      <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
        {children}
      </View>
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-zinc-800 ml-16" />;
}
