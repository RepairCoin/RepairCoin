'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { getUserEmail } from 'thirdweb/wallets/in-app';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api/auth';
import { client } from '@/utils/thirdweb';
import { recordAuthFailure, resetAuthFailures } from '@/utils/authRecovery';

// Both lock and session cache use localStorage for CROSS-TAB sharing
// This prevents multiple tabs from racing AND allows tabs to share cached sessions
const AUTH_LOCK_KEY = 'rc_auth_lock';
const AUTH_SESSION_CACHE_KEY = 'rc_session_cache';
const AUTH_LOCK_TIMEOUT_MS = 5000; // 5 second lock timeout
const SESSION_CACHE_TTL_MS = 30000; // 30 second cache TTL
const WALLET_MISMATCH_DEBOUNCE_MS = 500; // 500ms debounce for wallet mismatch detection
const SWITCH_INTENT_KEY = 'rc_switch_intent';
const SWITCH_INTENT_MAX_AGE_MS = 60000; // 60 seconds — discard stale intents

interface SwitchIntent {
  newAddress: string;
  email: string | null;
  targetType: 'customer' | 'shop' | 'admin' | null;
  targetPath: string;
  timestamp: number;
}

/**
 * Check for a pending switch intent saved by switchAccount().
 * Returns the intent if valid (< 60s old), null otherwise.
 */
function getPendingSwitchIntent(): SwitchIntent | null {
  try {
    const raw = sessionStorage.getItem(SWITCH_INTENT_KEY);
    if (!raw) return null;

    const intent: SwitchIntent = JSON.parse(raw);
    const age = Date.now() - intent.timestamp;

    if (age > SWITCH_INTENT_MAX_AGE_MS) {
      console.log('[AuthInitializer] 🔄 Switch intent expired (age:', age, 'ms), clearing');
      sessionStorage.removeItem(SWITCH_INTENT_KEY);
      return null;
    }

    console.log('[AuthInitializer] 🔄 Found pending switch intent (age:', age, 'ms):', intent.targetPath);
    return intent;
  } catch {
    return null;
  }
}

/**
 * Resume a pending account switch that was interrupted (e.g., tab was backgrounded).
 * Tries to authenticate with the target wallet and redirect.
 */
async function resumeSwitchIntent(intent: SwitchIntent): Promise<boolean> {
  console.log('[AuthInitializer] 🔄 Resuming switch intent for:', intent.newAddress, '→', intent.targetPath);

  try {
    // First check if authenticate already succeeded (session cookie might be set)
    try {
      const session = await authApi.getSession();
      if (session.isValid && session.user) {
        const sessionAddress = ((session.user as any).address || (session.user as any).walletAddress || '').toLowerCase();
        if (sessionAddress === intent.newAddress.toLowerCase()) {
          console.log('[AuthInitializer] 🔄 Session already valid for target wallet, redirecting');
          sessionStorage.removeItem(SWITCH_INTENT_KEY);
          clearAllAuthCaches();
          window.location.replace(intent.targetPath);
          return true;
        }
      }
    } catch {
      // No session — need to re-authenticate
    }

    // Re-authenticate with the target wallet
    if (intent.targetType) {
      console.log('[AuthInitializer] 🔄 Re-authenticating as', intent.targetType);
      switch (intent.targetType) {
        case 'admin':
          await authApi.authenticateAdmin(intent.newAddress);
          break;
        case 'shop':
          await authApi.authenticateShop(intent.newAddress, intent.email || undefined);
          break;
        case 'customer':
          await authApi.authenticateCustomer(intent.newAddress);
          break;
      }

      console.log('[AuthInitializer] 🔄 Re-authentication successful, redirecting to:', intent.targetPath);
      sessionStorage.removeItem(SWITCH_INTENT_KEY);
      clearAllAuthCaches();
      window.location.replace(intent.targetPath);
      return true;
    } else {
      // Unregistered wallet — redirect to /choose
      console.log('[AuthInitializer] 🔄 Unregistered wallet, redirecting to /choose');
      sessionStorage.removeItem(SWITCH_INTENT_KEY);
      clearAllAuthCaches();
      window.location.replace('/choose');
      return true;
    }
  } catch (error) {
    console.error('[AuthInitializer] 🔄 Resume switch failed:', error);
    sessionStorage.removeItem(SWITCH_INTENT_KEY);
    return false;
  }
}

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
 * Get cached session from localStorage if still valid.
 * Uses localStorage (not sessionStorage) so cache is shared across tabs.
 */
function getCachedSession(): CachedSession['profile'] | null {
  try {
    const cached = localStorage.getItem(AUTH_SESSION_CACHE_KEY);
    if (!cached) return null;

    const data: CachedSession = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age > SESSION_CACHE_TTL_MS) {
      console.log('[AuthInitializer] 📦 Session cache expired (age: ' + age + 'ms)');
      localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
      return null;
    }

    console.log('[AuthInitializer] 📦 Using cached session (age: ' + age + 'ms)');
    return data.profile;
  } catch (e) {
    return null;
  }
}

/**
 * Cache session in localStorage (shared across tabs).
 */
function setCachedSession(profile: CachedSession['profile']): void {
  try {
    const data: CachedSession = {
      timestamp: Date.now(),
      profile
    };
    localStorage.setItem(AUTH_SESSION_CACHE_KEY, JSON.stringify(data));
    console.log('[AuthInitializer] 📦 Session cached (cross-tab)');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Clear cached session.
 */
function clearCachedSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
    localStorage.removeItem(AUTH_LOCK_KEY); // Lock is in localStorage for cross-tab
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Clear ALL auth-related caches (for logout)
 */
export function clearAllAuthCaches(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_CACHE_KEY); // Session cache in localStorage
    localStorage.removeItem(AUTH_LOCK_KEY); // Lock in localStorage
    // Also clear shop-related caches (these stay in sessionStorage per-tab)
    sessionStorage.removeItem('rc_shop_data_cache');
    sessionStorage.removeItem('rc_shop_id');
    // Note: do NOT clear rc_switch_intent here — it's cleared by switchAccount on success
    // or by resumeSwitchIntent after retry. Clearing it here would break resume on tab return.
    console.log('[AuthInitializer] 🧹 All auth caches cleared');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Acquire a mutex lock that works ACROSS TABS using localStorage.
 * This prevents multiple tabs from making concurrent auth requests.
 * Returns true if lock acquired, false if another tab already has the lock.
 */
function acquireAuthLock(): boolean {
  try {
    const now = Date.now();
    // Use localStorage for cross-tab mutex (shared across all tabs)
    const existingLock = localStorage.getItem(AUTH_LOCK_KEY);

    if (existingLock) {
      const lockTime = parseInt(existingLock, 10);
      // If lock is still valid (within timeout), deny new lock
      if (now - lockTime < AUTH_LOCK_TIMEOUT_MS) {
        console.log('[AuthInitializer] 🔒 Lock denied - another tab has auth in progress (age: ' + (now - lockTime) + 'ms)');
        return false;
      }
      // Lock expired, we can take over
      console.log('[AuthInitializer] 🔓 Stale lock found, taking over');
    }

    // Acquire the lock
    localStorage.setItem(AUTH_LOCK_KEY, now.toString());
    console.log('[AuthInitializer] 🔒 Lock acquired (cross-tab)');
    return true;
  } catch (e) {
    // localStorage might not be available (SSR, private mode)
    console.log('[AuthInitializer] ⚠️ localStorage not available, proceeding without lock');
    return true;
  }
}

/**
 * Release the auth mutex lock.
 */
function releaseAuthLock(): void {
  try {
    localStorage.removeItem(AUTH_LOCK_KEY);
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
  const { login, logout, switchAccount, setAccount, setUserProfile, setAuthInitialized, walletMismatchPending, setWalletMismatchPending, switchingAccount } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);
  const authInProgressRef = useRef(false);
  const hasAcquiredLockRef = useRef(false);
  const immediateCheckDoneRef = useRef(false);
  const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metamaskListenerAddedRef = useRef(false);

  // Resume pending switch intent when tab becomes visible again
  // This handles the case where user switches away from Firefox during account switch
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      const pendingSwitch = getPendingSwitchIntent();
      if (!pendingSwitch) return;

      // Don't interfere if switchAccount is actively running
      const { switchingAccount: isSwitching } = useAuthStore.getState();
      if (isSwitching) {
        console.log('[AuthInitializer] 🔄 Tab visible with pending switch but switchAccount is active, skipping');
        return;
      }

      console.log('[AuthInitializer] 🔄 Tab became visible with pending switch intent — resuming');
      await resumeSwitchIntent(pendingSwitch);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Listen to MetaMask's native accountsChanged event for real-time account switching
  useEffect(() => {
    if (typeof window === 'undefined' || metamaskListenerAddedRef.current) return;

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      console.log('[AuthInitializer] No ethereum provider found');
      return;
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      const newAddress = accounts[0]?.toLowerCase();
      const { userProfile, switchingAccount: isSwitching } = useAuthStore.getState();
      const currentSessionAddress = userProfile?.address?.toLowerCase();

      console.log('[AuthInitializer] 🦊 MetaMask accountsChanged event:', {
        newAddress,
        currentSessionAddress,
        isSwitching,
      });

      // Skip if no accounts, already switching, or same address
      if (!newAddress || isSwitching) {
        console.log('[AuthInitializer] Skipping - no address or already switching');
        return;
      }

      if (currentSessionAddress && newAddress !== currentSessionAddress) {
        console.log('[AuthInitializer] 🔄 MetaMask account changed! Auto-switching...', {
          from: currentSessionAddress,
          to: newAddress,
        });

        // Trigger auto-switch
        try {
          await switchAccount(newAddress);
        } catch (error) {
          console.error('[AuthInitializer] ❌ Auto-switch failed:', error);
        }
      }
    };

    console.log('[AuthInitializer] 🦊 Adding MetaMask accountsChanged listener');
    ethereum.on('accountsChanged', handleAccountsChanged);
    metamaskListenerAddedRef.current = true;

    return () => {
      console.log('[AuthInitializer] 🦊 Removing MetaMask accountsChanged listener');
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      metamaskListenerAddedRef.current = false;
    };
  }, [switchAccount]);

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

      // 3. No session found — check for pending switch intent before redirecting
      const pendingSwitch = getPendingSwitchIntent();
      if (pendingSwitch) {
        console.log('[AuthInitializer] IMMEDIATE: No session but found pending switch intent — resuming');
        const resumed = await resumeSwitchIntent(pendingSwitch);
        if (resumed) return; // resumeSwitchIntent handles redirect
        // Resume failed — fall through to redirect home
      }

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
      // Skip if account switch is in progress (switchAccount handles auth directly)
      const { switchingAccount: isSwitching } = useAuthStore.getState();
      if (isSwitching) {
        console.log('[AuthInitializer] ⏭️ Account switch in progress, skipping initializeAuth');
        return;
      }

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

      // Cross-tab mutex - NON-BLOCKING approach
      // If another tab has the lock, use cached session and proceed without waiting
      if (!acquireAuthLock()) {
        const cachedProfile = getCachedSession();
        if (cachedProfile) {
          console.log('[AuthInitializer] ⏭️ Lock held by another tab - using cached session');
          setUserProfile(cachedProfile);
        } else {
          console.log('[AuthInitializer] ⏭️ Lock held by another tab - no cache, proceeding without blocking');
        }
        // Always set authInitialized to true - don't block rendering
        // The other tab will complete auth and cache will be available on next refresh
        setAuthInitialized(true);
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

            // Check for wallet change - auto-switch to new account
            if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
              let connectedWalletEmail: string | undefined;
              try {
                connectedWalletEmail = await getUserEmail({ client });
              } catch (e) {}

              const sessionEmail = userData.email?.toLowerCase();

              // Allow if emails match (social login) - this is expected, don't switch
              if (connectedWalletEmail && sessionEmail && connectedWalletEmail.toLowerCase() === sessionEmail) {
                console.log('[AuthInitializer] ✅ Email-based login detected, keeping session');
              } else {
                // Clear any existing switch timeout
                if (switchTimeoutRef.current) {
                  clearTimeout(switchTimeoutRef.current);
                }

                console.log('[AuthInitializer] 🔄 Wallet changed detected, preparing auto-switch...');

                // Debounce: Wait 500ms to confirm the change is stable (not a glitch)
                switchTimeoutRef.current = setTimeout(async () => {
                  // Re-check that addresses still differ after debounce period
                  const currentConnectedAddress = account?.address?.toLowerCase();
                  if (currentConnectedAddress && sessionAddress !== currentConnectedAddress) {
                    console.log('[AuthInitializer] 🔄 Wallet change confirmed, auto-switching account', {
                      from: sessionAddress,
                      to: currentConnectedAddress,
                    });

                    // Auto-switch to new account
                    try {
                      await switchAccount(currentConnectedAddress, connectedWalletEmail);
                    } catch (error) {
                      console.error('[AuthInitializer] ❌ Auto-switch failed:', error);
                      // Fallback to old behavior - dispatch mismatch event
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('auth:wallet-mismatch', {
                          detail: { sessionWallet: sessionAddress, connectedWallet: currentConnectedAddress }
                        }));
                      }
                    }
                  } else {
                    console.log('[AuthInitializer] ✅ Wallet change resolved during stability check');
                  }
                }, WALLET_MISMATCH_DEBOUNCE_MS);

                // Return early - we'll handle the profile update after the switch
                return;
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
          console.log('[AuthInitializer] 📧 Email extracted from thirdweb:', userEmail || 'NONE');
        } catch (e) {
          console.log('[AuthInitializer] ⚠️ Failed to get email from thirdweb:', e);
        }

        console.log('[AuthInitializer] 🚀 Creating new session with:', {
          address: currentAddress,
          email: userEmail || 'NONE'
        });
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

    // Cleanup: release lock and clear switch timeout if component unmounts
    return () => {
      if (hasAcquiredLockRef.current) {
        releaseAuthLock();
        hasAcquiredLockRef.current = false;
      }
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = null;
      }
    };
  }, [account?.address, switchAccount]);

  return null;
}
