'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/services/api/client';

interface ManualCompleteButtonProps {
  purchaseId: string;
  amount: number;
  onSuccess?: () => void;
}

export const ManualCompleteButton: React.FC<ManualCompleteButtonProps> = ({ 
  purchaseId, 
  amount, 
  onSuccess 
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [completing, setCompleting] = useState(false);
  
  const expectedCode = `CONFIRM-${String(purchaseId).slice(-6).toUpperCase()}`;

  const handleComplete = async () => {
    if (confirmCode !== expectedCode) {
      toast.error('Invalid confirmation code');
      return;
    }

    setCompleting(true);

    try {
      const result = await apiClient.post(
        `/shops/purchase-sync/manual-complete/${purchaseId}`,
        { confirmationCode: confirmCode }
      );

      if (result.success) {
        toast.success(
          <div>
            <p className="font-semibold">Purchase Completed! ✅</p>
            <p className="text-sm">{amount} RCN marked as paid</p>
            <p className="text-xs mt-1">{result.data.message}</p>
          </div>,
          { duration: 6000 }
        );
        
        setShowConfirm(false);
        setConfirmCode('');
        
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        toast.error(result.error || 'Failed to complete purchase');
      }
    } catch (error) {
      console.error('Manual complete error:', error);
      toast.error('Failed to complete purchase');
    } finally {
      setCompleting(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
        title="Manually complete this purchase"
      >
        <AlertTriangle className="w-4 h-4" />
        Manual Complete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={confirmCode}
        onChange={(e) => setConfirmCode(e.target.value.toUpperCase())}
        placeholder={expectedCode}
        className="px-2 py-1 bg-gray-700 rounded text-sm w-32"
        disabled={completing}
      />
      <button
        onClick={handleComplete}
        disabled={completing || confirmCode !== expectedCode}
        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        <CheckCircle className="w-3 h-3" />
        {completing ? 'Completing...' : 'Confirm'}
      </button>
      <button
        onClick={() => {
          setShowConfirm(false);
          setConfirmCode('');
        }}
        disabled={completing}
        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
      >
        Cancel
      </button>
    </div>
  );
};