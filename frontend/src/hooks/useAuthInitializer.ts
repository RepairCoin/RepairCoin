'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';

/**
 * NOTE: We cannot reliably check for httpOnly cookies client-side because
 * they're invisible to document.cookie for security. Instead, we always
 * attempt the session check and let the backend tell us if we have valid cookies.
 * This is a cheap operation and the correct way to handle httpOnly cookies.
 */

/**
 * SINGLE GLOBAL AUTHENTICATION INITIALIZER
 *
 * This hook should ONLY be used ONCE in the app (in the root provider).
 * It listens to account changes and triggers login/logout centrally.
 *
 * IMPORTANT: Only creates new session on actual wallet connection change,
 * NOT on page refresh or navigation. Uses existing refresh token for persistence.
 *
 * DO NOT use this hook in multiple places - it will cause duplicate logins.
 */
export function useAuthInitializer() {
  const account = useActiveAccount();
  const { login, logout, setAccount, setUserProfile, setAuthInitialized } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const sessionCheckedRef = useRef(false); // Track if we already checked for session

  useEffect(() => {
    const currentAddress = account?.address;
    const previousAddress = previousAddressRef.current;

    const initializeAuth = async () => {
      // Check for existing session on mount ONLY if we're on a protected route
      // This avoids unnecessary 401 errors on public pages
      if (!isInitializedRef.current && !currentAddress) {
        const isProtectedRoute = typeof window !== 'undefined' &&
          (window.location.pathname.startsWith('/shop') ||
           window.location.pathname.startsWith('/customer') ||
           window.location.pathname.startsWith('/admin'));

        if (isProtectedRoute) {
          console.log('[AuthInitializer] 🔍 Checking for existing session on protected route...');
          sessionCheckedRef.current = true; // Mark that we checked for session
          try {
            const session = await authApi.getSession();
            console.log('[AuthInitializer] Session check result (pre-wallet):', session);

            if (session.isValid && session.user) {
              console.log('[AuthInitializer] ✅ Valid session found before wallet connection');
              const userData = session.user as any;
              const profile = {
                id: userData.id,
                address: userData.address || userData.walletAddress,
                type: userData.type || userData.role as 'customer' | 'shop' | 'admin',
                name: userData.name || userData.shopName,
                email: userData.email,
                isActive: userData.active !== false,
                tier: userData.tier,
                shopId: userData.shopId,
                registrationDate: userData.createdAt || userData.created_at,
              };

              setUserProfile(profile);
              setAuthInitialized(true); // Mark auth as initialized
              isInitializedRef.current = true;
              return;
            }
          } catch (error: any) {
            console.log('[AuthInitializer] No session found on protected route');
          }
        } else {
          console.log('[AuthInitializer] Public route - skipping session check, waiting for wallet');
          sessionCheckedRef.current = true; // Mark that we already determined there's no session
        }
        // If we get here, no session was found or not a protected route - mark as initialized anyway
        setAuthInitialized(true);
      }

      // Only process actual wallet address changes
      if (currentAddress === previousAddress) {
        return;
      }

      if (currentAddress) {
        // User connected wallet - check if session already exists
        console.log('[AuthInitializer] Account connected:', currentAddress);
        setAccount(account);

        // Only check for existing session if we haven't already determined there isn't one
        // This prevents unnecessary 401 errors when connecting wallet on public pages
        if (!sessionCheckedRef.current) {
          // ALWAYS check for existing session first before creating new one
          // The httpOnly cookies are sent automatically with the request via withCredentials
          // We cannot detect them client-side, so we must always try the session check
          try {
            console.log('[AuthInitializer] 🔍 Checking for existing session (cookies sent automatically)...');
            const session = await authApi.getSession();
            console.log('[AuthInitializer] Session check result:', session);

            if (session.isValid && session.user) {
              console.log('[AuthInitializer] ✅ Valid session found, restoring state without new login');

              // Restore user profile from existing session
              // Session user has extended properties beyond the basic User type
              const userData = session.user as any;
              const profile = {
                id: userData.id,
                address: userData.address || userData.walletAddress || currentAddress,
                type: userData.type || userData.role as 'customer' | 'shop' | 'admin',
                name: userData.name || userData.shopName,
                email: userData.email,
                isActive: userData.active !== false,
                tier: userData.tier,
                shopId: userData.shopId,
                registrationDate: userData.createdAt || userData.created_at,
              };

              setUserProfile(profile);
              setAuthInitialized(true); // Mark auth as initialized
              isInitializedRef.current = true;
              return; // Don't call login() - we already have a valid session
            }

            console.log('[AuthInitializer] Session invalid or not found, creating new session');
          } catch (error: any) {
            // Session check failed - could be:
            // 1. No cookies (first time)
            // 2. Expired cookies (need new login)
            // 3. Network error
            console.log('[AuthInitializer] Session check failed:', error?.message || error);

            // Check if this is a token refresh error vs a "no session" error
            const is401 = error?.response?.status === 401 || error?.status === 401;

            if (is401) {
              console.log('[AuthInitializer] No valid session - will create new one');
            } else {
              console.warn('[AuthInitializer] Unexpected error checking session:', error);
            }
          }
        } else {
          console.log('[AuthInitializer] ⏭️ Skipping redundant session check (already checked on page load)');
        }

        // No valid session found - create a new one
        // This is safe because it only happens on initial wallet connection, not on every refresh
        console.log('[AuthInitializer] 🚀 Creating new session via login()');
        await login(currentAddress);
        console.log('[AuthInitializer] ✅ Login completed');
        setAuthInitialized(true); // Mark auth as initialized
        isInitializedRef.current = true;
      } else if (previousAddress) {
        // User disconnected wallet (only logout if we were previously connected)
        console.log('[AuthInitializer] Account disconnected:', previousAddress);
        logout();
        setAuthInitialized(false); // Reset on logout
        isInitializedRef.current = false;
      }
      // else: initial load with no wallet - do nothing
    };

    initializeAuth();

    // Update ref for next comparison
    previousAddressRef.current = currentAddress || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  return null;
}
