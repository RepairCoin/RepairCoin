import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TabType } from "../types";

type EmptyNotificationsProps = {
  activeTab: TabType;
};

export default function EmptyNotifications({ activeTab }: EmptyNotificationsProps) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="notifications-off-outline" size={64} color="#666" />
      <Text className="text-zinc-400 text-lg mt-4">
        {activeTab === "ai"
          ? "No AI assistant messages"
          : activeTab === "updates"
          ? "No updates yet"
          : "No notifications yet"}
      </Text>
      <Text className="text-zinc-600 text-sm mt-2 text-center px-8">
        When you receive rewards, bookings, or updates, they'll appear here
      </Text>
    </View>
  );
}
