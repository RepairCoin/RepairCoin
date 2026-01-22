'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { getUserEmail } from 'thirdweb/wallets/in-app';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';
import { client } from '@/utils/thirdweb';

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
  const wallet = useActiveWallet();
  const { login, logout, setAccount, setUserProfile, setAuthInitialized, walletMismatchPending, setWalletMismatchPending } = useAuthStore();
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
                suspended: userData.suspended || false,
                suspendedAt: userData.suspendedAt,
                suspensionReason: userData.suspensionReason
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

        // ALWAYS check for existing session when wallet connects
        // The session might have been created by Header/DualAuthConnect
        // The httpOnly cookies are sent automatically with the request via withCredentials
        try {
          console.log('[AuthInitializer] 🔍 Checking for existing session (cookies sent automatically)...');
          const session = await authApi.getSession();
          console.log('[AuthInitializer] Session check result:', session);

          if (session.isValid && session.user) {
            const userData = session.user as any;
            const sessionAddress = (userData.address || userData.walletAddress || '').toLowerCase();
            const connectedAddress = currentAddress?.toLowerCase();

            // WALLET MISMATCH CHECK: If the connected wallet doesn't match the session wallet,
            // this might be Thirdweb auto-connecting to a different cached wallet (e.g., embedded
            // wallet when user was logged in with MetaMask). Don't auto-switch accounts.
            if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
              // BEFORE flagging as mismatch, check if this is a valid email-based login
              // The connected wallet might be an embedded wallet from Google login
              // that authenticated to a MetaMask-registered shop via email fallback
              let connectedWalletEmail: string | undefined;
              try {
                connectedWalletEmail = await getUserEmail({ client });
              } catch (e) {
                // Not an embedded wallet - no email available
              }

              // If the connected wallet has an email that matches the session email,
              // this is a valid email-based login - NOT a mismatch error
              const sessionEmail = userData.email?.toLowerCase();
              if (connectedWalletEmail && sessionEmail &&
                  connectedWalletEmail.toLowerCase() === sessionEmail) {
                console.log('[AuthInitializer] ✅ Email-based login detected - wallet address mismatch is expected', {
                  sessionWallet: sessionAddress,
                  connectedWallet: connectedAddress,
                  email: sessionEmail
                });

                // This is a valid email-based login - the session was created via email fallback
                // Don't trigger mismatch error, just restore the session profile
                const profile = {
                  id: userData.id,
                  address: sessionAddress, // Keep session address (the original MetaMask address)
                  type: userData.type || userData.role as 'customer' | 'shop' | 'admin',
                  name: userData.name || userData.shopName,
                  email: userData.email,
                  isActive: userData.active !== false,
                  tier: userData.tier,
                  shopId: userData.shopId,
                  registrationDate: userData.createdAt || userData.created_at,
                  suspended: userData.suspended || false,
                  suspendedAt: userData.suspendedAt,
                  suspensionReason: userData.suspensionReason
                };

                setUserProfile(profile);
                setAuthInitialized(true);
                isInitializedRef.current = true;
                sessionCheckedRef.current = true;
                return; // Valid email-based login - continue with session
              }

              // Only trigger mismatch error if emails don't match (or no email available)
              // This means someone is genuinely trying to connect with a different wallet
              console.warn('[AuthInitializer] ⚠️ Wallet mismatch detected!', {
                sessionWallet: sessionAddress,
                connectedWallet: connectedAddress,
                sessionEmail: sessionEmail || 'none',
                connectedEmail: connectedWalletEmail || 'none',
                reason: 'Thirdweb auto-connected to different wallet than session'
              });

              // Dispatch event so UI can handle this (show warning, disconnect wrong wallet)
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:wallet-mismatch', {
                  detail: {
                    sessionWallet: sessionAddress,
                    connectedWallet: connectedAddress,
                    message: 'Your wallet changed unexpectedly. Please reconnect with your intended wallet.'
                  }
                }));
              }

              // Still restore the session profile (with correct session address)
              // The UI handler will disconnect the wrong wallet and prompt user
              const profile = {
                id: userData.id,
                address: sessionAddress, // Use SESSION address, not connected address
                type: userData.type || userData.role as 'customer' | 'shop' | 'admin',
                name: userData.name || userData.shopName,
                email: userData.email,
                isActive: userData.active !== false,
                tier: userData.tier,
                shopId: userData.shopId,
                registrationDate: userData.createdAt || userData.created_at,
                suspended: userData.suspended || false,
                suspendedAt: userData.suspendedAt,
                suspensionReason: userData.suspensionReason
              };

              setUserProfile(profile);
              setAuthInitialized(true);
              isInitializedRef.current = true;
              sessionCheckedRef.current = true;
              return; // Don't create new session - keep existing one
            }

            console.log('[AuthInitializer] ✅ Valid session found, restoring state without new login');

            // Restore user profile from existing session
            // Session user has extended properties beyond the basic User type
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
              suspended: userData.suspended || false,
              suspendedAt: userData.suspendedAt,
              suspensionReason: userData.suspensionReason
            };

            setUserProfile(profile);
            setAuthInitialized(true); // Mark auth as initialized
            isInitializedRef.current = true;
            sessionCheckedRef.current = true;
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

        // No valid session found - create a new one with email for social login fallback
        // Try to get email from Thirdweb for social login (MetaMask shop logging in with Google)
        let userEmail: string | undefined;
        try {
          userEmail = await getUserEmail({ client });
          if (userEmail) {
            console.log('[AuthInitializer] 📧 Found email for social login:', userEmail);
          }
        } catch (e) {
          // Expected for non-embedded wallets
          console.log('[AuthInitializer] No email available (expected for external wallets)');
        }

        // NOTE: We removed the "blocking auto-login on protected route" protection here.
        // The wallet mismatch check above (lines 116-156) is the correct protection:
        // - If session IS valid AND wallet doesn't match → Block and show warning
        // - If session is NOT valid (expired/no session) → Allow login with email fallback
        //
        // The removed protection was too aggressive - it blocked legitimate Google logins
        // even when there was no session to protect.

        console.log('[AuthInitializer] 🚀 Creating new session via login()');
        await login(currentAddress, userEmail);
        console.log('[AuthInitializer] ✅ Login completed');
        setAuthInitialized(true); // Mark auth as initialized
        isInitializedRef.current = true;
        sessionCheckedRef.current = true;
      } else if (previousAddress) {
        // User disconnected wallet (only logout if we were previously connected)
        // BUT skip logout if this disconnect was due to wallet mismatch handling
        if (walletMismatchPending) {
          console.log('[AuthInitializer] Wallet disconnected due to mismatch handling, skipping logout');
          // Reset the flag - page will reload anyway
          setWalletMismatchPending(false);
          // Keep authInitialized true so dashboard doesn't show loading
          return;
        }

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
