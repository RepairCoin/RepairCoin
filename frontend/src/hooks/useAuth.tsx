'use client'

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

  const login = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const profile = await fetchUserProfile(account.address);
      
      if (profile) {
        try {
          // Use role-specific authentication endpoint based on user type
          let tokenData = null;
          switch (profile.type) {
            case 'admin':
              tokenData = await authApi.authenticateAdmin(account.address);
              break;
            case 'shop':
              tokenData = await authApi.authenticateShop(account.address);
              break;
            case 'customer':
              tokenData = await authApi.authenticateCustomer(account.address);
              break;
          }
          
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
      console.log("LOGIN ATTEMPT")

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