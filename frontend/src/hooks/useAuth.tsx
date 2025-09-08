import { useEffect, useCallback } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore, UserProfile } from '../stores/authStore';
import { authApi } from '@/services/api/auth';

/**
 * Hook that integrates Thirdweb account with Zustand auth store
 * Contains all business logic for authentication
 */
export const useAuth = () => {
  const account = useActiveAccount();
  const {
    userProfile,
    isAuthenticated,
    isLoading,
    error,
    userType,
    isAdmin,
    isShop,
    isCustomer,
    setAccount,
    setUserProfile,
    setLoading,
    setError,
    resetAuth
  } = useAuthStore();

  const checkUserExists = useCallback(async (address: string) => {
    try {
      const result = await authApi.checkUser(address);

      if (result) {
        return { 
          exists: true, 
          type: result.type, 
          data: result.user 
        };
      } else {
        console.log(`ℹ️ User check: Wallet ${address} not registered yet`);
        return { exists: false };
      }
    } catch (error) {
      console.error('❌ Error checking user:', error);
      return { exists: false };
    }
  }, []);

  const fetchUserProfile = useCallback(async (address: string): Promise<UserProfile | null> => {
    try {
      const userCheck = await checkUserExists(address);
      
      if (!userCheck.exists) {
        return null;
      }

      const userData = userCheck.data;
      
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
  }, [checkUserExists]);

  const login = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const profile = await fetchUserProfile(account.address);
      
      if (profile) {
        try {
          const tokenData = await authApi.generateToken(account.address);
          
          if (tokenData && tokenData.token) {
            profile.token = tokenData.token;
            console.log('✅ Authentication token obtained successfully');
          } else {
            console.log('ℹ️ Token generation skipped - user not registered');
          }
        } catch (tokenError) {
          console.error('❌ Network error fetching token:', tokenError);
        }
      }
      
      setUserProfile(profile);
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to authenticate user');
    } finally {
      setLoading(false);
    }
  }, [account?.address, setLoading, setError, setUserProfile, fetchUserProfile]);

  const logout = useCallback(() => {
    resetAuth();
  }, [resetAuth]);

  const refreshProfile = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const profile = await fetchUserProfile(account.address);
      setUserProfile(profile);
    } catch (error) {
      console.error('Refresh profile error:', error);
      setError('Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  }, [account?.address, setLoading, setError, setUserProfile, fetchUserProfile]);

  useEffect(() => {
    if (account?.address) {
      setAccount(account);
      login();
    } else {
      logout();
      setAccount(null);
      
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
    }
  }, [account?.address]);

  return {
    account,
    userProfile,
    user: userProfile, 
    isAuthenticated,
    isLoading,
    error,
    userType,
    isAdmin,
    isShop,
    isCustomer,
    login,
    logout,
    refreshProfile,
    checkUserExists,
    fetchUserProfile
  };
};

/**
 * Hook for route protection
 */
export const useRequireAuth = (allowedTypes?: ('customer' | 'shop' | 'admin')[]) => {
  const { isAuthenticated, userType, isLoading } = useAuth();
  
  return {
    isAuthenticated,
    userType,
    isLoading,
    hasAccess: !allowedTypes || (userType && allowedTypes.includes(userType)),
    canAccess: isAuthenticated && (!allowedTypes || (userType && allowedTypes.includes(userType)))
  };
};

/**
 * Higher-order component for authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedTypes?: ('customer' | 'shop' | 'admin')[]
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, userType, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
            <p className="text-gray-600">Please connect your wallet to continue.</p>
          </div>
        </div>
      );
    }

    if (allowedTypes && !allowedTypes.includes(userType!)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">
              You don't have permission to access this page. Required role: {allowedTypes.join(' or ')}.
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}