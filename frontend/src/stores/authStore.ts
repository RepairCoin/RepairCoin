import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { authApi } from '@/services/api/auth';
import { deactivateAllPushTokens } from '@/services/api/notifications';
import { clearAllAuthCaches } from '@/hooks/useAuthInitializer';
import { setAccountSwitchingState } from '@/services/api/client';

export interface UserProfile {
  id: string;
  address: string;
  type: 'customer' | 'shop' | 'admin';
  name?: string;
  email?: string;
  isActive?: boolean;
  tier?: 'bronze' | 'silver' | 'gold';
  shopId?: string;
  registrationDate?: string;
  suspended?: boolean;
  suspendedAt?: string;
  suspensionReason?: string;
  // Note: token is stored in httpOnly cookie, not in profile
}

export interface AuthError {
  message: string;
  type: 'revoked' | 'unauthorized' | 'inactive' | 'unverified' | 'general';
  timestamp: number;
}

export interface AuthState {
  // State
  account: { address: string } | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginInProgress: boolean; // Global flag to prevent duplicate logins
  authLockId: string | null; // Unique ID for current auth operation (prevents race conditions)
  authError: AuthError | null; // Structured error for better handling
  authInitialized: boolean; // Flag to track if initial auth check is complete
  walletMismatchPending: boolean; // Flag to prevent logout when disconnecting mismatched wallet
  switchingAccount: boolean; // Flag to indicate account switch in progress

  // Computed values
  userType: 'customer' | 'shop' | 'admin' | null;
  isAdmin: boolean;
  isShop: boolean;
  isCustomer: boolean;

  // Actions (state setters only)
  setAccount: (account: { address: string } | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthError: (error: AuthError | null) => void;
  setLoginInProgress: (inProgress: boolean) => void;
  setAuthInitialized: (initialized: boolean) => void;
  setWalletMismatchPending: (pending: boolean) => void;
  resetAuth: () => void;

  // Centralized authentication actions
  login: (address: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: (newAddress: string, email?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial state
      account: null,
      userProfile: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      loginInProgress: false,
      authLockId: null, // Unique ID for current auth operation
      authError: null,
      authInitialized: false, // Initially false, set to true after first auth check
      walletMismatchPending: false, // Flag to prevent logout when disconnecting mismatched wallet
      switchingAccount: false, // Flag to indicate account switch in progress

      // Computed values (derived from userProfile)
      userType: null,
      isAdmin: false,
      isShop: false,
      isCustomer: false,
      
      // Set account
      setAccount: (account) => {
        set({ account }, false, 'setAccount');
      },
      
      // Set user profile
      setUserProfile: (profile) => {
        const userType = profile?.type || null;
        set({ 
          userProfile: profile,
          isAuthenticated: !!profile,
          userType,
          isAdmin: userType === 'admin',
          isShop: userType === 'shop',
          isCustomer: userType === 'customer',
        }, false, 'setUserProfile');
      },
      
      // Set loading state
      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },
      
      // Set error
      setError: (error) => {
        set({ error }, false, 'setError');
      },

      // Set structured auth error
      setAuthError: (authError) => {
        set({ authError }, false, 'setAuthError');
      },

      // Set login in progress
      setLoginInProgress: (inProgress) => {
        set({ loginInProgress: inProgress }, false, 'setLoginInProgress');
      },

      // Set auth initialized
      setAuthInitialized: (initialized) => {
        set({ authInitialized: initialized }, false, 'setAuthInitialized');
      },

      // Set wallet mismatch pending (to prevent logout when disconnecting mismatched wallet)
      setWalletMismatchPending: (pending) => {
        set({ walletMismatchPending: pending }, false, 'setWalletMismatchPending');
      },

      // Reset all auth state
      resetAuth: () => {
        set({
          account: null,
          userProfile: null,
          isAuthenticated: false,
          userType: null,
          isAdmin: false,
          isShop: false,
          isCustomer: false,
          error: null,
          authError: null,
          authInitialized: false,
          loginInProgress: false,
          authLockId: null
        }, false, 'resetAuth');

        // Clear all auth-related caches
        if (typeof window !== 'undefined') {
          clearAllAuthCaches();
        }
      },

      // Centralized login function - SINGLE SOURCE OF TRUTH
      // @param address - Wallet address
      // @param email - Optional email for social login fallback (allows MetaMask-registered shops to login via Google)
      login: async (address: string, email?: string) => {
        console.log('[authStore] 🎯 Login function called with address:', address, email ? `email: ${email}` : '');
        const state = get();

        // Generate unique lock ID for this login attempt
        const lockId = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Prevent duplicate login attempts - GLOBAL LOCK with ID
        if (state.loginInProgress) {
          console.log('[authStore] Login already in progress (lockId:', state.authLockId, '), skipping duplicate call');
          return;
        }

        console.log('[authStore] Starting login process with lockId:', lockId);
        set({ loginInProgress: true, authLockId: lockId, isLoading: true, error: null }, false, 'login:start');

        // Safety timeout - auto-release lock after 15 seconds to prevent deadlock
        const lockTimeout = setTimeout(() => {
          const currentState = get();
          if (currentState.authLockId === lockId && currentState.loginInProgress) {
            console.warn('[authStore] Login timeout reached, releasing lock:', lockId);
            set({ loginInProgress: false, authLockId: null, isLoading: false }, false, 'login:timeout');
          }
        }, 15000);

        try {
          // Check user type (with email fallback for social login)
          console.log('[authStore] 📧 Calling checkUser with:', { address, email: email || 'NONE' });
          const userCheck = await authApi.checkUser(address, email);
          console.log('[authStore] 📋 checkUser response:', JSON.stringify(userCheck, null, 2));

          if (!userCheck.exists || !userCheck.type) {
            console.log('[authStore] User not registered - this is normal for new users');
            set({ userProfile: null, isAuthenticated: false }, false, 'login:not-found');
            // Don't show error toast for unregistered users - it's normal for new signups
            // Just silently fail and let them stay on the public page
            return;
          }

          // Authenticate based on user type
          let authResult = null;
          let isUnverifiedShop = false;

          try {
            switch (userCheck.type) {
              case 'admin':
                authResult = await authApi.authenticateAdmin(address);
                break;
              case 'shop':
                // Pass email for social login fallback (MetaMask shop logging in via Google)
                authResult = await authApi.authenticateShop(address, email);
                break;
              case 'customer':
                authResult = await authApi.authenticateCustomer(address);
                break;
            }
          } catch (authError: any) {
            // Special handling for unverified shops - allow them to "log in" without authentication
            const errorMessage = authError?.response?.data?.error || '';
            const errorStatus = authError?.response?.status;
            console.log('[authStore] Authentication error:', {
              type: userCheck.type,
              status: errorStatus,
              message: errorMessage,
              fullError: authError?.response?.data
            });

            if (userCheck.type === 'shop' &&
                errorStatus === 403 &&
                (errorMessage.includes('verified') || errorMessage.includes('active'))) {
              console.log('[authStore] ✅ Unverified/inactive shop - allowing limited access');
              isUnverifiedShop = true;
              // Continue with profile setup but no authenticated session
            } else {
              console.log('[authStore] ❌ Re-throwing auth error (not an unverified shop case)');
              // Re-throw other auth errors to be handled by outer catch
              throw authError;
            }
          }

          if (!authResult && !isUnverifiedShop) {
            console.error('[authStore] Authentication failed');
            const errorMessage = 'Authentication failed. Please try again or contact support.';
            set({ error: errorMessage, userProfile: null, isAuthenticated: false }, false, 'login:failed');

            // Trigger wallet disconnect on auth failure (skip during account switch)
            if (typeof window !== 'undefined' && !get().switchingAccount) {
              const failureError: AuthError = {
                message: errorMessage,
                type: 'general',
                timestamp: Date.now()
              };
              window.dispatchEvent(new CustomEvent('auth:login-failed', {
                detail: failureError
              }));
            }
            return;
          }

          // Build user profile
          // Note: token is stored in httpOnly cookie by backend, not in profile
          // Prefer authResult.user (from authentication) over userCheck.user (from check-user)
          // because authResult has more up-to-date data including suspension info
          const userData = authResult?.user || userCheck.user;
          const profile: UserProfile = {
            id: userData.id,
            address: userData.walletAddress || userData.address || address,
            type: userCheck.type as 'customer' | 'shop' | 'admin',
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

          // Update state with profile
          // For unverified shops, set profile but not authenticated status
          set({
            userProfile: profile,
            isAuthenticated: !isUnverifiedShop, // Only authenticate if not an unverified shop
            userType: profile.type,
            isAdmin: profile.type === 'admin',
            isShop: profile.type === 'shop',
            isCustomer: profile.type === 'customer',
          }, false, isUnverifiedShop ? 'login:unverified-shop' : 'login:success');

          if (isUnverifiedShop) {
            console.log('[authStore] Login successful (unverified shop - limited access):', profile.type);
          } else {
            console.log('[authStore] Login successful:', profile.type);
          }
        } catch (error: any) {
          console.error('[authStore] Login error:', error);

          // Determine error type and message
          const isRevoked = error?.response?.data?.code === 'RECENT_REVOCATION';
          const backendError = error?.response?.data?.error || '';

          let errorMessage: string;
          let errorType: AuthError['type'];

          if (isRevoked) {
            errorMessage = 'Your account access has been revoked. Please try again later or contact support.';
            errorType = 'revoked';
          } else if (backendError.includes('inactive') || backendError.includes('not active')) {
            errorMessage = backendError;
            errorType = 'inactive';
          } else if (backendError.includes('verified')) {
            errorMessage = backendError;
            errorType = 'unverified';
          } else if (error?.response?.status === 403) {
            errorMessage = backendError || 'Access denied. Your account may be suspended or inactive.';
            errorType = 'unauthorized';
          } else if (error?.response?.status === 401) {
            errorMessage = 'Authentication failed. Please try reconnecting your wallet.';
            errorType = 'unauthorized';
          } else if (error?.message) {
            errorMessage = `Authentication error: ${error.message}`;
            errorType = 'general';
          } else {
            errorMessage = 'Failed to authenticate. Please check your connection and try again.';
            errorType = 'general';
          }

          // Store structured error in state instead of localStorage
          const authError: AuthError = {
            message: errorMessage,
            type: errorType,
            timestamp: Date.now()
          };

          set({
            error: errorMessage,
            authError,
            userProfile: null
          }, false, 'login:error');

          // Trigger wallet disconnect on auth failure (especially for revocation)
          // Pass structured error instead of plain object (skip during account switch)
          if (typeof window !== 'undefined' && !get().switchingAccount) {
            window.dispatchEvent(new CustomEvent('auth:login-failed', {
              detail: authError
            }));
          }
        } finally {
          // Clear the safety timeout
          clearTimeout(lockTimeout);

          // Only release lock if we still own it (prevents race condition)
          const currentState = get();
          if (currentState.authLockId === lockId) {
            set({ isLoading: false, loginInProgress: false, authLockId: null }, false, 'login:complete');
            console.log('[authStore] Login complete, released lock:', lockId);
          } else {
            console.log('[authStore] Lock already released or taken by another operation, lockId:', lockId, 'current:', currentState.authLockId);
          }
        }
      },

      // Centralized logout function
      logout: async () => {
        const state = get();

        // If login is in progress, wait for it to complete or timeout
        if (state.loginInProgress) {
          console.log('[authStore] Login in progress during logout request, waiting...');
          // Wait up to 2 seconds for login to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('[authStore] Starting logout process...');
        set({ loginInProgress: true, authLockId: 'logout' }, false, 'logout:start');

        try {
          await authApi.logout();
        } catch (error) {
          console.error('[authStore] Logout error:', error);
        }

        // Deactivate web push tokens before reset
        try {
          await deactivateAllPushTokens();
          const registration = await navigator.serviceWorker?.getRegistration();
          const subscription = await registration?.pushManager?.getSubscription();
          await subscription?.unsubscribe();
          localStorage.removeItem('rc_push_endpoint');
        } catch {
          // Non-critical — tokens expire naturally
        }

        // Reset state regardless of API call result
        get().resetAuth();

        // Clear any pending switch intent (explicit logout = cancel everything)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('rc_switch_intent');
          window.location.href = '/';
        }
      },

      // Auto-switch account when MetaMask wallet changes
      // Login-first, redirect-second approach: authenticate BEFORE navigating
      // This eliminates race conditions where the new page loads without a valid session
      //
      // SWITCH INTENT PERSISTENCE: Before logout, we save the switch intent to sessionStorage.
      // If the browser throttles the background tab (user switches away mid-switch),
      // the intent survives. When the user returns, useAuthInitializer detects and resumes it.
      switchAccount: async (newAddress: string, email?: string) => {
        const state = get();

        // Prevent multiple switches
        if (state.switchingAccount) {
          console.log('[authStore] Account switch already in progress, skipping');
          return;
        }

        console.log('[authStore] 🔄 Starting account switch to:', newAddress);
        set({ switchingAccount: true }, false, 'switchAccount:start');

        // Block non-essential API calls immediately to prevent stale requests
        // This must happen before any async work so useEffect hooks see the flag
        setAccountSwitchingState(true);

        try {
          // 1. Check if new wallet is registered (non-destructive, determines target role)
          console.log('[authStore] 📧 Checking if new wallet is registered:', newAddress);
          const userCheck = await authApi.checkUser(newAddress, email);
          console.log('[authStore] 📋 checkUser response:', JSON.stringify(userCheck, null, 2));

          // 2. Determine target path
          const dashboards: Record<string, string> = {
            admin: '/admin',
            shop: '/shop',
            customer: '/customer',
          };
          const targetPath = userCheck.exists && userCheck.type
            ? dashboards[userCheck.type] || '/'
            : '/choose';

          // 3. PERSIST SWITCH INTENT before logout — survives tab backgrounding/page reload
          if (typeof window !== 'undefined') {
            const switchIntent = {
              newAddress,
              email: email || null,
              targetType: userCheck.type || null,
              targetPath,
              timestamp: Date.now(),
            };
            sessionStorage.setItem('rc_switch_intent', JSON.stringify(switchIntent));
            console.log('[authStore] 💾 Switch intent saved to sessionStorage');
          }

          // 4. Logout current session (await to ensure it completes before re-auth)
          console.log('[authStore] 🔄 Logging out current session...');
          try {
            await authApi.logout();
            console.log('[authStore] 🔄 Logout complete');
          } catch (logoutError) {
            console.warn('[authStore] Logout failed (continuing with switch):', logoutError);
          }

          // 5. Authenticate with new wallet directly (skip login() to avoid side effects)
          if (userCheck.exists && userCheck.type) {
            console.log('[authStore] 🔄 Authenticating as', userCheck.type, 'with new wallet...');
            try {
              switch (userCheck.type) {
                case 'admin':
                  await authApi.authenticateAdmin(newAddress);
                  break;
                case 'shop':
                  await authApi.authenticateShop(newAddress, email);
                  break;
                case 'customer':
                  await authApi.authenticateCustomer(newAddress);
                  break;
              }
              console.log('[authStore] 🔄 Authentication successful for:', userCheck.type);
            } catch (authError: any) {
              console.error('[authStore] 🔄 Authentication failed during switch:', authError);
              // Don't clear switch intent here — let useAuthInitializer retry on visibility change
              setAccountSwitchingState(false);
              set({ switchingAccount: false }, false, 'switchAccount:authFailed');
              return;
            }
          }

          // 6. Clear switch intent — switch completed successfully
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('rc_switch_intent');
          }

          // 7. Clear caches so new page loads fresh data for the new user
          if (typeof window !== 'undefined') {
            clearAllAuthCaches();
          }

          // 8. Redirect — session cookie is already set by authenticate call above
          // The new page will find a valid session immediately via getSession()
          console.log('[authStore] 🔄 Redirecting to:', targetPath);
          if (typeof window !== 'undefined') {
            if (!userCheck.exists) {
              window.dispatchEvent(new CustomEvent('auth:new-wallet-detected', {
                detail: { address: newAddress }
              }));
            }
            // Use replace to prevent back button issues
            window.location.replace(targetPath);
          }
        } catch (error: any) {
          console.error('[authStore] ❌ Account switch error:', error);

          // Re-enable API calls and reset state
          setAccountSwitchingState(false);
          set({ switchingAccount: false }, false, 'switchAccount:error');

          // Show error
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:switch-failed', {
              detail: { message: error?.message || 'Failed to switch accounts' }
            }));
          }
        }
      },
    }),
    {
      name: 'auth-store', // unique name for devtools
    }
  )
);