import { useEffect, useRef, useCallback, useState } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
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

  // Use state to track token from localStorage (more reliable than userProfile.token)
  const [token, setToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Update token and wallet address whenever userProfile changes or component mounts
  useEffect(() => {
    const getToken = () => {
      // First check userProfile
      if (userProfile?.token) {
        console.log('🔑 Token found in userProfile');
        return userProfile.token;
      }

      // Check localStorage for any auth token
      const customerToken = localStorage.getItem('customerAuthToken');
      const shopToken = localStorage.getItem('shopAuthToken');
      const adminToken = localStorage.getItem('adminAuthToken');
      const genericToken = localStorage.getItem('token');

      console.log('🔍 Checking localStorage for tokens:', {
        customerToken: customerToken ? '✅ Found' : '❌ Missing',
        shopToken: shopToken ? '✅ Found' : '❌ Missing',
        adminToken: adminToken ? '✅ Found' : '❌ Missing',
        genericToken: genericToken ? '✅ Found' : '❌ Missing',
      });

      return customerToken || shopToken || adminToken || genericToken || null;
    };

    const getWalletAddress = () => {
      // First check userProfile
      if (userProfile?.address) {
        console.log('👛 Wallet address found in userProfile:', userProfile.address);
        return userProfile.address;
      }

      // Try to extract from token if available
      const foundToken = token || getToken();
      if (foundToken) {
        try {
          // Decode JWT to get wallet address
          const payload = foundToken.split('.')[1];
          const decoded = JSON.parse(atob(payload));
          const address = decoded.address || decoded.walletAddress || decoded.wallet_address;
          if (address) {
            console.log('👛 Wallet address extracted from token:', address);
            return address;
          }
        } catch (error) {
          console.error('Failed to decode token for wallet address:', error);
        }
      }

      console.warn('⚠️ No wallet address found in userProfile or token');
      return null;
    };

    const foundToken = getToken();
    const foundAddress = getWalletAddress();

    setToken(foundToken);
    setWalletAddress(foundAddress);

    if (foundToken) {
      console.log('✅ Token set successfully');
    } else {
      console.warn('⚠️ No token found in userProfile or localStorage');
    }

    if (foundAddress) {
      console.log('✅ Wallet address set successfully');
    } else {
      console.warn('⚠️ No wallet address found');
    }
  }, [userProfile, token]);

  // Fetch initial notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${BACKEND_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page: 1,
          limit: 50,
        },
      });

      setNotifications(response.data.items || []);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      setError(error.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [token, setNotifications, setLoading, setError]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${BACKEND_URL}/api/notifications/unread/count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [token, setUnreadCount]);

  // Mark notification as read (API call)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!token) return;

      try {
        await axios.patch(
          `${BACKEND_URL}/api/notifications/${notificationId}/read`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        markAsReadInStore(notificationId);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [token, markAsReadInStore]
  );

  // Mark all notifications as read (API call)
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/read-all`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      markAllAsReadInStore();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [token, markAllAsReadInStore]);

  // Delete notification (API call)
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!token) return;

      try {
        await axios.delete(`${BACKEND_URL}/api/notifications/${notificationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        removeNotificationFromStore(notificationId);
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
    [token, removeNotificationFromStore]
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
    });

    if (token && walletAddress) {
      console.log('✅ CONDITIONS MET - Fetching notifications and connecting WebSocket...');
      fetchNotifications();
      fetchUnreadCount();
      connectWebSocket();
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
