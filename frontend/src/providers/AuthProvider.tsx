'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { authManager } from '@/utils/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const { disconnect } = useAuth();

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

  return <>{children}</>;
};