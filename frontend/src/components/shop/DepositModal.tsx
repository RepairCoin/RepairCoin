'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Wallet, ArrowDown } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'react-hot-toast';

interface DepositInfo {
  shopId: string;
  walletAddress: string;
  operationalBalance: number;
  blockchainBalance: number;
  pendingDeposits: number;
  availableToDeposit: number;
}

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopData: {
    shopId: string;
    walletAddress: string;
    purchasedRcnBalance: number;
  };
  onDepositComplete: () => void;
}

export function DepositModal({ isOpen, onClose, shopData, onDepositComplete }: DepositModalProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  useEffect(() => {
    if (isOpen && shopData.shopId && shopData.walletAddress) {
      fetchDepositInfo();
    } else if (isOpen && (!shopData.shopId || !shopData.walletAddress)) {
      console.error('[DepositModal] Missing shop data:', { shopId: shopData.shopId, walletAddress: shopData.walletAddress });
      toast.error('Shop information is incomplete. Please refresh the page.');
      onClose();
    }
  }, [isOpen, shopData.shopId, shopData.walletAddress]);

  const fetchDepositInfo = async () => {
    try {
      setIsLoadingInfo(true);
      const token = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      // Debug logging
      console.log('[DepositModal] Fetching deposit info with token:', token ? 'Token exists' : 'No token found');
      console.log('[DepositModal] Token length:', token?.length);
      console.log('[DepositModal] API URL:', `${process.env.NEXT_PUBLIC_API_URL}/shops/deposit/info`);
      
      if (!token) {
        console.error('[DepositModal] No auth token found in storage');
        throw new Error('Authentication required. Please refresh the page.');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/deposit/info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[DepositModal] Response status:', response.status);
      console.log('[DepositModal] Response headers:', response.headers);

      if (!response.ok) {
        console.error('[DepositModal] API response not ok:', response.status, response.statusText);
        
        // Try to get error details
        let errorMessage = 'Failed to fetch deposit info';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('[DepositModal] Error details:', errorData);
        } catch (e) {
          console.error('[DepositModal] Could not parse error response');
        }
        
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please refresh the page and try again.';
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success) {
        setDepositInfo(result.data);
        // Set default amount to available balance
        if (result.data.availableToDeposit > 0) {
          setDepositAmount(result.data.availableToDeposit.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching deposit info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load deposit information';
      
      // If it's an auth error and this is the first attempt, suggest refreshing
      if (errorMessage.includes('Authentication')) {
        toast.error(errorMessage);
        onClose(); // Close the modal to force re-authentication
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (depositInfo && amount > depositInfo.availableToDeposit) {
      toast.error(`Maximum available to deposit: ${depositInfo.availableToDeposit} RCN`);
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      console.log('[DepositModal] Processing deposit with token:', token ? 'Token exists' : 'No token found');
      
      if (!token) {
        console.error('[DepositModal] No auth token found for deposit');
        throw new Error('Authentication required. Please refresh the page.');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/deposit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Successfully deposited ${amount} RCN to operational balance`);
        onDepositComplete();
        onClose();
      } else {
        toast.error(result.error || 'Failed to process deposit');
      }
    } catch (error) {
      console.error('Error processing deposit:', error);
      toast.error('Failed to process deposit');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deposit RCN to Operational Balance</DialogTitle>
          <DialogDescription>
            Transfer RCN from your blockchain wallet to your shop's operational balance for issuing rewards.
          </DialogDescription>
        </DialogHeader>

        {isLoadingInfo ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Loading balance information...</p>
          </div>
        ) : depositInfo ? (
          <div className="space-y-6">
            {/* Balance Overview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Blockchain Balance</p>
                  <p className="text-xl font-semibold">{depositInfo.blockchainBalance.toFixed(2)} RCN</p>
                </div>
                <Wallet className="h-8 w-8 text-gray-400" />
              </div>

              <div className="flex justify-center">
                <ArrowDown className="h-6 w-6 text-gray-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Operational Balance</p>
                  <p className="text-xl font-semibold">{depositInfo.operationalBalance.toFixed(2)} RCN</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">$</span>
                </div>
              </div>
            </div>

            {depositInfo.pendingDeposits > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have {depositInfo.pendingDeposits} RCN in pending deposits.
                </AlertDescription>
              </Alert>
            )}

            {/* Deposit Amount Input */}
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">Amount to Deposit</label>
              <div className="relative">
                <input
                  id="amount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 pr-16"
                  step="0.01"
                  min="0"
                  max={depositInfo.availableToDeposit}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">RCN</span>
              </div>
              <p className="text-sm text-gray-500">
                Available to deposit: {depositInfo.availableToDeposit.toFixed(2)} RCN
              </p>
            </div>

            {depositInfo.availableToDeposit === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No RCN available to deposit. Your blockchain wallet is empty or all tokens are pending.
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Deposited RCN can only be used for issuing rewards to customers. 
                This is a one-way transfer to ensure reward integrity.
              </p>
            </div>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load deposit information. Please try again.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeposit} 
            disabled={isLoading || !depositInfo || depositInfo.availableToDeposit === 0 || !depositAmount}
          >
            {isLoading ? 'Processing...' : 'Deposit RCN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}