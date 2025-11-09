'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useActiveAccount } from "thirdweb/react";
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
}

interface AuthContextType {
  account: any;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userType: 'customer' | 'shop' | 'admin' | null;
  isAdmin: boolean;
  isShop: boolean;
  isCustomer: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUserExists: (address: string) => Promise<{ exists: boolean; type?: string; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const account = useActiveAccount();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // Check if user exists in database
  const checkUserExists = async (address: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send cookies with request
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const data = await response.json();
        return { exists: true, type: data.type, data: data.user };
      } else {
        return { exists: false };
      }
    } catch (error) {
      console.error('Error checking user:', error);
      return { exists: false };
    }
  };

  // Fetch user profile from backend
  const fetchUserProfile = async (address: string): Promise<UserProfile | null> => {
    try {
      const userCheck = await checkUserExists(address);
      
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
  };

  // Login function - Now properly authenticates and sets cookie
  const login = async () => {
    if (!account?.address) return;

    setIsLoading(true);
    try {
      // First, check what type of user this is
      const userCheck = await checkUserExists(account.address);

      if (!userCheck.exists || !userCheck.type) {
        console.log('User not registered');
        setUserProfile(null);
        return;
      }

      // Call the appropriate authentication endpoint to set the cookie
      let authResult = null;
      switch (userCheck.type) {
        case 'admin':
          authResult = await authApi.authenticateAdmin(account.address);
          break;
        case 'shop':
          authResult = await authApi.authenticateShop(account.address);
          break;
        case 'customer':
          authResult = await authApi.authenticateCustomer(account.address);
          break;
      }

      if (!authResult) {
        console.error('Authentication failed');
        setUserProfile(null);
        return;
      }

      // Now fetch the full profile
      const profile = await fetchUserProfile(account.address);
      setUserProfile(profile);
    } catch (error) {
      console.error('Login error:', error);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setUserProfile(null);
    // Call backend to clear httpOnly cookie
    await authApi.logout();
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (!account?.address) return;
    
    setIsLoading(true);
    try {
      const profile = await fetchUserProfile(account.address);
      setUserProfile(profile);
    } catch (error) {
      console.error('Refresh profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-login when account changes
  useEffect(() => {
    if (account?.address) {
      login();
    } else {
      logout();
    }
  }, [account?.address]);

  // Computed values
  const isAuthenticated = !!account?.address && !!userProfile;
  const userType = userProfile?.type || null;
  const isAdmin = userType === 'admin';
  const isShop = userType === 'shop';
  const isCustomer = userType === 'customer';

  const contextValue: AuthContextType = {
    account,
    userProfile,
    isAuthenticated,
    isLoading,
    userType,
    isAdmin,
    isShop,
    isCustomer,
    login,
    logout,
    refreshProfile,
    checkUserExists
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Higher-order component for authentication
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  allowedTypes?: ('customer' | 'shop' | 'admin')[]
) => {
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
};

// Hook for route protection
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