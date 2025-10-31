import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Notification {
  id: string;
  senderAddress: string;
  receiverAddress: string;
  notificationType: string;
  message: string;
  metadata: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationState {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      isConnected: false,

      // Actions
      setNotifications: (notifications) =>
        set((state) => ({
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
        })),

      addNotification: (notification) =>
        set((state) => {
          // Avoid duplicates
          const exists = state.notifications.some((n) => n.id === notification.id);
          if (exists) return state;

          return {
            notifications: [notification, ...state.notifications],
            unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
          };
        }),

      markAsRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(
            0,
            state.notifications.find((n) => n.id === notificationId && !n.isRead)
              ? state.unreadCount - 1
              : state.unreadCount
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        })),

      removeNotification: (notificationId) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === notificationId);
          return {
            notifications: state.notifications.filter((n) => n.id !== notificationId),
            unreadCount:
              notification && !notification.isRead
                ? Math.max(0, state.unreadCount - 1)
                : state.unreadCount,
          };
        }),

      clearNotifications: () =>
        set({
          notifications: [],
          unreadCount: 0,
        }),

      setUnreadCount: (count) =>
        set({
          unreadCount: count,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      setError: (error) =>
        set({
          error,
        }),

      setConnected: (connected) =>
        set({
          isConnected: connected,
        }),
    }),
    { name: 'NotificationStore' }
  )
);
