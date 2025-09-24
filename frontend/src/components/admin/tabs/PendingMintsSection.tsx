'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { AlertCircle, Zap, RefreshCw, CheckCircle, Clock, DollarSign } from 'lucide-react';

interface ShopWithPendingMint {
  shop_id: string;
  name: string;
  wallet_address: string;
  purchased_rcn_balance: number;
  blockchain_balance: number;
  pending_mint_amount: number;
}

export const PendingMintsSection: React.FC = () => {
  const { generateAdminToken, setError: onError } = useAdminDashboard();
  const [shops, setShops] = useState<ShopWithPendingMint[]>([]);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPendingMints();
  }, []);

  const loadPendingMints = async () => {
    setLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      // Fetch shops with pending mints
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/pending-mints`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setShops(result.data || []);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to load pending mints');
      }
    } catch (error) {
      console.error('Error loading pending mints:', error);
      onError('Failed to load pending mints data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingMints();
    setRefreshing(false);
    toast.success('Refreshed pending mints data');
  };

  const handleMint = async (shop: ShopWithPendingMint) => {
    if (minting[shop.shop_id]) return;

    setMinting(prev => ({ ...prev, [shop.shop_id]: true }));
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shop.shop_id}/mint-balance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: shop.pending_mint_amount
        })
      });

      if (response.ok) {
        const result = await response.json();
        const txHash = result.data?.transactionHash || result.transactionHash;
        
        toast.success(
          <div>
            <p className="font-semibold">Minting Successful! 🎉</p>
            <p className="text-sm mt-1">
              Minted {formatNumber(shop.pending_mint_amount)} RCN to {shop.name}
            </p>
            {txHash && (
              <div className="mt-2">
                <p className="text-xs text-gray-300">Transaction Hash:</p>
                <a 
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
                </a>
              </div>
            )}
          </div>,
          { duration: 8000 }
        );
        
        // Reload the data to update the list
        await loadPendingMints();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to mint tokens';
        
        // Check for specific error types and show appropriate toast
        if (errorMessage.includes('MINTER_ROLE') || errorMessage.includes('Insufficient permissions')) {
          toast.error(
            <div>
              <p className="font-semibold">Permission Denied</p>
              <p className="text-sm mt-1">Admin wallet lacks MINTER_ROLE on the contract.</p>
              <p className="text-xs mt-2 text-gray-300">Contact the contract owner to grant minting permissions.</p>
            </div>,
            { duration: 8000 }
          );
        } else if (errorMessage.includes('Insufficient ETH') || errorMessage.includes('gas fees')) {
          toast.error(
            <div>
              <p className="font-semibold">Insufficient Gas</p>
              <p className="text-sm mt-1">Admin wallet needs Base Sepolia ETH for gas fees.</p>
              <p className="text-xs mt-2 text-gray-300">Fund the admin wallet to continue minting.</p>
            </div>,
            { duration: 6000 }
          );
        } else if (errorMessage.includes('paused')) {
          toast.error(
            <div>
              <p className="font-semibold">Contract Paused</p>
              <p className="text-sm mt-1">The RCN contract is currently paused.</p>
              <p className="text-xs mt-2 text-gray-300">Unpause the contract to enable minting.</p>
            </div>,
            { duration: 6000 }
          );
        } else if (errorMessage.includes('No balance to mint')) {
          toast.error(
            <div>
              <p className="font-semibold">No Pending Balance</p>
              <p className="text-sm mt-1">This shop has no unminted balance.</p>
              <p className="text-xs mt-2 text-gray-300">The tokens may have already been minted.</p>
            </div>,
            { duration: 5000 }
          );
        } else {
          // Generic error toast
          toast.error(
            <div>
              <p className="font-semibold">Minting Failed</p>
              <p className="text-sm mt-1">{errorMessage}</p>
            </div>,
            { duration: 5000 }
          );
        }
        
        onError(errorMessage);
      }
    } catch (error) {
      console.error('Error minting tokens:', error);
      onError('Failed to mint tokens to shop');
    } finally {
      setMinting(prev => ({ ...prev, [shop.shop_id]: false }));
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Pending Blockchain Mints</h3>
          <p className="text-sm text-gray-400 mt-1">
            Shops with database RCN balances awaiting blockchain minting
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {shops.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">All shops are synchronized!</p>
          <p className="text-sm text-gray-500 mt-2">
            No pending mints at this time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold">Pending Mints Detected</p>
                <p className="text-sm text-gray-300 mt-1">
                  {shops.length} shop{shops.length > 1 ? 's have' : ' has'} purchased RCN tokens that need to be minted on the blockchain.
                </p>
              </div>
            </div>
          </div>

          {shops.map((shop) => (
            <div 
              key={shop.shop_id} 
              className="bg-gray-900 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-900/30 rounded-lg">
                      <Zap className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{shop.name}</h4>
                      <p className="text-sm text-gray-400">Shop ID: {shop.shop_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-gray-400">Database Balance</p>
                      </div>
                      <p className="text-lg font-bold text-white">
                        {formatNumber(shop.purchased_rcn_balance)} RCN
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(shop.purchased_rcn_balance * 0.10)}
                      </p>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <p className="text-xs text-gray-400">Blockchain Balance</p>
                      </div>
                      <p className="text-lg font-bold text-white">
                        {formatNumber(shop.blockchain_balance)} RCN
                      </p>
                      <p className="text-xs text-gray-500">Currently on-chain</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-lg p-3 border border-yellow-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs text-gray-400">Pending Amount</p>
                      </div>
                      <p className="text-lg font-bold text-yellow-400">
                        {formatNumber(shop.pending_mint_amount)} RCN
                      </p>
                      <p className="text-xs text-gray-500">Needs minting</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <p>Wallet: </p>
                    <code className="font-mono bg-gray-800 px-2 py-1 rounded text-xs">
                      {shop.wallet_address}
                    </code>
                  </div>
                </div>

                <div className="ml-4">
                  <button
                    onClick={() => handleMint(shop)}
                    disabled={minting[shop.shop_id]}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {minting[shop.shop_id] ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Minting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Mint Tokens
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};