'use client';

import React, { useState, useEffect } from 'react';
import { SuspendShopModal, UnsuspendShopModal } from '../ConfirmationModal';
import { EditShopModal } from './EditShopModal';
import { getContract, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { createThirdwebClient } from 'thirdweb';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  totalTokensIssued?: number;
  totalRedemptions?: number;
  crossShopEnabled?: boolean;
  cross_shop_enabled?: boolean;
  purchasedRcnBalance?: number;
  walletAddress?: string;
  walletBalance?: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
}

interface ShopsTabProps {
  shops: Shop[];
  onVerifyShop: (shopId: string) => Promise<void>;
  onSuspendShop: (shopId: string) => Promise<void>;
  onUnsuspendShop: (shopId: string) => Promise<void>;
  onEditShop?: (shop: Shop) => void;
  onMintBalance?: (shopId: string) => Promise<void>;
  onRefresh: () => void;
  generateAdminToken?: () => Promise<string | null>;
}

export const ShopsTab: React.FC<ShopsTabProps> = ({
  shops,
  onVerifyShop,
  onSuspendShop,
  onUnsuspendShop,
  onEditShop,
  onMintBalance,
  onRefresh,
  generateAdminToken
}) => {
  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [unsuspendModal, setUnsuspendModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [editModal, setEditModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [shopBalances, setShopBalances] = useState<Record<string, number>>({});

  // Fetch wallet balances for all shops
  useEffect(() => {
    const fetchBalances = async () => {
      const contract = getContract({
        client,
        chain: baseSepolia,
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      });

      const balances: Record<string, number> = {};
      
      for (const shop of shops) {
        if (shop.walletAddress) {
          try {
            const balance = await readContract({
              contract,
              method: "function balanceOf(address account) view returns (uint256)",
              params: [shop.walletAddress as `0x${string}`],
            });
            
            // Convert from BigInt to number and from wei to RCN
            balances[shop.shopId] = Number(balance) / 10**18;
          } catch (error) {
            console.error(`Error fetching balance for shop ${shop.shopId}:`, error);
            balances[shop.shopId] = 0;
          }
        }
      }
      
      setShopBalances(balances);
    };

    if (shops.length > 0) {
      fetchBalances();
    }
  }, [shops]);

  const handleSuspend = async () => {
    if (!suspendModal.shop) return;
    
    setIsProcessing(true);
    try {
      await onSuspendShop(suspendModal.shop.shopId);
      setSuspendModal({ isOpen: false, shop: null });
      onRefresh();
    } catch (error) {
      console.error('Error suspending shop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!unsuspendModal.shop) return;
    
    setIsProcessing(true);
    try {
      await onUnsuspendShop(unsuspendModal.shop.shopId);
      setUnsuspendModal({ isOpen: false, shop: null });
      onRefresh();
    } catch (error) {
      console.error('Error unsuspending shop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerify = async (shopId: string) => {
    setIsProcessing(true);
    try {
      await onVerifyShop(shopId);
      onRefresh();
    } catch (error) {
      console.error('Error verifying shop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMintBalance = async (shopId: string) => {
    if (!onMintBalance) return;
    
    setIsProcessing(true);
    try {
      await onMintBalance(shopId);
      onRefresh();
    } catch (error) {
      console.error('Error minting balance:', error);
      alert(`Failed to mint balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Shop Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokens Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchased Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cross-Shop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shops.map((shop) => (
                <tr key={shop.shopId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                      <div className="text-sm text-gray-500">{shop.shopId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        shop.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {shop.active ? 'Active' : 'Suspended'}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        shop.verified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shop.verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shop.totalTokensIssued || 0} RCN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(shop.purchasedRcnBalance || 0).toFixed(2)} RCN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shopBalances[shop.shopId] !== undefined ? `${shopBalances[shop.shopId].toFixed(2)} RCN` : 'Loading...'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      (shop.crossShopEnabled || shop.cross_shop_enabled) 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(shop.crossShopEnabled || shop.cross_shop_enabled) ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setEditModal({ isOpen: true, shop })}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      {!shop.verified && (
                        <button 
                          onClick={() => handleVerify(shop.shopId)}
                          disabled={isProcessing}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          Verify
                        </button>
                      )}
                      {shop.purchasedRcnBalance && shop.purchasedRcnBalance > 0 && (
                        <button 
                          onClick={() => handleMintBalance(shop.shopId)}
                          disabled={isProcessing}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title={`Mint ${shop.purchasedRcnBalance} RCN to blockchain`}
                        >
                          Mint to Chain
                        </button>
                      )}
                      {shop.active ? (
                        <button 
                          onClick={() => setSuspendModal({ isOpen: true, shop })}
                          className="text-red-600 hover:text-red-900"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button 
                          onClick={() => setUnsuspendModal({ isOpen: true, shop })}
                          className="text-green-600 hover:text-green-900"
                        >
                          Unsuspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {suspendModal.shop && (
        <SuspendShopModal
          isOpen={suspendModal.isOpen}
          onClose={() => setSuspendModal({ isOpen: false, shop: null })}
          onConfirm={handleSuspend}
          shopName={suspendModal.shop.name}
          shopId={suspendModal.shop.shopId}
          isLoading={isProcessing}
        />
      )}

      {unsuspendModal.shop && (
        <UnsuspendShopModal
          isOpen={unsuspendModal.isOpen}
          onClose={() => setUnsuspendModal({ isOpen: false, shop: null })}
          onConfirm={handleUnsuspend}
          shopName={unsuspendModal.shop.name}
          shopId={unsuspendModal.shop.shopId}
          isLoading={isProcessing}
        />
      )}

      {editModal.shop && generateAdminToken && (
        <EditShopModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, shop: null })}
          shop={editModal.shop}
          generateAdminToken={generateAdminToken}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
};