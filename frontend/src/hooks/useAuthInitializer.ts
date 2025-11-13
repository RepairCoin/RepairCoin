'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';

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
  const { login, logout, setAccount, setUserProfile, isAuthenticated } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const currentAddress = account?.address;
    const previousAddress = previousAddressRef.current;

    // Only process actual changes
    if (currentAddress === previousAddress) {
      return;
    }

    const initializeAuth = async () => {
      if (currentAddress) {
        // User connected wallet - check if session already exists
        console.log('[AuthInitializer] Account connected:', currentAddress);
        setAccount(account);

        // First check if we have a valid existing session (uses refresh token)
        try {
          console.log('[AuthInitializer] 🔍 Checking for existing session...');
          const session = await authApi.getSession();
          console.log('[AuthInitializer] Session check result:', session);

          if (session.isValid && session.user) {
            console.log('[AuthInitializer] Valid session found, restoring state without new login');

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
            isInitializedRef.current = true;
            return; // Don't call login() - we already have a valid session
          }

          console.log('[AuthInitializer] Session is not valid, will proceed with login');
        } catch (error) {
          console.log('[AuthInitializer] ❌ Session check failed, error:', error);
          console.log('[AuthInitializer] No valid session found, proceeding with login');
        }

        // No valid session - perform actual login (creates new refresh token)
        console.log('[AuthInitializer] 🚀 Creating new session via login()');
        await login(currentAddress);
        console.log('[AuthInitializer] ✅ Login completed');
        isInitializedRef.current = true;
      } else if (previousAddress) {
        // User disconnected wallet (only logout if we were previously connected)
        console.log('[AuthInitializer] Account disconnected:', previousAddress);
        logout();
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
