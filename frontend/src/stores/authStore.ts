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

interface AuthState {
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
  
  // Actions
  setAccount: (account: any) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  checkUserExists: (address: string) => Promise<{ exists: boolean; type?: string; data?: any }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial state
      account: null,
      userProfile: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      // Computed values
      userType: null,
      isAdmin: false,
      isShop: false,
      isCustomer: false,
      
      // Actions
      setAccount: (account) => {
        set({ account }, false, 'setAccount');
      },
      
      setUserProfile: (profile) => {
        const userType = profile?.type || null;
        set({ 
          userProfile: profile,
          isAuthenticated: !!(get().account && profile),
          userType,
          isAdmin: userType === 'admin',
          isShop: userType === 'shop',
          isCustomer: userType === 'customer'
        }, false, 'setUserProfile');
      },
      
      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },
      
      setError: (error) => {
        set({ error }, false, 'setError');
      },
      
      // Check if user exists in database
      checkUserExists: async (address: string) => {
        try {
          const response = await fetch(`${API_URL}/auth/check-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
          });

          if (response.ok) {
            const data = await response.json();
            return { exists: true, type: data.type, data: data.user };
          } else if (response.status === 404) {
            // This is expected for new users - not an error
            console.log(`ℹ️ User check: Wallet ${address} not registered yet`);
            return { exists: false };
          } else {
            // Actual error
            console.error(`❌ User check failed with status: ${response.status}`);
            return { exists: false };
          }
        } catch (error) {
          console.error('❌ Network error checking user:', error);
          return { exists: false };
        }
      },
      
      // Fetch user profile from backend
      fetchUserProfile: async (address: string): Promise<UserProfile | null> => {
        try {
          const userCheck = await get().checkUserExists(address);
          
          if (!userCheck.exists) {
            return null;
          }

          const userData = userCheck.data;
          
          // Map the database response to our UserProfile interface
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

          return profile;
        } catch (error) {
          console.error('Error fetching user profile:', error);
          return null;
        }
      },
      
      // Login function
      login: async () => {
        const { account, setLoading, setError, setUserProfile } = get();
        if (!account?.address) return;
        
        setLoading(true);
        setError(null);
        
        try {
          const profile = await get().fetchUserProfile(account.address);
          
          // Get JWT token
          if (profile) {
            try {
              const tokenResponse = await fetch(`${API_URL}/auth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: account.address })
              });
              
              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                if (tokenData.token) {
                  profile.token = tokenData.token;
                  console.log('✅ Authentication token obtained successfully');
                }
              } else if (tokenResponse.status === 404) {
                console.log('ℹ️ Token generation skipped - user not registered');
              } else {
                console.warn(`⚠️ Token generation failed with status: ${tokenResponse.status}`);
              }
            } catch (tokenError) {
              console.error('❌ Network error fetching token:', tokenError);
              // Continue without token
            }
          }
          
          setUserProfile(profile);
        } catch (error) {
          console.error('Login error:', error);
          setError('Failed to authenticate user');
        } finally {
          setLoading(false);
        }
      },
      
      // Logout function
      logout: () => {
        set({ 
          userProfile: null,
          isAuthenticated: false,
          userType: null,
          isAdmin: false,
          isShop: false,
          isCustomer: false,
          error: null
        }, false, 'logout');
      },
      
      // Refresh profile
      refreshProfile: async () => {
        const { account, setLoading, setError, setUserProfile } = get();
        if (!account?.address) return;
        
        setLoading(true);
        setError(null);
        
        try {
          const profile = await get().fetchUserProfile(account.address);
          setUserProfile(profile);
        } catch (error) {
          console.error('Refresh profile error:', error);
          setError('Failed to refresh profile');
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'auth-store', // unique name for devtools
    }
  )
);