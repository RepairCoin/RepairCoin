'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { getUserEmail } from 'thirdweb/wallets/in-app';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';
import { client } from '@/utils/thirdweb';
import { recordAuthFailure, resetAuthFailures } from '@/utils/authRecovery';

// SessionStorage keys for cross-refresh mutex and cached session
const AUTH_LOCK_KEY = 'rc_auth_lock';
const AUTH_SESSION_CACHE_KEY = 'rc_session_cache';
const AUTH_LOCK_TIMEOUT_MS = 5000; // 5 second lock timeout
const SESSION_CACHE_TTL_MS = 30000; // 30 second cache TTL

interface CachedSession {
  timestamp: number;
  profile: {
    id: string;
    address: string;
    type: 'customer' | 'shop' | 'admin';
    name?: string;
    email?: string;
    isActive: boolean;
    tier?: string;
    shopId?: string;
    registrationDate?: string;
    suspended: boolean;
    suspendedAt?: string;
    suspensionReason?: string;
  } | null;
}

/**
 * Get cached session from sessionStorage if still valid.
 */
function getCachedSession(): CachedSession['profile'] | null {
  try {
    const cached = sessionStorage.getItem(AUTH_SESSION_CACHE_KEY);
    if (!cached) return null;

    const data: CachedSession = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age > SESSION_CACHE_TTL_MS) {
      console.log('[AuthInitializer] 📦 Session cache expired (age: ' + age + 'ms)');
      sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
      return null;
    }

    console.log('[AuthInitializer] 📦 Using cached session (age: ' + age + 'ms)');
    return data.profile;
  } catch (e) {
    return null;
  }
}

/**
 * Cache session in sessionStorage.
 */
function setCachedSession(profile: CachedSession['profile']): void {
  try {
    const data: CachedSession = {
      timestamp: Date.now(),
      profile
    };
    sessionStorage.setItem(AUTH_SESSION_CACHE_KEY, JSON.stringify(data));
    console.log('[AuthInitializer] 📦 Session cached');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Clear cached session.
 */
function clearCachedSession(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
    sessionStorage.removeItem(AUTH_LOCK_KEY);
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Clear ALL auth-related caches (for logout)
 */
export function clearAllAuthCaches(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
    sessionStorage.removeItem(AUTH_LOCK_KEY);
    // Also clear shop-related caches
    sessionStorage.removeItem('rc_shop_data_cache');
    sessionStorage.removeItem('rc_shop_id');
    console.log('[AuthInitializer] 🧹 All auth caches cleared');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Acquire a mutex lock that survives page refreshes.
 * Returns true if lock acquired, false if another refresh already has the lock.
 */
function acquireAuthLock(): boolean {
  try {
    const now = Date.now();
    const existingLock = sessionStorage.getItem(AUTH_LOCK_KEY);

    if (existingLock) {
      const lockTime = parseInt(existingLock, 10);
      // If lock is still valid (within timeout), deny new lock
      if (now - lockTime < AUTH_LOCK_TIMEOUT_MS) {
        console.log('[AuthInitializer] 🔒 Lock denied - another auth in progress (age: ' + (now - lockTime) + 'ms)');
        return false;
      }
      // Lock expired, we can take over
      console.log('[AuthInitializer] 🔓 Stale lock found, taking over');
    }

    // Acquire the lock
    sessionStorage.setItem(AUTH_LOCK_KEY, now.toString());
    console.log('[AuthInitializer] 🔒 Lock acquired');
    return true;
  } catch (e) {
    // sessionStorage might not be available (SSR, private mode)
    console.log('[AuthInitializer] ⚠️ sessionStorage not available, proceeding without lock');
    return true;
  }
}

/**
 * Release the auth mutex lock.
 */
function releaseAuthLock(): void {
  try {
    sessionStorage.removeItem(AUTH_LOCK_KEY);
    console.log('[AuthInitializer] 🔓 Lock released');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * SINGLE GLOBAL AUTHENTICATION INITIALIZER
 *
 * This hook should ONLY be used ONCE in the app (in the root provider).
 * It listens to account changes and triggers login/logout centrally.
 *
 * RAPID REFRESH PROTECTION: Uses sessionStorage mutex to prevent concurrent auth
 * operations across page refreshes. Only one refresh at a time can run auth.
 */
export function useAuthInitializer() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { login, logout, setAccount, setUserProfile, setAuthInitialized, walletMismatchPending, setWalletMismatchPending, userProfile } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);
  const authInProgressRef = useRef(false);
  const hasAcquiredLockRef = useRef(false);
  const immediateCheckDoneRef = useRef(false);

  // CRITICAL: Run session check IMMEDIATELY on mount for protected routes
  // This runs BEFORE waiting for Thirdweb to restore wallet connection
  useEffect(() => {
    const checkSessionImmediately = async () => {
      if (immediateCheckDoneRef.current) return;
      immediateCheckDoneRef.current = true;

      const isProtectedRoute = typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/shop') ||
         window.location.pathname.startsWith('/customer') ||
         window.location.pathname.startsWith('/admin'));

      if (!isProtectedRoute) {
        console.log('[AuthInitializer] ⏭️ Not a protected route, skipping immediate check');
        return;
      }

      console.log('[AuthInitializer] 🚀 IMMEDIATE session check on mount (not waiting for Thirdweb)');

      // 1. Check cache first (instant)
      const cachedProfile = getCachedSession();
      if (cachedProfile) {
        console.log('[AuthInitializer] ⚡ IMMEDIATE: Using cached session');
        setUserProfile(cachedProfile);
        setAuthInitialized(true);
        resetAuthFailures(); // Success - clear failure count
        return;
      }

      // 2. No cache - check session API immediately (don't wait for wallet)
      try {
        const session = await authApi.getSession();
        if (session.isValid && session.user) {
          console.log('[AuthInitializer] ⚡ IMMEDIATE: Valid session from API');
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
          setCachedSession(profile);
          setAuthInitialized(true);
          resetAuthFailures(); // Success - clear failure count
          return;
        }
      } catch (error: any) {
        console.log('[AuthInitializer] IMMEDIATE: No session found:', error?.message);
        recordAuthFailure('Immediate session check failed: ' + (error?.message || 'Unknown'));
      }

      // 3. No session found on protected route - clear any stale caches and redirect
      console.log('[AuthInitializer] IMMEDIATE: No valid session on protected route - redirecting to home');
      clearAllAuthCaches();
      window.location.href = '/';
    };

    checkSessionImmediately();
  }, []); // Empty deps - run ONCE on mount, before Thirdweb initializes

  // Secondary effect: Handle wallet connection changes (after Thirdweb restores wallet)
  useEffect(() => {
    const currentAddress = account?.address;
    const previousAddress = previousAddressRef.current;

    const initializeAuth = async () => {
      // Skip if immediate check already set up auth
      const { userProfile: currentProfile, authInitialized: isInit } = useAuthStore.getState();
      if (isInit && currentProfile && !currentAddress) {
        console.log('[AuthInitializer] ⏭️ Auth already initialized by immediate check, skipping');
        return;
      }

      // Local mutex (prevents double-calls within same render)
      if (authInProgressRef.current) {
        console.log('[AuthInitializer] Auth already in progress (local), skipping');
        return;
      }

      // Cross-refresh mutex using sessionStorage
      if (!acquireAuthLock()) {
        // Another refresh has the lock - try to use cached session
        const cachedProfile = getCachedSession();
        if (cachedProfile) {
          console.log('[AuthInitializer] ⏭️ Using cached session while lock is held');
          setUserProfile(cachedProfile);
          setAuthInitialized(true);
          return;
        }

        // No cache yet - wait for the other refresh to complete and cache the session
        console.log('[AuthInitializer] ⏳ Waiting for session cache...');
        const pollForCache = (attempts: number) => {
          if (attempts <= 0) {
            // Timeout - force release lock and retry
            console.log('[AuthInitializer] ⚠️ Cache wait timeout, forcing retry');
            releaseAuthLock();
            initializeAuth();
            return;
          }

          const cached = getCachedSession();
          if (cached) {
            console.log('[AuthInitializer] ✅ Got cached session');
            setUserProfile(cached);
            setAuthInitialized(true);
          } else {
            setTimeout(() => pollForCache(attempts - 1), 200);
          }
        };
        // Poll for up to 3 seconds (15 attempts * 200ms)
        pollForCache(15);
        return;
      }

      authInProgressRef.current = true;
      hasAcquiredLockRef.current = true;

      try {
        // Case 1: No wallet connected - already handled by immediate check
        if (!currentAddress) {
          setAuthInitialized(true);
          return;
        }

        // Case 2: Wallet disconnected (had address before, now doesn't)
        if (previousAddress && !currentAddress) {
          if (!walletMismatchPending) {
            console.log('[AuthInitializer] Account disconnected');
            clearCachedSession(); // Clear cache on logout
            logout();
            setAuthInitialized(false);
          } else {
            setWalletMismatchPending(false);
          }
          return;
        }

        // Case 3: Wallet connected, but address unchanged
        if (currentAddress === previousAddress) {
          setAuthInitialized(true);
          return;
        }

        // Case 4: New wallet connected or address changed
        console.log('[AuthInitializer] Account connected:', currentAddress);
        setAccount(account);

        // First, check if we have a cached session for this address
        const cachedProfile = getCachedSession();
        if (cachedProfile && cachedProfile.address?.toLowerCase() === currentAddress.toLowerCase()) {
          console.log('[AuthInitializer] ⚡ Using cached session for connected wallet');
          setUserProfile(cachedProfile);
          setAuthInitialized(true);
          resetAuthFailures(); // Success - clear failure count
          return;
        }

        // Check for existing session via API
        try {
          const session = await authApi.getSession();

          if (session.isValid && session.user) {
            const userData = session.user as any;
            const sessionAddress = (userData.address || userData.walletAddress || '').toLowerCase();
            const connectedAddress = currentAddress?.toLowerCase();

            // Check for wallet mismatch
            if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
              let connectedWalletEmail: string | undefined;
              try {
                connectedWalletEmail = await getUserEmail({ client });
              } catch (e) {}

              const sessionEmail = userData.email?.toLowerCase();

              // Allow if emails match (social login)
              if (!(connectedWalletEmail && sessionEmail && connectedWalletEmail.toLowerCase() === sessionEmail)) {
                console.warn('[AuthInitializer] ⚠️ Wallet mismatch!');
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('auth:wallet-mismatch', {
                    detail: { sessionWallet: sessionAddress, connectedWallet: connectedAddress }
                  }));
                }
              }
            }

            // Restore profile from session
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
            setCachedSession(profile); // Cache for rapid refresh resilience
            setAuthInitialized(true);
            resetAuthFailures(); // Success - clear failure count
            return;
          }
        } catch (error: any) {
          console.log('[AuthInitializer] Session check failed:', error?.message);
          recordAuthFailure('Session check failed: ' + (error?.message || 'Unknown'));
        }

        // No session - create new one
        let userEmail: string | undefined;
        try {
          userEmail = await getUserEmail({ client });
        } catch (e) {}

        console.log('[AuthInitializer] 🚀 Creating new session');
        await login(currentAddress, userEmail);
        setAuthInitialized(true);
        resetAuthFailures(); // Success - clear failure count

      } finally {
        authInProgressRef.current = false;
        if (hasAcquiredLockRef.current) {
          releaseAuthLock();
          hasAcquiredLockRef.current = false;
        }
      }
    };

    initializeAuth();
    previousAddressRef.current = currentAddress || null;

    // Cleanup: release lock if component unmounts during auth
    return () => {
      if (hasAcquiredLockRef.current) {
        releaseAuthLock();
        hasAcquiredLockRef.current = false;
      }
    };
  }, [account?.address]);

  return null;
}
