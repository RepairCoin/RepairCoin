'use client';

import React, { useState, useEffect } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { toast } from 'react-hot-toast';
import { Zap, AlertCircle } from 'lucide-react';

export const BlockchainMintingToggle: React.FC = () => {
  const { generateAdminToken } = useAdminDashboard();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchCurrentStatus();
  }, []);

  const fetchCurrentStatus = async () => {
    try {
      const token = await generateAdminToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/system/blockchain-minting`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEnabled(data.data.enabled);
      }
    } catch (error) {
      console.error('Error fetching blockchain minting status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const newState = !enabled;
    const confirmMessage = newState 
      ? 'Enable blockchain rewards? Customer rewards will be automatically sent to their wallets when shops issue them.'
      : 'Disable blockchain rewards? Customer rewards will only be tracked in the database (off-chain).';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setToggling(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/system/blockchain-minting`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: newState })
      });
      
      if (response.ok) {
        const data = await response.json();
        setEnabled(newState);
        toast.success(
          newState 
            ? 'Blockchain rewards enabled! Customers will receive tokens in their wallets.'
            : 'Blockchain rewards disabled! Rewards will be tracked off-chain only.'
        );
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Error toggling blockchain minting:', error);
      toast.error('Failed to update blockchain minting setting');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border ${enabled ? 'border-green-700' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Zap className={`w-6 h-6 ${enabled ? 'text-green-400' : 'text-gray-400'}`} />
            <h3 className="text-lg font-semibold text-white">Automatic Customer Rewards on Blockchain</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {enabled 
              ? 'Customer rewards are automatically sent to their blockchain wallets'
              : 'Customer rewards are tracked in database only (off-chain)'
            }
          </p>
          
          {!enabled && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">Off-Chain Mode</p>
                  <p className="text-gray-300 mt-1">
                    Customer rewards are tracked in the database only. Customers won't receive 
                    actual blockchain tokens until this is enabled.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="ml-4">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
              enabled ? 'bg-green-600' : 'bg-gray-600'
            } ${toggling ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        Current status: <span className={enabled ? 'text-green-400' : 'text-gray-400'}>
          {enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>
    </div>
  );
};