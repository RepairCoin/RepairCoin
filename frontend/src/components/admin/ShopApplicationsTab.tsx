'use client';

import React, { useState } from 'react';

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
  suspended_at?: string;
  suspension_reason?: string;
}

interface ShopApplicationsTabProps {
  pendingShops: Shop[];
  rejectedShops?: Shop[];
  onApproveShop: (shopId: string) => Promise<void>;
  onReviewShop?: (shopId: string) => void;
  onRejectShop?: (shopId: string) => Promise<void>;
  onRefresh: () => void;
}

export const ShopApplicationsTab: React.FC<ShopApplicationsTabProps> = ({
  pendingShops,
  rejectedShops = [],
  onApproveShop,
  onReviewShop,
  onRejectShop,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');
  const [processingShopId, setProcessingShopId] = useState<string | null>(null);

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

  const displayedShops = activeTab === 'pending' ? pendingShops : rejectedShops;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Shop Applications</h2>
        <p className="text-gray-600 mt-1">Review and manage shop applications</p>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Applications ({pendingShops.length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rejected'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Rejected Applications ({rejectedShops.length})
          </button>
        </nav>
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
            {displayedShops.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">{activeTab === 'pending' ? '📝' : '❌'}</div>
                  <p>{activeTab === 'pending' ? 'No pending shop applications' : 'No rejected shop applications'}</p>
                </td>
              </tr>
            ) : (
              displayedShops.map((shop) => (
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
                    <div className="flex flex-col space-y-1">
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (shop.active ?? true) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(shop.active ?? true) ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (shop.verified ?? false) ? 'bg-blue-100 text-blue-800' : 
                          activeTab === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(shop.verified ?? false) ? 'Verified' : 
                           activeTab === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </span>
                      </div>
                      {activeTab === 'rejected' && shop.suspension_reason && (
                        <p className="text-xs text-gray-500">{shop.suspension_reason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(shop.joinDate || shop.join_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {activeTab === 'pending' ? (
                        <>
                          <button
                            onClick={async () => {
                              const shopId = shop.shopId || shop.shop_id || '';
                              setProcessingShopId(shopId);
                              try {
                                await onApproveShop(shopId);
                                onRefresh();
                              } finally {
                                setProcessingShopId(null);
                              }
                            }}
                            disabled={processingShopId === (shop.shopId || shop.shop_id)}
                            className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {processingShopId === (shop.shopId || shop.shop_id) ? '...' : '✓ Approve'}
                          </button>
                          <button 
                            onClick={() => onReviewShop?.(shop.shopId || shop.shop_id || '')}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                          >
                            👁 Review
                          </button>
                          <button 
                            onClick={async () => {
                              if (onRejectShop) {
                                const shopId = shop.shopId || shop.shop_id || '';
                                setProcessingShopId(shopId);
                                try {
                                  await onRejectShop(shopId);
                                  onRefresh();
                                } finally {
                                  setProcessingShopId(null);
                                }
                              }
                            }}
                            disabled={processingShopId === (shop.shopId || shop.shop_id)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {processingShopId === (shop.shopId || shop.shop_id) ? '...' : '✗ Reject'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => onReviewShop?.(shop.shopId || shop.shop_id || '')}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                          >
                            👁 View Details
                          </button>
                          <button
                            onClick={async () => {
                              await onApproveShop(shop.shopId || shop.shop_id || '');
                              onRefresh();
                            }}
                            className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                          >
                            ↻ Reconsider
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};