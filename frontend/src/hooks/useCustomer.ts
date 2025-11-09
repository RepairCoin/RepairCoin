'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActiveAccount } from "thirdweb/react";
import { customerApi } from '../services/api/customer';
import { showToast } from '../utils/toast';
import { useCustomerStore, type CustomerData, type BalanceData, type TransactionHistory } from '@/stores/customerStore';

interface RegistrationFormData {
  name: string;
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
  handleRegistrationSubmit: (walletAddress: string, walletType?: string, authMethod?: string) => Promise<void>;
  
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
  
  // Only keep minimal local state for registration form
  const [registrationFormData, setRegistrationFormData] = useState<RegistrationFormData>({
    name: '',
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
  useEffect(() => {
    if (account?.address) {
      // Only fetch if we don't have data
      if (!customerData) {
        storeFetchCustomerData(account.address);
      }
    } else {
      // Clear cache when account disconnects
      clearCache();
    }
  }, [account?.address, customerData, storeFetchCustomerData, clearCache]);

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
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const registrationData = {
        walletAddress,
        name: registrationFormData.name,
        email: registrationFormData.email,
        referralCode: registrationFormData.referralCode,
      };

      console.log('Sending registration data:', registrationData);
      const customer = await customerApi.register(registrationData);

      if (customer) {
        setSuccess('Registration successful! Welcome to RepairCoin!');
        showToast.success('Registration successful! Welcome to RepairCoin!');
        console.log('Customer registered:', customer);
        
        // Redirect to customer dashboard after successful registration
        setTimeout(() => router.push('/customer'), 2000);
      } else {
        // Registration failed but no specific error from API
        throw new Error('Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle specific error cases
      let errorMessage = 'Registration failed';
      
      if (err?.response?.status === 409 || err?.message?.includes('already registered')) {
        errorMessage = 'This wallet is already registered. Redirecting to your dashboard...';
        showToast.warning(errorMessage);
        setTimeout(() => router.push('/customer'), 3000);
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

  // Wrapper for fetch function to use current account
  const fetchCustomerData = useCallback((force?: boolean) => {
    if (account?.address) {
      return storeFetchCustomerData(account.address, force);
    }
    return Promise.resolve();
  }, [account?.address, storeFetchCustomerData]);

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