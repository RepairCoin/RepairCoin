'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActiveAccount } from "thirdweb/react";
import { customerApi } from '../services/api/customer';
import { showToast } from '../utils/toast';
import { useCustomerStore, type CustomerData, type BalanceData, type TransactionHistory } from '@/stores/customerStore';
import { useAuth } from './useAuth';
import { useAuthStore } from '@/stores/authStore';

interface RegistrationFormData {
  first_name: string;
  last_name: string;
  email: string;
  referralCode: string;
}

interface UseCustomerReturn {
  // Registration specific
  registrationFormData: RegistrationFormData;
  loading: boolean;
  error: string | null;
  success: string | null;

  // Customer data from store
  customerData: CustomerData | null;
  balanceData: BalanceData | null;
  transactions: TransactionHistory[];
  blockchainBalance: number;
  isLoading: boolean;

  // Form handlers
  updateRegistrationFormField: (field: keyof RegistrationFormData, value: string) => void;
  handleRegistrationSubmit: (walletAddress: string, walletType?: string, authMethod?: string, captchaToken?: string | null) => Promise<void>;

  // Data fetching
  fetchCustomerData: (force?: boolean) => Promise<void>;
  clearCache: () => void;

  // Utilities
  clearMessages: () => void;
}

export const useCustomer = (): UseCustomerReturn => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { refreshProfile } = useAuth();
  const { login, userProfile } = useAuthStore();

  // Get data from Zustand store
  const {
    customerData,
    balanceData,
    transactions,
    blockchainBalance,
    isLoading,
    error: storeError,
    fetchCustomerData: storeFetchCustomerData,
    clearCache,
  } = useCustomerStore();

  // Use address from Thirdweb account OR from session cache (userProfile)
  // This allows fetching immediately on page refresh without waiting for Thirdweb to restore
  const walletAddress = account?.address || userProfile?.address;
  
  // Only keep minimal local state for registration form
  const [registrationFormData, setRegistrationFormData] = useState<RegistrationFormData>({
    first_name: '',
    last_name: '',
    email: '',
    referralCode: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize referral code from URL params
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setRegistrationFormData(prev => ({
        ...prev,
        referralCode: refCode
      }));
    }
  }, [searchParams]);

  // Fetch data on mount or account change
  // Uses walletAddress which can come from Thirdweb OR session cache
  useEffect(() => {
    if (walletAddress) {
      // Fetch if we don't have data OR if the cached data is for a different wallet
      const cachedAddress = customerData?.address?.toLowerCase();
      const currentAddress = walletAddress.toLowerCase();

      if (!customerData || cachedAddress !== currentAddress) {
        // Clear old cache if wallet changed
        if (customerData && cachedAddress !== currentAddress) {
          console.log('[useCustomer] Wallet changed, clearing old cache');
          clearCache();
        }
        console.log('[useCustomer] Fetching customer data for:', currentAddress, '(source:', account?.address ? 'Thirdweb' : 'session cache', ')');
        storeFetchCustomerData(walletAddress);
      } else {
        console.log('[useCustomer] Customer data already cached for:', currentAddress);
      }
    } else {
      // Only clear cache if we had data before (wallet disconnected)
      // Don't clear on initial mount when Thirdweb hasn't initialized yet
      if (customerData) {
        console.log('[useCustomer] Account disconnected, clearing cache');
        clearCache();
      }
    }
  }, [walletAddress, customerData, storeFetchCustomerData, clearCache, account?.address]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);
  
  const updateRegistrationFormField = useCallback((field: keyof RegistrationFormData, value: string) => {
    setRegistrationFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Registration handler for the registration page
  const handleRegistrationSubmit = useCallback(async (
    walletAddress: string,
    walletType?: string,
    authMethod?: string,
    captchaToken?: string | null
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const registrationData = {
        walletAddress,
        first_name: registrationFormData.first_name,
        last_name: registrationFormData.last_name,
        email: registrationFormData.email,
        referralCode: registrationFormData.referralCode,
        captchaToken: captchaToken || undefined,
      };

      console.log('Sending registration data:', registrationData);
      const customer = await customerApi.register(registrationData);

      if (customer) {
        setSuccess('Registration successful! Authenticating...');
        showToast.success('Registration successful! Authenticating...');
        console.log('Customer registered:', customer);

        // Authenticate the customer to set cookies and create session
        console.log('Authenticating customer after registration...');
        

        // Show redirect message 
        showToast.success('Redirecting to your dashboard...');
        login(walletAddress)
        
        await refreshProfile();
        // // Redirect to home waiting for backend create a cookie before it route to customer page
        router.push('/')
      } else {
        // Registration failed but no specific error from API
        throw new Error('Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);

      // Handle specific error cases
      let errorMessage = 'Registration failed';

      // Check if it's a duplicate registration (wallet or email already in use)
      if (
        err?.response?.status === 409 ||
        err?.response?.status === 400 ||
        err?.message?.includes('already registered') ||
        err?.message?.includes('already in use')
      ) {
        // If the error mentions wallet being registered, redirect to dashboard
        if (err?.message?.includes('wallet') && err?.message?.includes('already registered')) {
          errorMessage = 'This wallet is already registered. Redirecting to your dashboard...';
          showToast.warning(errorMessage);
          setTimeout(() => router.push('/customer'), 3000);
        } else {
          // For other conflicts (like email already in use), just show the error
          errorMessage = err.message || 'This information is already in use';
          showToast.error(errorMessage);
        }
      } else if (err?.message) {
        errorMessage = err.message;
        showToast.error(errorMessage);
      } else {
        showToast.error('Registration failed. Please try again.');
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [registrationFormData, router]);

  // Wrapper for fetch function to use current account or session cache address
  const fetchCustomerData = useCallback((force?: boolean) => {
    if (walletAddress) {
      return storeFetchCustomerData(walletAddress, force);
    }
    return Promise.resolve();
  }, [walletAddress, storeFetchCustomerData]);

  return {
    // Registration specific
    registrationFormData,
    loading,
    error: error || storeError,
    success,
    
    // Customer data from store
    customerData,
    balanceData,
    transactions,
    blockchainBalance,
    isLoading,
    
    // Form handlers
    updateRegistrationFormField,
    handleRegistrationSubmit,
    
    // Data fetching
    fetchCustomerData,
    clearCache,
    
    // Utilities
    clearMessages
  };
};