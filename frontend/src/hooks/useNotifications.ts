import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import apiClient from '@/services/api/client';

// Use NEXT_PUBLIC_API_URL and extract base URL by removing /api suffix
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const BACKEND_URL = API_URL.replace(/\/api$/, ''); // Remove /api suffix to get base URL
const WS_URL = BACKEND_URL.replace(/^http/, 'ws');

export const useNotifications = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manuallyClosedRef = useRef(false); // Track if we manually closed due to auth errors
  const maxReconnectAttempts = 5;

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
  } = useNotificationStore();

  const { userProfile, isAuthenticated } = useAuthStore();

  // Fetch initial notifications from API (uses cookies automatically)
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ items: any[]; total: number }>('/notifications', {
        params: {
          page: 1,
          limit: 50,
        },
      });

      // apiClient already returns response.data, so response is the unwrapped data
      setNotifications(response.data.items || []);
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
      const response = await apiClient.get<{ count: number }>('/notifications/unread/count');
      // apiClient already returns response.data, so response is the unwrapped data
      setUnreadCount(response.data.count || 0);
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

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!userProfile?.address || !isAuthenticated) {
      console.log('Cannot connect to WebSocket: user not authenticated');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('🔌 Connecting to WebSocket for wallet:', userProfile.address);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected - waiting for auto-authentication from cookie');
        reconnectAttemptsRef.current = 0;
        manuallyClosedRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('🤝 WebSocket handshake complete');
              break;

            case 'authenticated':
              console.log('🔐 WebSocket authenticated for:', message.payload.walletAddress, '(via', message.payload.source + ')');
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
              // Heartbeat response
              break;

            default:
              console.warn('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setConnected(false);

        // Don't show error or try to reconnect if we manually closed due to auth issues
        if (manuallyClosedRef.current) {
          manuallyClosedRef.current = false; // Reset flag
          return;
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          setError('Failed to connect to notification server');
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
    }
  }, [userProfile, isAuthenticated, addNotification, setConnected, setError]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

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
    console.log('🔔 useNotifications effect triggered', {
      isAuthenticated,
      hasUserProfile: !!userProfile,
      walletAddress: userProfile?.address,
      userType: userProfile?.type,
      currentConnectionState: wsRef.current?.readyState,
    });

    if (isAuthenticated && userProfile?.address) {
      // Only connect if we don't already have an open or connecting WebSocket
      const currentState = wsRef.current?.readyState;
      const isConnectedOrConnecting = currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING;

      if (!isConnectedOrConnecting) {
        console.log('✅ Authenticated user detected - Fetching notifications and connecting WebSocket...');
        fetchNotifications();
        fetchUnreadCount();
        connectWebSocket();
      } else {
        console.log('ℹ️ WebSocket already connected/connecting');
      }
    } else {
      console.log('❌ NOT CONNECTING - User not authenticated or profile missing');
      // Disconnect if user logged out
      if (!isAuthenticated) {
        disconnectWebSocket();
      }
    }

    return () => {
      // Clean up on unmount only if user is not authenticated
      if (!isAuthenticated) {
        disconnectWebSocket();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userProfile?.address]);

  return {
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission,
    connectWebSocket,
    disconnectWebSocket,
  };
};
