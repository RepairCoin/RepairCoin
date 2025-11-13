'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useActiveWallet, useDisconnect } from 'thirdweb/react';
import { authManager } from '@/utils/auth';
import { useAuthInitializer } from '@/hooks/useAuthInitializer';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  // Initialize authentication ONCE at the app root
  useAuthInitializer();

  // Auto-refresh tokens before expiry
  // When access token expires, /auth/refresh validates refresh token in database
  // If revoked, user is logged out - this is the industry-standard approach
  useTokenRefresh();

  // No longer using localStorage for auth errors - errors are handled in-memory via authStore

  // Handle unauthorized errors globally
  const handleUnauthorized = useCallback((event: CustomEvent) => {
    const { role, endpoint } = event.detail;
    
    console.log('Unauthorized access detected:', { role, endpoint });
    
    // Clear auth tokens
    authManager.clearToken(role);
    
    // Show appropriate message
    if (role === 'admin') {
      toast.error('Admin session expired. Please reconnect your wallet.');
      router.push('/admin');
    } else if (role === 'shop') {
      toast.error('Shop session expired. Please sign in again.');
      router.push('/shop/dashboard');
    } else if (role === 'customer') {
      toast.error('Please connect your wallet to continue.');
      router.push('/customer/dashboard');
    } else {
      toast.error('Authentication required. Please sign in.');
      router.push('/');
    }
  }, [router]);

  // Handle other auth events
  const handleAuthError = useCallback((event: CustomEvent) => {
    console.error('Auth error:', event.detail);
    toast.error('Authentication error. Please try again.');
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Type assertion for custom events
    const unauthorizedHandler = handleUnauthorized as EventListener;
    const authErrorHandler = handleAuthError as EventListener;

    window.addEventListener('auth:unauthorized', unauthorizedHandler);
    window.addEventListener('auth:error', authErrorHandler);

    return () => {
      window.removeEventListener('auth:unauthorized', unauthorizedHandler);
      window.removeEventListener('auth:error', authErrorHandler);
    };
  }, [handleUnauthorized, handleAuthError]);

  // Clean up tokens on disconnect
  useEffect(() => {
    const handleDisconnect = () => {
      authManager.clearAllTokens();
    };

    window.addEventListener('wallet:disconnect', handleDisconnect);

    return () => {
      window.removeEventListener('wallet:disconnect', handleDisconnect);
    };
  }, []);

  // Handle login failures - disconnect wallet on auth failures
  useEffect(() => {
    const handleLoginFailed = async (event: CustomEvent) => {
      const authError = event.detail; // Now receives structured AuthError
      const { message, type, timestamp } = authError || {};

      console.log('[AuthProvider] Login failed - handling WITHOUT wallet disconnect to avoid page refresh', {
        type,
        message,
        timestamp
      });

      // DON'T disconnect wallet here - that triggers useAuthInitializer logout → page refresh
      // Instead, just clear the Thirdweb storage so wallet appears disconnected on next page load
      try {
        if (typeof window !== 'undefined') {
          const thirdwebKeys = Object.keys(localStorage).filter(key =>
            key.includes('thirdweb') ||
            key.includes('walletconnect') ||
            key.includes('WALLET_')
          );

          thirdwebKeys.forEach(key => {
            localStorage.removeItem(key);
          });
          console.log('[AuthProvider] ✅ Cleared Thirdweb localStorage');
        }
      } catch (error) {
        console.error('[AuthProvider] Error clearing Thirdweb storage:', error);
      }

      // Show error toast based on error type - NO page refresh, so user will see it!
      if (type === 'revoked') {
        toast.error(message, {
          duration: 10000,
          icon: '🚫',
          style: {
            background: '#991b1b',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '15px'
          }
        });
      } else if (type === 'unverified' || type === 'inactive') {
        // Don't show error for unverified/inactive - handled by dashboard UI
        console.log('[AuthProvider] Skipping toast for unverified/inactive shop - handled in UI');
        return; // Don't reload page for these cases
      } else {
        toast.error(message || 'Authentication failed. Please try again or contact support.', {
          duration: 8000,
          style: {
            background: '#dc2626',
            color: '#fff',
            fontSize: '15px'
          }
        });
      }

      // Force a page reload after user has seen the toast (except for unverified/inactive)
      setTimeout(() => {
        console.log('[AuthProvider] Reloading page after login failure');
        window.location.reload();
      }, 3000); // 3 seconds - enough time to read the message
    };

    window.addEventListener('auth:login-failed', handleLoginFailed as EventListener);

    return () => {
      window.removeEventListener('auth:login-failed', handleLoginFailed as EventListener);
    };
  }, [wallet, disconnect]);

  // Handle session revocation - disconnect wallet
  useEffect(() => {
    const handleSessionRevoked = async () => {
      console.log('[AuthProvider] Session revoked - disconnecting wallet');

      // Clear all auth state
      authManager.clearAllTokens();

      // Disconnect Thirdweb wallet using the hook
      if (wallet && disconnect) {
        try {
          console.log('[AuthProvider] Attempting to disconnect wallet:', wallet.id);
          await disconnect(wallet);
          console.log('[AuthProvider] ✅ Wallet disconnected successfully');
        } catch (error) {
          console.error('[AuthProvider] ❌ Error disconnecting wallet:', error);
        }
      } else {
        console.warn('[AuthProvider] ⚠️ Wallet or disconnect function not available', {
          hasWallet: !!wallet,
          hasDisconnect: !!disconnect
        });
      }

      // Clear any Thirdweb local storage
      try {
        if (typeof window !== 'undefined') {
          // Clear Thirdweb's wallet connection state from localStorage
          const thirdwebKeys = Object.keys(localStorage).filter(key =>
            key.includes('thirdweb') ||
            key.includes('walletconnect') ||
            key.includes('WALLET_')
          );

          thirdwebKeys.forEach(key => {
            console.log('[AuthProvider] Clearing localStorage key:', key);
            localStorage.removeItem(key);
          });
        }
      } catch (error) {
        console.error('[AuthProvider] Error clearing Thirdweb storage:', error);
      }

      // Show a toast message immediately (visible before redirect)
      // No longer using localStorage - errors are in-memory
      toast.error('Your session has been revoked by an administrator.', {
        duration: 3000,
        icon: '🚫',
        style: {
          background: '#991b1b',
          color: '#fff',
          fontWeight: 'bold'
        }
      });

      // Redirect to home with session expired message (only if on authenticated pages)
      const isAuthenticatedPage = window.location.pathname.includes('/customer') ||
                                    window.location.pathname.includes('/shop') ||
                                    window.location.pathname.includes('/admin');

      if (isAuthenticatedPage) {
        console.log('[AuthProvider] Redirecting to home after session revocation (from:', window.location.pathname, ')');
        // Use a longer delay to let user see the toast before redirect
        setTimeout(() => {
          window.location.href = '/?session=expired';
        }, 2000); // 2 seconds to see the toast
      } else {
        console.log('[AuthProvider] Already on public page, not redirecting');
      }
    };

    window.addEventListener('auth:session-revoked', handleSessionRevoked as EventListener);

    return () => {
      window.removeEventListener('auth:session-revoked', handleSessionRevoked as EventListener);
    };
  }, [wallet, disconnect]);

  return <>{children}</>;
};