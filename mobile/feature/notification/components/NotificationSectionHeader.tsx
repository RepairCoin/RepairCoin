import React from "react";
import { View, Text } from "react-native";

interface NotificationSectionHeaderProps {
  title: string;
}

/** Date-bucket header (Today / Yesterday / dated) for the notifications list. */
function NotificationSectionHeader({ title }: NotificationSectionHeaderProps) {
  return (
    <View className="px-4 pt-4 pb-2 bg-zinc-950">
      <Text className="text-white text-lg font-bold">{title}</Text>
    </View>
  );
}

export default React.memo(NotificationSectionHeader);
