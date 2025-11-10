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
          const session = await authApi.getSession();

          if (session.isValid && session.user) {
            console.log('[AuthInitializer] Valid session found, restoring state without new login');

            // Restore user profile from existing session
            const profile = {
              id: session.user.id,
              address: session.user.address || session.user.walletAddress || currentAddress,
              type: session.user.type || session.user.role as 'customer' | 'shop' | 'admin',
              name: session.user.name || session.user.shopName,
              email: session.user.email,
              isActive: session.user.active !== false,
              tier: session.user.tier,
              shopId: session.user.shopId,
              registrationDate: session.user.createdAt || session.user.created_at,
            };

            setUserProfile(profile);
            isInitializedRef.current = true;
            return; // Don't call login() - we already have a valid session
          }
        } catch (error) {
          console.log('[AuthInitializer] No valid session found, proceeding with login');
        }

        // No valid session - perform actual login (creates new refresh token)
        console.log('[AuthInitializer] Creating new session');
        await login(currentAddress);
        isInitializedRef.current = true;
      } else if (previousAddress) {
        // User disconnected wallet (only logout if we were previously connected)
        console.log('[AuthInitializer] Account disconnected');
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
