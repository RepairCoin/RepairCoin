'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

export const NotificationDebug = () => {
  const { userProfile } = useAuthStore();
  const { notifications, unreadCount, isConnected } = useNotificationStore();
  const [localStorageTokens, setLocalStorageTokens] = useState<any>({});

  useEffect(() => {
    // Check localStorage tokens
    const tokens = {
      customerToken: localStorage.getItem('customerAuthToken'),
      shopToken: localStorage.getItem('shopAuthToken'),
      adminToken: localStorage.getItem('adminAuthToken'),
      genericToken: localStorage.getItem('token'),
    };
    setLocalStorageTokens(tokens);

    console.log('🔍 Notification Debug Info:', {
      hasUserProfile: !!userProfile,
      userAddress: userProfile?.address,
      userType: userProfile?.type,
      hasTokenInProfile: !!userProfile?.token,
      tokenInProfile: userProfile?.token?.substring(0, 20) + '...',
      localStorageTokens: tokens,
      notificationsCount: notifications.length,
      unreadCount,
      isWebSocketConnected: isConnected,
    });
  }, [userProfile, notifications, unreadCount, isConnected]);

  if (process.env.NODE_ENV !== 'development') return null;

  const hasAnyToken = !!(
    localStorageTokens.customerToken ||
    localStorageTokens.shopToken ||
    localStorageTokens.adminToken ||
    localStorageTokens.genericToken ||
    userProfile?.token
  );

  // Try to extract wallet from token
  const extractWalletFromToken = () => {
    const token = localStorageTokens.customerToken || localStorageTokens.shopToken || localStorageTokens.adminToken || localStorageTokens.genericToken;
    if (token) {
      try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded.address || decoded.walletAddress || decoded.wallet_address || null;
      } catch (error) {
        return null;
      }
    }
    return null;
  };

  const walletFromToken = extractWalletFromToken();

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">🔍 Notification Debug</h3>
      <div className="space-y-1">
        <div>Address in Profile: {userProfile?.address ? `${userProfile.address.substring(0, 10)}...` : '❌ Missing'}</div>
        <div>Address in Token: {walletFromToken ? `${walletFromToken.substring(0, 10)}...` : '❌ Missing'}</div>
        <div>Type: {userProfile?.type || 'Unknown'}</div>
        <div>Token in Profile: {userProfile?.token ? '✅ Set' : '❌ Missing'}</div>
        <div className="border-t border-gray-600 pt-1 mt-1">
          <div className="font-semibold">localStorage Tokens:</div>
          <div className="ml-2">
            <div>customer: {localStorageTokens.customerToken ? '✅' : '❌'}</div>
            <div>shop: {localStorageTokens.shopToken ? '✅' : '❌'}</div>
            <div>admin: {localStorageTokens.adminToken ? '✅' : '❌'}</div>
            <div>generic: {localStorageTokens.genericToken ? '✅' : '❌'}</div>
          </div>
        </div>
        <div className="border-t border-gray-600 pt-1 mt-1">
          <div>Any Token Available: {hasAnyToken ? '✅ Yes' : '❌ No'}</div>
          <div>Notifications: {notifications.length}</div>
          <div>Unread: {unreadCount}</div>
          <div>WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
        </div>
      </div>
    </div>
  );
};
