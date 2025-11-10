import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { authApi } from '@/services/api/auth';

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
  // Note: token is stored in httpOnly cookie, not in profile
}

export interface AuthState {
  // State
  account: { address: string } | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginInProgress: boolean; // Global flag to prevent duplicate logins

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
  setLoginInProgress: (inProgress: boolean) => void;
  resetAuth: () => void;

  // Centralized authentication actions
  login: (address: string) => Promise<void>;
  logout: () => Promise<void>;
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

      // Set login in progress
      setLoginInProgress: (inProgress) => {
        set({ loginInProgress: inProgress }, false, 'setLoginInProgress');
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
          loginInProgress: false
        }, false, 'resetAuth');

        // Clear any stored data
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }
      },

      // Centralized login function - SINGLE SOURCE OF TRUTH
      login: async (address: string) => {
        const state = get();

        // Prevent duplicate login attempts - GLOBAL LOCK
        if (state.loginInProgress) {
          console.log('[authStore] Login already in progress, skipping duplicate call');
          return;
        }

        set({ loginInProgress: true, isLoading: true, error: null }, false, 'login:start');

        try {
          // Check user type
          const userCheck = await authApi.checkUser(address);

          if (!userCheck.exists || !userCheck.type) {
            console.log('[authStore] User not registered');
            set({ userProfile: null, isAuthenticated: false }, false, 'login:not-found');
            return;
          }

          // Authenticate based on user type
          let authResult = null;
          switch (userCheck.type) {
            case 'admin':
              authResult = await authApi.authenticateAdmin(address);
              break;
            case 'shop':
              authResult = await authApi.authenticateShop(address);
              break;
            case 'customer':
              authResult = await authApi.authenticateCustomer(address);
              break;
          }

          if (!authResult) {
            console.error('[authStore] Authentication failed');
            set({ userProfile: null, isAuthenticated: false }, false, 'login:failed');
            return;
          }

          // Build user profile
          // Note: token is stored in httpOnly cookie by backend, not in profile
          const userData = userCheck.user;
          const profile: UserProfile = {
            id: userData.id,
            address: userData.walletAddress || userData.address || address,
            type: userCheck.type as 'customer' | 'shop' | 'admin',
            name: userData.name || userData.shopName,
            email: userData.email,
            isActive: userData.active !== false,
            tier: userData.tier,
            shopId: userData.shopId,
            registrationDate: userData.createdAt || userData.created_at
          };

          // Update state with profile
          set({
            userProfile: profile,
            isAuthenticated: true,
            userType: profile.type,
            isAdmin: profile.type === 'admin',
            isShop: profile.type === 'shop',
            isCustomer: profile.type === 'customer',
          }, false, 'login:success');

          console.log('[authStore] Login successful:', profile.type);
        } catch (error) {
          console.error('[authStore] Login error:', error);
          set({ error: 'Failed to authenticate user', userProfile: null }, false, 'login:error');
        } finally {
          set({ isLoading: false, loginInProgress: false }, false, 'login:complete');
        }
      },

      // Centralized logout function
      logout: async () => {
        set({ loginInProgress: false }, false, 'logout:start');

        try {
          await authApi.logout();
        } catch (error) {
          console.error('[authStore] Logout error:', error);
        }

        // Reset state regardless of API call result
        get().resetAuth();

        // Redirect to home page for better UX
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      },
    }),
    {
      name: 'auth-store', // unique name for devtools
    }
  )
);