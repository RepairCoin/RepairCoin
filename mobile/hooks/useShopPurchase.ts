import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  createStripeCheckout, 
} from '@/services/ShopServices';
import { useAuthStore } from '@/store/authStore';
import { Alert } from 'react-native';

// Hook for creating Stripe checkout
export function useCreateCheckout() {
  const queryClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  
  return useMutation({
    mutationFn: async (amount: number) => {
      if (!shopId) {
        throw new Error('Shop not authenticated');
      }
      if (amount < 5) {
        throw new Error('Minimum purchase amount is 5 RCN');
      }
      return createStripeCheckout(amount);
    },
    onSuccess: (data) => {
      // Don't invalidate immediately as purchase is pending
      // Will be refreshed when user returns from Stripe
      console.log('Stripe checkout created successfully:', data.data.checkoutUrl);
    },
    onError: (error: any) => {
      console.error('Failed to create checkout:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        Alert.alert(
          'Authentication Required',
          'Please log in again to continue with your purchase.',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 400) {
        Alert.alert(
          'Invalid Request',
          error.response?.data?.error || 'Invalid purchase amount',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          error.message || 'Failed to initiate purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    },
  });
}

// Hook for managing purchase amount state
export function usePurchaseAmount(initialAmount = 5) {
  const [amount, setAmount] = useState(initialAmount);
  
  // Calculate bonus based on amount
  const bonusAmount = 
    amount >= 10000 ? Math.floor(amount * 0.05) :
    amount >= 5000 ? Math.floor(amount * 0.03) :
    amount >= 1000 ? Math.floor(amount * 0.02) :
    0;
  
  const totalCost = amount * 0.1;
  const totalTokens = amount + bonusAmount;
  const effectiveRate = totalTokens > 0 ? (totalCost / totalTokens).toFixed(3) : "0.100";
  
  return {
    amount,
    setAmount,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount: amount >= 5,
  };
}

// Combined hook for all purchase-related functionality
export function useShopPurchase() {
  const purchaseAmount = usePurchaseAmount();
  const createCheckout = useCreateCheckout();
  
  return {
    // Amount management
    ...purchaseAmount,
    
    // Create checkout
    createCheckout: createCheckout.mutate,
    createCheckoutAsync: createCheckout.mutateAsync,
    isCreatingCheckout: createCheckout.isPending,
    checkoutError: createCheckout.error,
  };
}