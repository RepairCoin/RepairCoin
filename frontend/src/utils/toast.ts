import toast from 'react-hot-toast';

/**
 * Custom toast notifications for RepairCoin
 */
export const showToast = {
  // Success messages
  success: (message: string) => {
    return toast.success(message, {
      duration: 4000,
      position: 'top-right',
    });
  },

  // Error messages
  error: (message: string) => {
    return toast.error(message, {
      duration: 5000,
      position: 'top-right',
    });
  },

  // Loading messages
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    });
  },

  // Custom promise handler for async operations
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        position: 'top-right',
      }
    );
  },

  // Wallet-specific messages
  walletNotConnected: () => {
    return toast.error('Please connect your wallet first', {
      duration: 4000,
      icon: '🔗',
    });
  },

  // Transaction messages
  transactionSuccess: (txHash?: string) => {
    const message = txHash 
      ? `Transaction successful! Hash: ${txHash.slice(0, 10)}...`
      : 'Transaction successful!';
    return toast.success(message, {
      duration: 5000,
      icon: '✅',
    });
  },

  transactionFailed: (error?: string) => {
    const message = error 
      ? `Transaction failed: ${error}`
      : 'Transaction failed. Please try again.';
    return toast.error(message, {
      duration: 6000,
      icon: '❌',
    });
  },

  // Shop-specific messages
  shopRegistrationSuccess: () => {
    return toast.success('Shop registration submitted! Pending admin approval.', {
      duration: 5000,
      icon: '🏪',
    });
  },

  // Customer-specific messages
  customerRegistrationSuccess: () => {
    return toast.success('Welcome to RepairCoin! Registration complete.', {
      duration: 5000,
      icon: '🎉',
    });
  },

  // Reward messages
  rewardIssued: (amount: number, customerName?: string) => {
    const message = customerName 
      ? `${amount} RCN issued to ${customerName}`
      : `${amount} RCN issued successfully`;
    return toast.success(message, {
      duration: 4000,
      icon: '🎁',
    });
  },

  // Redemption messages
  redemptionApproved: (amount: number) => {
    return toast.success(`Redemption of ${amount} RCN approved!`, {
      duration: 4000,
      icon: '✅',
    });
  },

  redemptionRejected: () => {
    return toast.error('Redemption request rejected', {
      duration: 4000,
      icon: '❌',
    });
  },

  // Dismiss a specific toast
  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },
};