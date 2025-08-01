'use client';

import React, { useState } from 'react';

interface CustomerData {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
  isActive: boolean;
  lastEarnedDate?: string;
  homeShopId?: string;
  earningsByShop: { [shopId: string]: number };
}

interface CustomerLookupTabProps {
  shopId: string;
}

export const CustomerLookupTab: React.FC<CustomerLookupTabProps> = ({ shopId }) => {
  const [searchAddress, setSearchAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  const lookupCustomer = async () => {
    if (!searchAddress) {
      setError('Please enter a customer wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    setCustomerData(null);

    try {
      // Get earned balance
      const earnedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${searchAddress}`
      );

      if (!earnedResponse.ok) {
        throw new Error('Customer not found');
      }

      const earnedData = await earnedResponse.json();

      // Get earning sources
      const sourcesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earning-sources/${searchAddress}`
      );

      let earningsByShop = {};
      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        earningsByShop = sourcesData.data.earningsByShop || {};
      }

      // Get customer details
      const customerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${searchAddress}`
      );

      let customerInfo = null;
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        customerInfo = customerResult.data;
      }

      setCustomerData({
        address: searchAddress,
        name: customerInfo?.name,
        tier: customerInfo?.tier || 'BRONZE',
        lifetimeEarnings: customerInfo?.lifetimeEarnings || earnedData.data.earnedBalance,
        earnedBalance: earnedData.data.earnedBalance,
        marketBalance: earnedData.data.marketBalance,
        totalBalance: earnedData.data.totalBalance,
        isActive: customerInfo?.isActive ?? true,
        lastEarnedDate: customerInfo?.lastEarnedDate,
        homeShopId: earnedData.data.homeShopId,
        earningsByShop
      });
    } catch (err) {
      console.error('Lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to lookup customer');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMaxRedeemable = () => {
    if (!customerData) return 0;
    const isHomeShop = customerData.homeShopId === shopId;
    return isHomeShop ? customerData.earnedBalance : Math.floor(customerData.earnedBalance * 0.2);
  };

  return (
    <div className="space-y-8">
      {/* Search Form */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Lookup</h2>
        
        <div className="flex gap-4">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder="Enter customer wallet address (0x...)"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={lookupCustomer}
            disabled={loading || !searchAddress}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex">
            <div className="text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details */}
      {customerData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Customer Information</h3>
            
            <div className="space-y-4">
              <InfoRow label="Wallet Address" value={customerData.address} mono />
              {customerData.name && <InfoRow label="Name" value={customerData.name} />}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tier Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getTierColor(customerData.tier)}`}>
                  {customerData.tier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Account Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  customerData.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {customerData.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
              <InfoRow label="Lifetime Earnings" value={`${customerData.lifetimeEarnings} RCN`} />
              {customerData.lastEarnedDate && (
                <InfoRow 
                  label="Last Earned" 
                  value={new Date(customerData.lastEarnedDate).toLocaleDateString()} 
                />
              )}
            </div>
          </div>

          {/* Balance Information */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Balance Details</h3>
            
            <div className="space-y-4">
              <BalanceRow 
                label="Earned Balance" 
                value={customerData.earnedBalance} 
                subtext="Redeemable at shops"
                color="green"
              />
              <BalanceRow 
                label="Market Balance" 
                value={customerData.marketBalance} 
                subtext="Not redeemable"
                color="red"
              />
              <div className="border-t pt-4">
                <BalanceRow 
                  label="Total Balance" 
                  value={customerData.totalBalance} 
                  subtext="On blockchain"
                  color="blue"
                />
              </div>
            </div>

            <div className={`mt-6 p-4 rounded-xl ${
              customerData.homeShopId === shopId 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h4 className="font-semibold text-gray-900 mb-2">
                {customerData.homeShopId === shopId ? '🏠 Home Shop Customer' : '🔄 Cross-Shop Customer'}
              </h4>
              <p className="text-sm text-gray-700">
                Max redeemable at your shop: <span className="font-bold">{getMaxRedeemable()} RCN</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {customerData.homeShopId === shopId 
                  ? '100% of earned balance can be redeemed'
                  : '20% of earned balance can be redeemed (cross-shop limit)'}
              </p>
            </div>
          </div>

          {/* Earning Sources */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 lg:col-span-2">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Earnings by Shop</h3>
            
            {Object.keys(customerData.earningsByShop).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(customerData.earningsByShop)
                  .sort(([, a], [, b]) => b - a)
                  .map(([shop, amount]) => (
                    <div key={shop} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900">{shop}</span>
                        {shop === shopId && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Your Shop
                          </span>
                        )}
                        {shop === customerData.homeShopId && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Home Shop
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">{amount} RCN</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No earning history available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono }) => {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium text-gray-900 ${mono ? 'font-mono text-sm' : ''}`}>
        {mono && value.length > 20 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value}
      </span>
    </div>
  );
};

interface BalanceRowProps {
  label: string;
  value: number;
  subtext: string;
  color: 'green' | 'red' | 'blue';
}

const BalanceRow: React.FC<BalanceRowProps> = ({ label, value, subtext, color }) => {
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-600">{label}</p>
        <p className="text-xs text-gray-400">{subtext}</p>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value} RCN</p>
    </div>
  );
};