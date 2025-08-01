'use client';

import React, { useState } from 'react';
import { SuspendShopModal, UnsuspendShopModal } from '../ConfirmationModal';

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
  onRefresh: () => void;
}

export const ShopsTab: React.FC<ShopsTabProps> = ({
  shops,
  onVerifyShop,
  onSuspendShop,
  onUnsuspendShop,
  onEditShop,
  onRefresh
}) => {
  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [unsuspendModal, setUnsuspendModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [isProcessing, setIsProcessing] = useState(false);

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
                  RCN Balance
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
                        onClick={() => onEditShop?.(shop)}
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
    </>
  );
};