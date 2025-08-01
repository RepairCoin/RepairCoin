'use client';

import React, { useState } from 'react';
import { ApproveShopModal } from '../ConfirmationModal';

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  email?: string;
  phone?: string;
  walletAddress?: string;
  wallet_address?: string;
  joinDate?: string;
  join_date?: string;
}

interface ShopApplicationsTabProps {
  pendingShops: Shop[];
  onApproveShop: (shopId: string) => Promise<void>;
  onReviewShop?: (shopId: string) => void;
  onRejectShop?: (shopId: string) => void;
  onRefresh: () => void;
}

export const ShopApplicationsTab: React.FC<ShopApplicationsTabProps> = ({
  pendingShops,
  onApproveShop,
  onReviewShop,
  onRejectShop,
  onRefresh
}) => {
  const [approveModal, setApproveModal] = useState<{ isOpen: boolean; shop: Shop | null }>({
    isOpen: false,
    shop: null
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    if (!approveModal.shop) return;
    
    setIsProcessing(true);
    try {
      const shopId = approveModal.shop.shopId || approveModal.shop.shop_id || '';
      await onApproveShop(shopId);
      setApproveModal({ isOpen: false, shop: null });
      onRefresh();
    } catch (error) {
      console.error('Error approving shop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };

  const getWalletDisplay = (shop: Shop) => {
    const wallet = shop.walletAddress || shop.wallet_address;
    if (!wallet) return 'Not provided';
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Shop Applications</h2>
          <p className="text-gray-600 mt-1">Review and approve pending shop applications</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingShops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="text-4xl mb-2">📝</div>
                    <p>No pending shop applications</p>
                  </td>
                </tr>
              ) : (
                pendingShops.map((shop) => (
                  <tr key={shop.shopId || shop.shop_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                        <div className="text-sm text-gray-500">{shop.shopId || shop.shop_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{shop.email}</div>
                        <div className="text-sm text-gray-500">{shop.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {getWalletDisplay(shop)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (shop.active ?? true) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(shop.active ?? true) ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (shop.verified ?? false) ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(shop.verified ?? false) ? 'Verified' : 'Pending Review'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(shop.joinDate || shop.join_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setApproveModal({ isOpen: true, shop })}
                          className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        >
                          ✓ Approve
                        </button>
                        <button 
                          onClick={() => onReviewShop?.(shop.shopId || shop.shop_id || '')}
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        >
                          👁 Review
                        </button>
                        <button 
                          onClick={() => onRejectShop?.(shop.shopId || shop.shop_id || '')}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {approveModal.shop && (
        <ApproveShopModal
          isOpen={approveModal.isOpen}
          onClose={() => setApproveModal({ isOpen: false, shop: null })}
          onConfirm={handleApprove}
          shopName={approveModal.shop.name}
          shopId={approveModal.shop.shopId || approveModal.shop.shop_id || ''}
          isLoading={isProcessing}
        />
      )}
    </>
  );
};