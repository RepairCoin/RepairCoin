'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';

/**
 * Smart Token Refresh Hook
 *
 * Instead of polling every N minutes, this hook:
 * 1. Gets the exact token expiry time from the backend
 * 2. Schedules a proactive refresh 1 minute before expiration
 * 3. Refreshes when user returns to the tab after being away
 * 4. Refreshes on user activity if the token is about to expire
 *
 * This is much more efficient than polling and prevents idle logout.
 *
 * IMPORTANT: This hook should be used ONCE at the app root (in AuthProvider).
 */
export function useTokenRefresh() {
  const account = useActiveAccount();
  const { isAuthenticated } = useAuthStore();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isRefreshingRef = useRef<boolean>(false);

  /**
   * Schedule a token refresh at a specific time
   */
  const scheduleRefresh = useCallback(async () => {
    try {
      // Skip if no wallet is connected - prevents 401 errors when not authenticated
      if (!account?.address) {
        console.log('[useTokenRefresh] No wallet connected, skipping session check');
        return;
      }

      // Skip if user is not authenticated yet - prevents 401 during initial login
      if (!isAuthenticated) {
        console.log('[useTokenRefresh] User not authenticated yet, skipping session check');
        return;
      }

      // Prevent multiple simultaneous refresh attempts
      if (isRefreshingRef.current) {
        console.log('[useTokenRefresh] Refresh already in progress, skipping');
        return;
      }

      console.log('[useTokenRefresh] Checking session to schedule refresh...');
      isRefreshingRef.current = true;

      // Get session info including expiry time
      const sessionData = await authApi.getSession();

      if (!sessionData.isValid || !sessionData.expiresAt) {
        console.log('[useTokenRefresh] No valid session or expiry time');
        isRefreshingRef.current = false;
        return;
      }

      const expiresAt = new Date(sessionData.expiresAt).getTime();
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh 1 minute (60 seconds) before expiry
      const REFRESH_BUFFER = 60 * 1000;
      const timeUntilRefresh = timeUntilExpiry - REFRESH_BUFFER;

      console.log('[useTokenRefresh] Token expires in', Math.floor(timeUntilExpiry / 1000), 'seconds');
      console.log('[useTokenRefresh] Will refresh in', Math.floor(timeUntilRefresh / 1000), 'seconds');

      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // If token is already expired or about to expire very soon, refresh immediately
      if (timeUntilRefresh <= 0) {
        console.log('[useTokenRefresh] Token expiring soon, refreshing immediately');
        await authApi.refreshToken();
        // Schedule the next refresh
        isRefreshingRef.current = false;
        scheduleRefresh();
        return;
      }

      // Schedule refresh before expiry
      refreshTimeoutRef.current = setTimeout(async () => {
        console.log('[useTokenRefresh] Proactively refreshing token before expiry');
        try {
          await authApi.refreshToken();
          // Schedule the next refresh after successful refresh
          isRefreshingRef.current = false;
          scheduleRefresh();
        } catch (error) {
          console.error('[useTokenRefresh] Failed to refresh token:', error);
          isRefreshingRef.current = false;
        }
      }, timeUntilRefresh);

      isRefreshingRef.current = false;
    } catch (error) {
      console.error('[useTokenRefresh] Error scheduling refresh:', error);
      isRefreshingRef.current = false;
    }
  }, [account?.address, isAuthenticated]);

  /**
   * Handle page visibility changes - refresh when user returns
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;

      // If user was away for more than 5 minutes, proactively refresh
      if (timeSinceLastActivity > 5 * 60 * 1000) {
        console.log('[useTokenRefresh] User returned after', Math.floor(timeSinceLastActivity / 1000), 'seconds away - refreshing');
        scheduleRefresh();
      }
    }
  }, [scheduleRefresh]);

  /**
   * Track user activity to update last activity time
   */
  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Initial schedule on mount
    scheduleRefresh();

    // Listen for visibility changes (user switching tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track user activity (mouse, keyboard)
    // This helps us know when the user is active
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      // Cleanup
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [scheduleRefresh, handleVisibilityChange, handleUserActivity]);

  return null;
}
