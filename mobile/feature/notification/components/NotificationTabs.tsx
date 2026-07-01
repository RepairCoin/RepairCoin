import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TabType } from "../types";

type NotificationTabsProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** Total notifications, shown as a badge on the "All" tab. */
  totalCount: number;
  /** Unread count — drives the "Mark all read" button visibility. */
  unreadCount: number;
  onMarkAllAsRead: () => void;
  /** Live WebSocket status — drives the realtime "connected" indicator dot. */
  isConnected?: boolean;
};

const TABS: { key: TabType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI Assistant" },
  { key: "updates", label: "Updates" },
];

export default function NotificationTabs({
  activeTab,
  onTabChange,
  totalCount,
  unreadCount,
  onMarkAllAsRead,
  isConnected = false,
}: NotificationTabsProps) {
  return (
    <View className="px-4 border-b border-zinc-800">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {/* Realtime connection indicator (live = green). */}
          <View
            className={`w-2 h-2 rounded-full mr-3 ${
              isConnected ? "bg-green-500" : "bg-gray-600"
            }`}
          />
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => onTabChange(tab.key)}
                className="mr-5 py-3"
              >
                <View className="flex-row items-center">
                  <Text
                    className={`text-sm font-semibold ${
                      active ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {tab.key === "all" && totalCount > 0 && (
                    <View className="ml-1.5 px-1.5 rounded bg-[#FFCC00] min-w-[20px] items-center">
                      <Text className="text-black text-xs font-bold">
                        {totalCount}
                      </Text>
                    </View>
                  )}
                </View>
                {active && (
                  <View className="h-0.5 bg-[#FFCC00] rounded-full mt-2" />
                )}
              </Pressable>
            );
          })}
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={onMarkAllAsRead}
            className="flex-row items-center px-3 py-1.5 rounded-full bg-zinc-800"
          >
            <Ionicons name="checkmark-done" color="#FFCC00" size={16} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
