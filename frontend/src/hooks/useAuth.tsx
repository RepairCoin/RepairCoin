'use client'

import { useEffect, useCallback } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore, UserProfile } from '../stores/authStore';
import { authApi } from '@/services/api/auth';

/**
 * Hook that integrates Thirdweb account with Zustand auth store
 * Authentication logic is centralized in the store to prevent duplicate calls
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
    resetAuth,
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
      
      if (!userCheck.exists || !userCheck.data) {
        return null;
      }

      const userData = userCheck.data;
      
      // Ensure userData has required properties
      if (!userData) {
        console.warn('User data is undefined');
        return null;
      }
      
      const profile: UserProfile = {
        id: userData.id || userData._id || address, // Fallback to address if no id
        address: userData.walletAddress || userData.address || userData.wallet_address || address,
        type: userCheck.type as 'customer' | 'shop' | 'admin',
        name: userData.name || userData.shopName || userData.shop_name || '',
        email: userData.email || '',
        isActive: userData.active !== false,
        tier: userData.tier || null,
        shopId: userData.shopId || userData.shop_id || null,
        registrationDate: userData.createdAt || userData.created_at || userData.join_date || new Date().toISOString()
      };

      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [checkUserExists]);

  // NOTE: login/logout removed - authentication is handled by useAuthInitializer
  // If you need to manually trigger logout, use: authManager.clearAllTokens() + router.push('/')
  // Manual login is not supported - user must connect wallet via Thirdweb UI

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

  // NOTE: Account change detection moved to useAuthInitializer (in AuthProvider)
  // This prevents duplicate login calls from multiple hooks

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
    refreshProfile,
    checkUserExists,
    fetchUserProfile
  };
};