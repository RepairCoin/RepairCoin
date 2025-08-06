import { useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore } from '../stores/authStore';

/**
 * Hook that integrates Thirdweb account with Zustand auth store
 * Automatically syncs wallet connection with authentication state
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
    login,
    logout,
    refreshProfile,
    checkUserExists
  } = useAuthStore();

  // Auto-sync account changes with auth store
  useEffect(() => {
    if (account?.address) {
      useAuthStore.getState().setAccount(account);
      // Auto-login when account is connected
      login();
    } else {
      // Auto-logout when account is disconnected
      logout();
      useAuthStore.getState().setAccount(null);
    }
  }, [account?.address, login, logout]);

  return {
    // Thirdweb account
    account,
    
    // Auth state
    userProfile,
    user: userProfile, // Alias for backward compatibility
    isAuthenticated,
    isLoading,
    loading: isLoading, // Alias for backward compatibility
    error,
    
    // User type helpers
    userType,
    isAdmin,
    isShop,
    isCustomer,
    
    // Actions
    login,
    logout,
    refreshProfile,
    checkUserExists
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