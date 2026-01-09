import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { notificationApi } from "@/services/notification.services";
import { Notification } from "@/interfaces/notification.interface";
import { NotificationCard } from "../components";
import { AppHeader } from "@/components/ui/AppHeader";
import { usePushNotificationContext } from "@/providers/PushNotificationProvider";

type TabType = "unread" | "all";

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("unread");
  const [showMenu, setShowMenu] = useState(false);

  const { unregisterPushNotifications, registerForPushNotifications, isRegistered } = usePushNotificationContext();

  const handleTurnOffNotifications = () => {
    setShowMenu(false);
    Alert.alert(
      "Turn Off Notifications",
      "Are you sure you want to turn off push notifications? You won't receive any notifications until you turn them back on.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn Off",
          style: "destructive",
          onPress: async () => {
            await unregisterPushNotifications();
            Alert.alert("Success", "Push notifications have been turned off.");
          },
        },
      ]
    );
  };

  const handleTurnOnNotifications = async () => {
    setShowMenu(false);
    const token = await registerForPushNotifications();
    if (token) {
      Alert.alert("Success", "Push notifications have been turned on.");
    } else {
      Alert.alert(
        "Permission Required",
        "Please enable notifications in your device settings to receive push notifications."
      );
    }
  };

  const fetchNotifications = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await notificationApi.getNotifications(pageNum, 10);

      if (pageNum === 1) {
        setNotifications(response.items || []);
      } else {
        setNotifications((prev) => [...prev, ...(response.items || [])]);
      }

      setHasMore(response.pagination?.hasMore || false);
      setPage(pageNum);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleRefresh = () => {
    fetchNotifications(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      try {
        await notificationApi.markAsRead(notification.id);
        setNotifications((prev) =>
          (prev || []).map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => (prev || []).map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  // Filter notifications based on active tab
  const filteredNotifications = activeTab === "unread"
    ? (notifications || []).filter((n) => !n.isRead)
    : notifications || [];

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="notifications-off-outline" size={64} color="#666" />
      <Text className="text-zinc-400 text-lg mt-4">
        {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
      </Text>
      <Text className="text-zinc-600 text-sm mt-2 text-center px-8">
        {activeTab === "unread"
          ? "You're all caught up!"
          : "When you receive rewards, bookings, or updates, they'll appear here"}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator color="#FFCC00" />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="w-full h-full bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <View className="w-full h-full bg-zinc-950">
      {/* Header */}
      <AppHeader
        title="Notifications"
        rightElement={
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            className="p-2"
          >
            <Ionicons name="ellipsis-vertical" size={20} color="white" />
          </TouchableOpacity>
        }
      />

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={() => setShowMenu(false)}
        >
          <View className="absolute top-24 right-4 bg-zinc-800 rounded-xl overflow-hidden min-w-[200px]">
            <TouchableOpacity
              onPress={isRegistered ? handleTurnOffNotifications : handleTurnOnNotifications}
              className="flex-row items-center px-4 py-3"
            >
              <Ionicons
                name={isRegistered ? "notifications-off-outline" : "notifications-outline"}
                size={20}
                color={isRegistered ? "#EF4444" : "#22C55E"}
              />
              <Text className={`ml-3 text-base ${isRegistered ? "text-red-400" : "text-green-400"}`}>
                {isRegistered ? "Turn off notifications" : "Turn on notifications"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Tabs and Mark All as Read */}
      <View className="px-4">
        <View className="flex-row justify-between items-center">
          {/* Tabs */}
          <View className="flex-row">
            <Pressable
              onPress={() => setActiveTab("unread")}
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
              onPress={() => setActiveTab("all")}
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
              onPress={handleMarkAllAsRead}
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

      {/* Notification List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 20,
          marginTop: 10
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
