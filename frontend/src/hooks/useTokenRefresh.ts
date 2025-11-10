'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { authApi } from '@/services/api/auth';

/**
 * Automatic Token Refresh Hook
 *
 * Monitors token expiration and automatically refreshes before expiry.
 * Shows warnings to user when token is about to expire.
 *
 * This hook should be used ONCE at the app root (in AuthProvider).
 */
export function useTokenRefresh() {
  const toastIdRef = useRef<string | null>(null);
  const lastWarningRef = useRef<number>(0);

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      try {
        // Get auth token from cookie
        const cookieMatch = document.cookie.match(/auth_token=([^;]+)/);
        if (!cookieMatch) {
          // No token, user not authenticated
          return;
        }

        const token = cookieMatch[1];

        // Parse JWT to get expiration time
        let payload: any;
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          payload = JSON.parse(jsonPayload);
        } catch (error) {
          console.error('[useTokenRefresh] Failed to parse JWT:', error);
          return;
        }

        if (!payload.exp) {
          console.error('[useTokenRefresh] Token has no expiration');
          return;
        }

        const expiresAt = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;

        // Log token status (for debugging)
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
        console.log(`[useTokenRefresh] Token expires in ${minutesUntilExpiry} minutes`);

        // Show warning 10 minutes before expiry (once)
        if (timeUntilExpiry < 10 * 60 * 1000 && timeUntilExpiry > 5 * 60 * 1000) {
          const now = Date.now();
          // Only show warning once per 5 minutes to avoid spam
          if (now - lastWarningRef.current > 5 * 60 * 1000) {
            lastWarningRef.current = now;
            toast('Your session will expire soon. We\'ll refresh it automatically.', {
              icon: '⏰',
              duration: 4000,
              position: 'top-right',
            });
          }
        }

        // Auto-refresh 5 minutes before expiry
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('[useTokenRefresh] Token expiring soon, refreshing...');

          const success = await authApi.refreshToken();

          if (success) {
            console.log('[useTokenRefresh] ✅ Token refreshed successfully');
            toast.success('Session refreshed automatically', {
              duration: 2000,
              position: 'top-right',
            });
          } else {
            console.error('[useTokenRefresh] ❌ Token refresh failed');
            toast.error('Session refresh failed. Please re-login.', {
              duration: 5000,
              position: 'top-right',
            });
          }
        }

        // Show urgent warning 2 minutes before expiry
        if (timeUntilExpiry < 2 * 60 * 1000 && timeUntilExpiry > 0) {
          // Dismiss previous toast if exists
          if (toastIdRef.current) {
            toast.dismiss(toastIdRef.current);
          }

          toastIdRef.current = toast.error(
            'Your session is expiring soon! Please save your work.',
            {
              duration: 60000, // Show for 1 minute
              position: 'top-right',
            }
          ) as string;
        }
      } catch (error) {
        console.error('[useTokenRefresh] Error in token refresh check:', error);
      }
    };

    // Check immediately on mount
    checkAndRefreshToken();

    // Then check every minute
    const interval = setInterval(checkAndRefreshToken, 60000);

    return () => {
      clearInterval(interval);
      // Clean up toast on unmount
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  return null;
}
