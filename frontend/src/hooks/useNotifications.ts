import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore, Notification as NotificationType } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import apiClient from '@/services/api/client';
import { usePushSubscription } from './usePushSubscription';
import { getWebSocketUrl } from '@/utils/apiUrl';
import { setActiveSocket } from '@/utils/wsClient';

interface UseNotificationsOptions {
  enabled?: boolean;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manuallyClosedRef = useRef(false); // Track if we manually closed due to auth errors
  // Heartbeat refs (added 2026-05-08, fix-7 follow-up). Without these, the
  // socket can silently die — e.g., after a deploy restarts the WS server,
  // or after a backend idle-timeout — and the customer keeps a zombie
  // connection until they hard-refresh. Heartbeat detects zombies; the
  // forced close triggers our normal onclose → reconnect path.
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const HEARTBEAT_INTERVAL_MS = 25_000; // Send ping every 25s — beats most idle timeouts (typically 60-300s).
  const PONG_TIMEOUT_MS = 10_000; // Pong must arrive within 10s of ping or we treat the socket as dead.
  // Was 5 — too low. With exponential backoff capped at 30s, 5 attempts
  // is only ~1 minute of retry. A typical deploy can take 60-90s. Bumping
  // to 20 gives ~10 minutes of retry, which survives any realistic outage.
  const maxReconnectAttempts = 20;
  const { subscribeToPush, unsubscribeFromPush } = usePushSubscription();

  const {
    addNotification,
    setNotifications,
    setUnreadCount,
    setLoading,
    setError,
    setConnected,
    markAsRead: markAsReadInStore,
    markAllAsRead: markAllAsReadInStore,
    removeNotification: removeNotificationFromStore,
    clearNotifications: clearNotificationsFromStore,
  } = useNotificationStore();

  const { userProfile, isAuthenticated, switchingAccount } = useAuthStore();

  // Fetch initial notifications from API (uses cookies automatically)
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.address) return;

    setLoading(true);
    setError(null);

    try {
      // apiClient interceptor returns response.data directly
      const data = await apiClient.get('/notifications', {
        params: {
          page: 1,
          limit: 50,
        },
      }) as { items: NotificationType[]; total: number };

      setNotifications(data.items || []);
    } catch (error: unknown) {
      // Don't log 401 errors - these are expected when user isn't authenticated
      const err = error as { response?: { status?: number }; message?: string };
      if (err.response?.status !== 401) {
        console.error('Failed to fetch notifications:', error);
        setError(err.message || 'Failed to fetch notifications');
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile?.address, setNotifications, setLoading, setError]);

  // Fetch unread count (uses cookies automatically)
  const fetchUnreadCount = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      // apiClient interceptor returns response.data directly
      const data = await apiClient.get('/notifications/unread/count') as { count: number };
      setUnreadCount(data.count || 0);
    } catch (error: unknown) {
      // Don't log 401 errors - these are expected when user isn't authenticated
      const err = error as { response?: { status?: number } };
      if (err.response?.status !== 401) {
        console.error('Failed to fetch unread count:', error);
      }
    }
  }, [userProfile?.address, setUnreadCount]);

  // Mark notification as read (uses cookies automatically)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userProfile?.address) return;

      try {
        await apiClient.patch(`/notifications/${notificationId}/read`);
        markAsReadInStore(notificationId);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [userProfile?.address, markAsReadInStore]
  );

  // Mark all notifications as read (uses cookies automatically)
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      await apiClient.patch('/notifications/read-all');
      markAllAsReadInStore();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [userProfile?.address, markAllAsReadInStore]);

  // Delete notification (uses cookies automatically)
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!userProfile?.address) return;

      try {
        await apiClient.delete(`/notifications/${notificationId}`);
        removeNotificationFromStore(notificationId);
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
    [userProfile?.address, removeNotificationFromStore]
  );

  // Delete all notifications (uses cookies automatically)
  const deleteAllNotifications = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      await apiClient.delete('/notifications');
      clearNotificationsFromStore();
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  }, [userProfile?.address, clearNotificationsFromStore, setUnreadCount]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    // Don't connect if notifications are disabled (e.g., for admin users)
    if (!enabled) {
      return;
    }

    // CRITICAL: Only connect if user is fully authenticated
    // userProfile is only set after successful backend authentication
    // This ensures cookies are present (we can't check them directly due to httpOnly)
    if (!userProfile?.address || !isAuthenticated) {
      console.log('Cannot connect to WebSocket: user not authenticated');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log('🔌 Connecting to WebSocket with authentication cookies...');
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        manuallyClosedRef.current = false;
        setActiveSocket(ws);

        // Start the heartbeat. Each tick: send ping, arm pong timeout.
        // If pong arrives → cleared in the 'pong' case. If not → socket
        // is treated as zombie and force-closed, which triggers reconnect.
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          try {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          } catch {
            // Send threw → socket is broken; let onclose handle reconnect.
            return;
          }
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = setTimeout(() => {
            console.log("⚠️ WebSocket heartbeat timeout — closing zombie connection");
            wsRef.current?.close();
          }, PONG_TIMEOUT_MS);
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              break;

            case 'authenticated':
              setConnected(true);
              break;

            case 'notification':
              console.log('New notification received:', message.payload);
              addNotification(message.payload);

              // Show browser notification if permitted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('RepairCoin', {
                  body: message.payload.message,
                  icon: '/logo.png',
                });
              }

              // Companion DOM events for count-driven UI
              if (typeof window !== 'undefined') {
                const notificationType = message.payload?.notificationType;
                if (
                  notificationType === 'reschedule_request_created' ||
                  notificationType === 'reschedule_request_expired'
                ) {
                  window.dispatchEvent(new CustomEvent('reschedule-count-changed'));
                }
              }
              break;

            case 'error':
              // Handle authentication errors gracefully (expired tokens, etc.)
              const payload = message.payload || {};
              const errorMsg = payload.error || payload.message || '';

              // Check if this is an authentication-related error
              const isAuthError = !errorMsg ||
                errorMsg.includes('expired') ||
                errorMsg.includes('invalid') ||
                errorMsg.includes('Token') ||
                errorMsg.includes('Authentication') ||
                errorMsg.includes('authentication');

              if (isAuthError) {
                console.log('🔄 WebSocket authentication issue - please refresh and log in again');
                // Mark as manually closed to prevent error messages
                manuallyClosedRef.current = true;
                // Prevent reconnection attempts by setting to max
                reconnectAttemptsRef.current = maxReconnectAttempts;
                // Close connection gracefully
                if (wsRef.current) {
                  wsRef.current.close();
                  wsRef.current = null;
                }
              } else {
                console.error('WebSocket error:', errorMsg);
                setError(errorMsg);
              }
              break;

            case 'pong':
              // Heartbeat response — clear the pong timeout so the watchdog
              // doesn't fire and force-close a healthy connection.
              if (pongTimeoutRef.current) {
                clearTimeout(pongTimeoutRef.current);
                pongTimeoutRef.current = null;
              }
              break;

            case 'subscription_status_changed':
              // Admin-specific event: shop subscription status changed (self-cancel/reactivate)
              console.log('📋 Subscription status changed:', message.payload);
              // Dispatch custom DOM event so admin components can refresh
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('subscription-status-changed', {
                  detail: message.payload
                }));
              }
              break;

            case 'shop_status_changed':
              // Shop suspended/unsuspended event
              console.log('🏪 Shop status changed:', message.payload);
              // Dispatch custom DOM event so shop components can refresh
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('shop-status-changed', {
                  detail: message.payload
                }));
              }
              break;

            case 'manual_booking_payment_completed':
              // Manual booking payment received (QR code or send_link)
              console.log('💳 Manual booking payment completed:', message.payload);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('manual-booking-paid', {
                  detail: message.payload
                }));
              }
              break;

            case 'message:new':
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('new-message-received', {
                  detail: message.payload
                }));
              }
              break;

            default:
              console.warn('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        // Don't log error for connection refused (WebSocket server not running)
        // This is expected in development when notification server isn't started
        console.log('ℹ️ WebSocket connection unavailable (notification server not running)');
        // Don't set error state for this - it's not critical
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', { code: event.code, reason: event.reason });
        setConnected(false);
        setActiveSocket(null);

        // Stop the heartbeat — a closed socket can't send pings, and a
        // pending pong timeout would force-close the (already-closed)
        // socket again on its next tick.
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }

        // Don't show error or try to reconnect if we manually closed due to auth issues
        if (manuallyClosedRef.current) {
          manuallyClosedRef.current = false; // Reset flag
          return;
        }

        // Reconnect on ANY non-manual close, including code 1006. The old
        // code bailed on 1006 thinking it meant "WS server not running",
        // but 1006 also fires for: backend deploy restarting the WS
        // server, network blip, tab throttling, idle timeout. In every
        // one of those, we want to reconnect — not give up forever.
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          console.log('ℹ️ Notification server unavailable after max retries — refresh to retry');
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
    }
  }, [enabled, userProfile, isAuthenticated, addNotification, setConnected, setError]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Clear heartbeat timers too, otherwise an orphan interval keeps
    // calling .send() on a null/closed socket (silent error spam).
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setActiveSocket(null);
    setConnected(false);
  }, [setConnected]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  }, []);

  // Initialize: fetch notifications and connect WebSocket
  useEffect(() => {
    // Don't initialize if notifications are disabled
    if (!enabled) {
      return;
    }

    if (switchingAccount) {
      disconnectWebSocket();
      return;
    }

    if (isAuthenticated && userProfile?.address) {
      // Only connect if we don't already have an open or connecting WebSocket
      const currentState = wsRef.current?.readyState;
      const isConnectedOrConnecting = currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING;

      if (!isConnectedOrConnecting) {
        fetchNotifications();
        fetchUnreadCount();
        connectWebSocket();
        subscribeToPush();
      }
    } else {
      // Disconnect if user logged out
      if (!isAuthenticated) {
        disconnectWebSocket();
        unsubscribeFromPush();
      }
    }

    return () => {
      // Clean up on unmount only if user is not authenticated
      if (!isAuthenticated) {
        disconnectWebSocket();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isAuthenticated, userProfile?.address, switchingAccount]);

  // Reconnect when the tab regains visibility. Browsers throttle (or
  // sometimes outright suspend) WebSockets in backgrounded tabs — when
  // the user comes back, the socket may be dead even though readyState
  // still reads OPEN. If we're not currently connected, kick a reconnect.
  // Also resets the reconnect attempt counter so a stale "we gave up"
  // state doesn't permanently block recovery.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isAuthenticated || !userProfile?.address) return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      console.log("👁️ Tab visible — reconnecting WebSocket");
      reconnectAttemptsRef.current = 0;
      connectWebSocket();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, isAuthenticated, userProfile?.address, connectWebSocket]);

  return {
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    requestNotificationPermission,
    connectWebSocket,
    disconnectWebSocket,
    subscribeToPush,
  };
};

/**
 * Hook that only provides notification action methods without initializing WebSocket
 * Use this in components that need to interact with notifications but don't need to manage the connection
 */
export const useNotificationActions = () => {
  const {
    markAsRead: markAsReadInStore,
    markAllAsRead: markAllAsReadInStore,
    removeNotification: removeNotificationFromStore,
    clearNotifications: clearNotificationsFromStore,
    setUnreadCount,
  } = useNotificationStore();

  const { userProfile } = useAuthStore();

  // Mark notification as read (uses cookies automatically)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userProfile?.address) return;

      try {
        await apiClient.patch(`/notifications/${notificationId}/read`);
        markAsReadInStore(notificationId);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [userProfile?.address, markAsReadInStore]
  );

  // Mark all notifications as read (uses cookies automatically)
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      await apiClient.patch('/notifications/read-all');
      markAllAsReadInStore();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [userProfile?.address, markAllAsReadInStore]);

  // Delete notification (uses cookies automatically)
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!userProfile?.address) return;

      try {
        await apiClient.delete(`/notifications/${notificationId}`);
        removeNotificationFromStore(notificationId);
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
    [userProfile?.address, removeNotificationFromStore]
  );

  // Delete all notifications (uses cookies automatically)
  const deleteAllNotifications = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      await apiClient.delete('/notifications');
      clearNotificationsFromStore();
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  }, [userProfile?.address, clearNotificationsFromStore, setUnreadCount]);

  return {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  };
};
