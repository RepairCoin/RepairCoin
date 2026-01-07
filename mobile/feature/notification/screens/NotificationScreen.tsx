import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { notificationApi } from "@/services/notification.services";
import { Notification } from "@/interfaces/notification.interface";
import { NotificationCard } from "../components";

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="notifications-off-outline" size={64} color="#666" />
      <Text className="text-zinc-400 text-lg mt-4">No notifications yet</Text>
      <Text className="text-zinc-600 text-sm mt-2 text-center px-8">
        When you receive rewards, bookings, or updates, they'll appear here
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
      <View className="pt-16 px-4 pb-4">
        <View className="flex-row justify-between items-center">
          <Pressable onPress={goBack} className="p-2 -ml-2">
            <AntDesign name="left" color="white" size={18} />
          </Pressable>
          <Text className="text-white text-xl font-bold">Notifications</Text>
          {unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllAsRead} className="p-2 -mr-2">
              <Ionicons name="checkmark-done" color="#FFCC00" size={22} />
            </Pressable>
          ) : (
            <View className="w-[30px]" />
          )}
        </View>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <View className="flex-row items-center mt-3">
            <View className="bg-yellow-500/20 px-3 py-1 rounded-full">
              <Text className="text-yellow-500 text-xs font-medium">
                {unreadCount} unread
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications || []}
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
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
