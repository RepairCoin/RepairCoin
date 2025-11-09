import { useEffect, useRef, useCallback, useState } from 'react';
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

  const { userProfile } = useAuthStore();

  // Token for WebSocket only (backend still returns it for WS use)
  const [token, setToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Update token and wallet address from userProfile
  useEffect(() => {
    // Get token from userProfile (backend still returns it in response for WS use)
    const wsToken = userProfile?.token || null;
    const address = userProfile?.address || null;

    setToken(prev => prev === wsToken ? prev : wsToken);
    setWalletAddress(prev => prev === address ? prev : address);

    if (wsToken) {
      console.log('✅ WebSocket token from userProfile');
    }

    if (address) {
      console.log('✅ Wallet address:', address);
    }
  }, [userProfile]);

  // Fetch initial notifications from API (uses cookies automatically)
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/notifications', {
        params: {
          page: 1,
          limit: 50,
        },
      });

      // apiClient already returns response.data, so response is the unwrapped data
      setNotifications(response.items || []);
    } catch (error: any) {
      // Don't log 401 errors - these are expected when user isn't authenticated
      if (error.response?.status !== 401) {
        console.error('Failed to fetch notifications:', error);
        setError(error.message || 'Failed to fetch notifications');
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile?.address, setNotifications, setLoading, setError]);

  // Fetch unread count (uses cookies automatically)
  const fetchUnreadCount = useCallback(async () => {
    if (!userProfile?.address) return;

    try {
      const response = await apiClient.get('/notifications/unread/count');
      // apiClient already returns response.data, so response is the unwrapped data
      setUnreadCount(response.count || 0);
    } catch (error: any) {
      // Don't log 401 errors - these are expected when user isn't authenticated
      if (error.response?.status !== 401) {
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
    if (!token || !walletAddress) {
      console.log('Cannot connect to WebSocket: missing token or wallet address');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket...');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;

        // Authenticate with the server
        ws.send(
          JSON.stringify({
            type: 'authenticate',
            payload: { token },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('WebSocket handshake complete');
              break;

            case 'authenticated':
              console.log('WebSocket authenticated for:', message.payload.walletAddress);
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
              console.error('WebSocket error message:', message.payload);
              setError(message.payload.error);
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
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          console.error('Max reconnection attempts reached');
          setError('Failed to connect to notification server');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
    }
  }, [token, walletAddress, addNotification, setConnected, setError]);

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
      hasToken: !!token,
      hasWalletAddress: !!walletAddress,
      walletAddress,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
      tokenLength: token?.length || 0,
      userProfileAddress: userProfile?.address,
      userProfileType: userProfile?.type,
      currentConnectionState: wsRef.current?.readyState,
    });

    if (token && walletAddress) {
      // Only connect if we don't already have an open or connecting WebSocket
      const currentState = wsRef.current?.readyState;
      const isConnectedOrConnecting = currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING;

      if (!isConnectedOrConnecting) {
        console.log('✅ CONDITIONS MET - Fetching notifications and connecting WebSocket...');
        fetchNotifications();
        fetchUnreadCount();
        connectWebSocket();
      } else {
        console.log('ℹ️ WebSocket already connected/connecting, skipping reconnection');
      }
    } else {
      console.log('❌ NOT CONNECTING - Reason:', {
        missingToken: !token,
        missingWalletAddress: !walletAddress,
      });
    }

    return () => {
      disconnectWebSocket();
    };
  }, [token, walletAddress]); // Only reconnect when token or address changes

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
