'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { authApi } from '@/services/api/auth';

/**
 * Automatic Token Refresh Hook
 *
 * NOTE: This hook is now mostly handled by the API client's interceptor,
 * which automatically refreshes tokens on 401 errors. This hook serves as
 * a backup to check session validity periodically.
 *
 * IMPORTANT: We cannot read httpOnly cookies from JavaScript - that's the
 * security feature! Instead, we check session validity via API call.
 *
 * This hook should be used ONCE at the app root (in AuthProvider).
 */
export function useTokenRefresh() {
  const toastIdRef = useRef<string | null>(null);
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    const checkSessionValidity = async () => {
      try {
        // Check if we've checked recently (avoid hammering the API)
        const now = Date.now();
        if (now - lastCheckRef.current < 60000) {
          // Skip if we checked less than 1 minute ago
          return;
        }
        lastCheckRef.current = now;

        // Verify session is still valid by making an API call
        // The interceptor in client.ts will automatically refresh if needed
        const sessionData = await authApi.getSession();

        if (!sessionData.isValid) {
          console.log('[useTokenRefresh] Session is no longer valid');
          // Session expired and refresh failed - handled by interceptor
          return;
        }

        console.log('[useTokenRefresh] Session is valid');
      } catch (error) {
        // Error is already handled by the API interceptor
        // Only log for debugging
        console.error('[useTokenRefresh] Session check failed:', error);
      }
    };

    // Check immediately on mount
    checkSessionValidity();

    // Then check every 5 minutes (less aggressive since interceptor handles it)
    const interval = setInterval(checkSessionValidity, 5 * 60000);

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
