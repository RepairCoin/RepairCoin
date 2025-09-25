'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PurchaseSyncButtonProps {
  purchaseId: string;
  amount: number;
  onSuccess?: () => void;
}

export const PurchaseSyncButton: React.FC<PurchaseSyncButtonProps> = ({ 
  purchaseId, 
  amount, 
  onSuccess 
}) => {
  const [syncing, setSyncing] = useState(false);

  const syncPayment = async () => {
    setSyncing(true);
    
    try {
      const token = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/purchase-sync/check-payment/${purchaseId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(
          <div>
            <p className="font-semibold">Payment Verified! ✅</p>
            <p className="text-sm">{amount} RCN purchase completed</p>
          </div>,
          { duration: 5000 }
        );
        
        // Refresh the page or call parent callback
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        toast.error(
          <div>
            <p className="font-semibold">Payment Not Complete</p>
            <p className="text-sm">{result.message || 'Please contact support'}</p>
          </div>,
          { duration: 6000 }
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync payment status');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={syncPayment}
      disabled={syncing}
      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      title="Check if payment completed in Stripe"
    >
      {syncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Checking...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          Sync Status
        </>
      )}
    </button>
  );
};