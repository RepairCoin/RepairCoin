'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface TreasuryData {
  totalSupply: number | string;
  availableSupply: number | string;
  totalSold: number;
  totalRevenue: number;
  lastUpdated: string;
  circulatingSupply?: number;
  mintedRewards?: number;
  topBuyers: Array<{
    shopId?: string;
    shop_id?: string;
    shopName?: string;
    shop_name?: string;
    totalPurchased?: number;
    total_purchased?: string | number;
    totalSpent?: number;
    total_spent?: string | number;
  }>;
  recentPurchases: Array<{
    id: string;
    shopId?: string;
    shop_id?: string;
    shopName?: string;
    shop_name?: string;
    amount?: number;
    rcn_amount?: string | number;
    totalCost?: number;
    total_cost?: string | number;
    createdAt?: string;
    purchase_date?: string;
    payment_method?: string;
    payment_reference?: string;
    status?: string;
  }>;
}

interface TreasuryTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export const TreasuryTab: React.FC<TreasuryTabProps> = ({ generateAdminToken, onError }) => {
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Sell RCN form state
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [sellAmount, setSellAmount] = useState(100);
  const [shops, setShops] = useState<Array<{shopId: string; name: string}>>([]);

  useEffect(() => {
    loadTreasuryData();
    loadShops();
  }, []);

  const loadTreasuryData = async () => {
    setLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setTreasuryData(result.data);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to load treasury data');
      }
    } catch (error) {
      console.error('Error loading treasury data:', error);
      onError('Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  };

  const loadShops = async () => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops?verified=true`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const shopsData = result.data?.shops || result.data || [];
        setShops(shopsData.map((shop: any) => ({
          shopId: shop.shop_id || shop.shopId,
          name: shop.name
        })));
      } else {
        console.error('Failed to load shops:', response.status);
      }
    } catch (error) {
      console.error('Error loading shops:', error);
    }
  };

  const updateTreasuryData = async () => {
    setUpdating(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await loadTreasuryData();
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to update treasury data');
      }
    } catch (error) {
      console.error('Error updating treasury:', error);
      onError('Failed to update treasury data');
    } finally {
      setUpdating(false);
    }
  };

  const handleSellRCN = async () => {
    if (!selectedShopId || sellAmount <= 0) return;
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${selectedShopId}/sell-rcn`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: sellAmount,
          pricePerToken: 0.10,
          paymentMethod: 'manual',
          paymentReference: `ADMIN-${Date.now()}`
        })
      });

      if (response.ok) {
        toast.success(`Successfully sold ${sellAmount} RCN to shop`);
        setShowSellModal(false);
        setSellAmount(100);
        setSelectedShopId('');
        await loadTreasuryData();
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to sell RCN');
      }
    } catch (error) {
      console.error('Error selling RCN:', error);
      onError('Failed to sell RCN to shop');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!treasuryData) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Treasury Management</h2>
        <p className="text-gray-400">Failed to load treasury data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Treasury Overview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSellModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Sell RCN to Shop
            </button>
            <button
              onClick={updateTreasuryData}
              disabled={updating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update Data'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 border border-blue-700">
            <div className="text-3xl mb-2">💎</div>
            <p className="text-sm text-gray-400 mb-1">Total Supply</p>
            <p className="text-2xl font-bold text-white">
              {typeof treasuryData.totalSupply === 'string' 
                ? treasuryData.totalSupply 
                : formatNumber(treasuryData.totalSupply)} RCN
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-6 border border-green-700">
            <div className="text-3xl mb-2">🏦</div>
            <p className="text-sm text-gray-400 mb-1">Available in Treasury</p>
            <p className="text-2xl font-bold text-white">
              {typeof treasuryData.availableSupply === 'string' 
                ? treasuryData.availableSupply 
                : formatNumber(treasuryData.availableSupply)} RCN
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-700">
            <div className="text-3xl mb-2">💰</div>
            <p className="text-sm text-gray-400 mb-1">Total Sold to Shops</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalSold)} RCN</p>
            <p className="text-sm text-purple-400 mt-1">Shops purchased @ $0.10/RCN</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-xl p-6 border border-yellow-700">
            <div className="text-3xl mb-2">💵</div>
            <p className="text-sm text-gray-400 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(treasuryData.totalRevenue)}</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Last updated: {new Date(treasuryData.lastUpdated).toLocaleString()}
        </p>
      </div>

      {/* Top Buyers */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Top RCN Buyers</h3>
        {treasuryData.topBuyers.length === 0 ? (
          <p className="text-gray-400">No purchases yet</p>
        ) : (
          <div className="space-y-3">
            {treasuryData.topBuyers.map((buyer, index) => (
              <div key={buyer.shop_id || buyer.shopId || `buyer-${index}`} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-500">#{index + 1}</div>
                  <div>
                    <p className="font-semibold text-white">{buyer.shop_name || buyer.shopName}</p>
                    <p className="text-sm text-gray-400">Shop ID: {buyer.shop_id || buyer.shopId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{formatNumber(Number(buyer.total_purchased || buyer.totalPurchased || 0))} RCN</p>
                  <p className="text-sm text-gray-400">{formatCurrency(Number(buyer.total_spent || buyer.totalSpent || 0))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Purchases */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent RCN Purchases</h3>
        {treasuryData.recentPurchases.length === 0 ? (
          <p className="text-gray-400">No recent purchases</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {treasuryData.recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{purchase.shop_name || purchase.shopName}</div>
                      <div className="text-sm text-gray-400">{purchase.shop_id || purchase.shopId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatNumber(Number(purchase.rcn_amount || purchase.amount || 0))} RCN
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(Number(purchase.total_cost || purchase.totalCost || 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(purchase.purchase_date || purchase.createdAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-400`}>
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sell RCN Modal */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Sell RCN to Shop</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Shop</label>
                <select
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a shop...</option>
                  {shops.map((shop) => (
                    <option key={shop.shopId} value={shop.shopId}>
                      {shop.name} ({shop.shopId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount (RCN)</label>
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-400 mt-1">Total: {formatCurrency(sellAmount * 0.10)}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSellModal(false)}
                className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSellRCN}
                disabled={!selectedShopId || sellAmount <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sell {sellAmount} RCN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};