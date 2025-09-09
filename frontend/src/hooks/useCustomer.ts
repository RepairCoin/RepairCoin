'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { customerApi } from '../services/api/customer';
import { showToast } from '../utils/toast';

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
  
  // Form handlers
  updateRegistrationFormField: (field: keyof RegistrationFormData, value: string) => void;
  handleRegistrationSubmit: (walletAddress: string, walletType?: string, authMethod?: string) => Promise<void>;
  
  // Utilities
  clearMessages: () => void;
}

export const useCustomer = (): UseCustomerReturn => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  return {
    // Registration specific
    registrationFormData,
    loading,
    error,
    success,
    
    // Form handlers
    updateRegistrationFormField,
    handleRegistrationSubmit,
    clearMessages
  };
};