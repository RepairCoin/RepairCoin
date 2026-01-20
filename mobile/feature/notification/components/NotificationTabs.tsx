import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TabType } from "../types";

type NotificationTabsProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount: number;
  onMarkAllAsRead: () => void;
};

export default function NotificationTabs({
  activeTab,
  onTabChange,
  unreadCount,
  onMarkAllAsRead,
}: NotificationTabsProps) {
  return (
    <View className="px-4">
      <View className="flex-row justify-between items-center">
        {/* Tabs */}
        <View className="flex-row">
          <Pressable
            onPress={() => onTabChange("unread")}
            className={`px-4 py-2 rounded-full mr-2 ${
              activeTab === "unread" ? "bg-[#FFCC00]" : "bg-white"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === "unread" ? "text-black" : "text-gray-500"
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onTabChange("all")}
            className={`px-4 py-2 rounded-full ${
              activeTab === "all" ? "bg-[#FFCC00]" : "bg-white"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === "all" ? "text-black" : "text-gray-500"
              }`}
            >
              All
            </Text>
          </Pressable>
        </View>

        {/* Mark All as Read Button */}
        {unreadCount > 0 && (
          <Pressable
            onPress={onMarkAllAsRead}
            className="flex-row items-center px-3 py-2 rounded-full bg-zinc-800"
          >
            <Ionicons name="checkmark-done" color="#FFCC00" size={16} />
            <Text className="text-yellow-500 text-xs font-medium ml-1">
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
