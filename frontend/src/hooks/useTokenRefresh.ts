// frontend/src/hooks/useTokenRefresh.ts
import { useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * Hook to automatically refresh access tokens before they expire
 *
 * This hook:
 * - Checks token expiry every minute
 * - Automatically refreshes tokens 2 minutes before expiry
 * - Prevents multiple simultaneous refresh requests
 * - Handles errors gracefully
 *
 * Usage: Call this hook in your main app component or auth context
 */
export function useTokenRefresh() {
  const refreshInProgressRef = useRef(false);

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      // Skip if already refreshing
      if (refreshInProgressRef.current) {
        return;
      }

      // Skip if not in browser
      if (typeof document === 'undefined') {
        return;
      }

      try {
        // Extract access token from cookie
        const cookies = document.cookie.split(';');
        const authCookie = cookies.find(cookie =>
          cookie.trim().startsWith('auth_token=')
        );

        if (!authCookie) {
          // No auth token, user not logged in
          return;
        }

        const token = authCookie.split('=')[1];
        if (!token) {
          return;
        }

        // Decode JWT to get expiration time
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.warn('[useTokenRefresh] Invalid token format');
          return;
        }

        try {
          const payload = JSON.parse(atob(parts[1]));

          if (!payload.exp) {
            console.warn('[useTokenRefresh] Token missing expiration');
            return;
          }

          // Calculate time until expiry
          const expiresAt = payload.exp * 1000; // Convert to milliseconds
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;

          // Refresh 2 minutes (120 seconds) before expiry
          const REFRESH_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds

          if (timeUntilExpiry < REFRESH_THRESHOLD && timeUntilExpiry > 0) {
            console.log(`[useTokenRefresh] Token expiring in ${Math.round(timeUntilExpiry / 1000)}s, refreshing...`);

            refreshInProgressRef.current = true;

            // Call refresh endpoint
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/refresh`,
              {},
              { withCredentials: true }
            );

            console.log('[useTokenRefresh] Token refreshed successfully');
            refreshInProgressRef.current = false;
          } else if (timeUntilExpiry <= 0) {
            console.log('[useTokenRefresh] Token already expired, will be handled by interceptor');
          }
        } catch (decodeError) {
          console.error('[useTokenRefresh] Error decoding token:', decodeError);
        }
      } catch (error) {
        refreshInProgressRef.current = false;
        console.error('[useTokenRefresh] Error refreshing token:', error);
        // Don't redirect here, let the axios interceptor handle it
      }
    };

    // Check immediately on mount
    checkAndRefreshToken();

    // Then check every minute
    const interval = setInterval(checkAndRefreshToken, 60 * 1000); // 60 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);
}
