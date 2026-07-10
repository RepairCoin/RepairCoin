import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { notificationApi } from "@/feature/notification/services/notification.services";
import { usePushNotificationContext } from "@/shared/providers/PushNotificationProvider";
import { useRealtime } from "@/shared/providers/RealtimeProvider";
import { realtimeEvents } from "@/shared/utilities/realtimeEvents";
import { useAppToast } from "@/shared/hooks";
import { Notification, TabType } from "../../types";
import { NOTIFICATIONS_PER_PAGE } from "@/shared/constants/notifications";
import {
  getNotificationCategory,
  groupNotificationsByDate,
} from "../../utils/notificationGrouping";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);

  const { showSuccess, showWarning } = useAppToast();

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
    // Open the detail modal (mirrors the web NotificationBell, which shows a
    // modal with the full notification instead of navigating away).
    setSelectedNotification({ ...notification, isRead: true });

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

  const handleCloseDetail = () => setSelectedNotification(null);

  const handleDeleteNotification = async (notificationId: string) => {
    // Optimistically remove, then sync with the server.
    setNotifications((prev) =>
      (prev || []).filter((n) => n.id !== notificationId)
    );
    try {
      await notificationApi.deleteNotification(notificationId);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      // Re-fetch to restore correct state if the delete failed.
      fetchNotifications(1, true);
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

  const { isConnected } = useRealtime();

  // Realtime: subscribe to `notification` broadcasts from the shared socket
  // (RealtimeProvider). Prepend each to the list, deduping by id (matches the
  // web client's addNotification) so the badge and list update live without a
  // refetch.
  useEffect(() => {
    return realtimeEvents.onNotification((incoming) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    });
  }, []);

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
            showSuccess("Push notifications have been turned off.");
          },
        },
      ]
    );
  };

  const handleTurnOnNotifications = async () => {
    setShowMenu(false);
    const token = await registerForPushNotifications();
    if (token) {
      showSuccess("Push notifications have been turned on.");
    } else {
      showWarning(
        "Please enable notifications in your device settings to receive push notifications."
      );
    }
  };

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;
  const totalCount = (notifications || []).length;

  const filteredNotifications =
    activeTab === "all"
      ? notifications || []
      : activeTab === "unread"
      ? (notifications || []).filter((n) => !n.isRead)
      : (notifications || []).filter(
          (n) => getNotificationCategory(n.notificationType) === activeTab
        );

  const sections = groupNotificationsByDate(filteredNotifications);

  return {
    notifications: filteredNotifications,
    sections,
    totalCount,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    activeTab,
    setActiveTab,
    showMenu,
    setShowMenu,
    selectedNotification,
    isRegistered,
    isConnected,
    unreadCount,
    handleRefresh,
    handleLoadMore,
    handleNotificationPress,
    handleCloseDetail,
    handleDeleteNotification,
    handleMarkAllAsRead,
    handleTurnOffNotifications,
    handleTurnOnNotifications,
  };
}
