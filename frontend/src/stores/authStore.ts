import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
  token?: string;
}

export interface AuthState {
  // State
  account: any;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Computed values
  userType: 'customer' | 'shop' | 'admin' | null;
  isAdmin: boolean;
  isShop: boolean;
  isCustomer: boolean;
  
  // Actions (state setters only)
  setAccount: (account: any) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      // Initial state
      account: null,
      userProfile: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
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
          error: null 
        }, false, 'resetAuth');
        
        // Clear any stored data
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }
      },
    }),
    {
      name: 'auth-store', // unique name for devtools
    }
  )
);