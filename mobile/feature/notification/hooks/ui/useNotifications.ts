import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { notificationApi } from "@/shared/services/notification.services";
import { usePushNotificationContext } from "@/shared/providers/PushNotificationProvider";
import { Notification, TabType } from "../../types";
import { NOTIFICATIONS_PER_PAGE } from "../../constants";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("unread");
  const [showMenu, setShowMenu] = useState(false);

  const {
    unregisterPushNotifications,
    registerForPushNotifications,
    isRegistered,
  } = usePushNotificationContext();

  const fetchNotifications = useCallback(
    async (pageNum: number = 1, refresh: boolean = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else if (pageNum === 1) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const response = await notificationApi.getNotifications(
          pageNum,
          NOTIFICATIONS_PER_PAGE
        );

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
    },
    []
  );

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

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  const filteredNotifications =
    activeTab === "unread"
      ? (notifications || []).filter((n) => !n.isRead)
      : notifications || [];

  return {
    notifications: filteredNotifications,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    activeTab,
    setActiveTab,
    showMenu,
    setShowMenu,
    isRegistered,
    unreadCount,
    handleRefresh,
    handleLoadMore,
    handleNotificationPress,
    handleMarkAllAsRead,
    handleTurnOffNotifications,
    handleTurnOnNotifications,
  };
}
