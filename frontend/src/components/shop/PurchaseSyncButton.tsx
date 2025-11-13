'use client';

import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ManualCompleteButton } from './ManualCompleteButton';
import apiClient from '@/services/api/client';

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
  const [showManualOption, setShowManualOption] = useState(false);

  const syncPayment = async () => {
    setSyncing(true);

    try {
      const result = await apiClient.post(
        `/shops/purchase-sync/check-payment/${purchaseId}`
      );

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
        // Show manual option if sync fails
        setShowManualOption(true);
        toast.error(
          <div>
            <p className="font-semibold">Sync Failed</p>
            <p className="text-sm">Use manual complete if you paid successfully</p>
          </div>,
          { duration: 4000 }
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync payment status');
      setShowManualOption(true);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!showManualOption ? (
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
      ) : (
        <ManualCompleteButton
          purchaseId={purchaseId}
          amount={amount}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
};