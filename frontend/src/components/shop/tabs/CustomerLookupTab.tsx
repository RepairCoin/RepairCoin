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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Customer Lookup</h1>
        <p className="text-gray-400">Search and verify customer information</p>
      </div>

      {/* Search Section */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800 mb-8">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Search Customer</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              onKeyPress={(e) => e.key === 'Enter' && lookupCustomer()}
              className="w-full px-4 py-3 pl-12 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder-gray-500"
            />
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <button
            onClick={lookupCustomer}
            disabled={loading || !searchAddress}
            className="px-8 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4 mb-8">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Customer Details */}
      {customerData && (
        <div className="animate-fadeIn">
          {/* Quick Summary Card */}
          <div className="bg-gradient-to-r from-[#FFCC00] to-[#FFA500] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-opacity-70 text-sm">Customer Status</p>
                <h3 className="text-2xl font-bold text-black mb-1">
                  {customerData.name || 'Anonymous Customer'}
                </h3>
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    customerData.tier === 'GOLD'
                      ? 'bg-black bg-opacity-20 text-black'
                      : customerData.tier === 'SILVER'
                      ? 'bg-white bg-opacity-30 text-black'
                      : 'bg-orange-900 bg-opacity-30 text-black'
                  }`}>
                    {customerData.tier === 'GOLD' && '👑'} {customerData.tier} TIER
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    customerData.isActive 
                      ? 'bg-green-900 bg-opacity-30 text-black' 
                      : 'bg-red-900 bg-opacity-30 text-black'
                  }`}>
                    {customerData.isActive ? '✓ Active' : '✗ Suspended'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-black text-opacity-70 text-sm">Max Redeemable</p>
                <p className="text-3xl font-bold text-black">{getMaxRedeemable()}</p>
                <p className="text-black text-opacity-70 text-sm">RCN</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer Profile Card */}
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Profile</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Wallet Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-white text-sm font-mono bg-[#0D0D0D] px-2 py-1 rounded">
                        {customerData.address.slice(0, 6)}...{customerData.address.slice(-4)}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(customerData.address)}
                        className="text-gray-400 hover:text-[#FFCC00] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-1">Lifetime Earnings</p>
                    <p className="text-2xl font-bold text-[#FFCC00]">{customerData.lifetimeEarnings} RCN</p>
                  </div>

                  {customerData.lastEarnedDate && (
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Last Activity</p>
                      <p className="text-white text-sm">
                        {new Date(customerData.lastEarnedDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-700">
                    <div className={`rounded-xl p-3 ${
                      customerData.homeShopId === shopId
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/50'
                        : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            customerData.homeShopId === shopId 
                              ? 'bg-green-500/30' 
                              : 'bg-yellow-500/30'
                          }`}>
                            {customerData.homeShopId === shopId ? (
                              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${
                              customerData.homeShopId === shopId 
                                ? 'text-green-400' 
                                : 'text-yellow-400'
                            }`}>
                              {customerData.homeShopId === shopId ? 'Home Customer' : 'Cross-Shop'}
                            </p>
                            <p className={`text-xs ${
                              customerData.homeShopId === shopId 
                                ? 'text-green-300' 
                                : 'text-yellow-300'
                            }`}>
                              {customerData.homeShopId === shopId 
                                ? '100% redeemable' 
                                : '20% limit'}
                            </p>
                          </div>
                        </div>
                        <div className={`text-right ${
                          customerData.homeShopId === shopId 
                            ? 'text-green-400' 
                            : 'text-yellow-400'
                        }`}>
                          <p className="text-xs font-medium">Max</p>
                          <p className="text-sm font-bold">{getMaxRedeemable()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Breakdown Card */}
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Balances</h3>
                </div>

                <div className="space-y-4">
                  {/* Earned Balance */}
                  <div className="p-3 bg-green-900 bg-opacity-20 rounded-lg border border-green-500 border-opacity-30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-green-400 text-xs font-medium">Earned Balance</p>
                        <p className="text-gray-400 text-xs mt-1">Redeemable</p>
                      </div>
                      <p className="text-green-400 text-xl font-bold">{customerData.earnedBalance}</p>
                    </div>
                  </div>

                  {/* Market Balance */}
                  <div className="p-3 bg-red-900 bg-opacity-20 rounded-lg border border-red-500 border-opacity-30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-red-400 text-xs font-medium">Market Balance</p>
                        <p className="text-gray-400 text-xs mt-1">Not redeemable</p>
                      </div>
                      <p className="text-red-400 text-xl font-bold">{customerData.marketBalance}</p>
                    </div>
                  </div>

                  {/* Total Balance */}
                  <div className="pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white text-sm font-medium">Total Balance</p>
                        <p className="text-gray-400 text-xs">On blockchain</p>
                      </div>
                      <p className="text-[#FFCC00] text-2xl font-bold">{customerData.totalBalance}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Earning Sources Card */}
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Earning Sources</h3>
                </div>

                {Object.keys(customerData.earningsByShop).length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(customerData.earningsByShop)
                      .sort(([, a], [, b]) => b - a)
                      .map(([shop, amount], index) => (
                        <div key={shop} className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg hover:bg-opacity-70 transition-all">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-[#FFCC00] text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              index === 2 ? 'bg-orange-500 text-white' :
                              'bg-gray-600 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{shop}</p>
                              <div className="flex gap-1 mt-1">
                                {shop === shopId && (
                                  <span className="text-xs bg-blue-900 bg-opacity-30 text-blue-400 px-2 py-0.5 rounded">
                                    Your Shop
                                  </span>
                                )}
                                {shop === customerData.homeShopId && (
                                  <span className="text-xs bg-green-900 bg-opacity-30 text-green-400 px-2 py-0.5 rounded">
                                    Home
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[#FFCC00] font-bold">{amount}</p>
                            <p className="text-gray-500 text-xs">RCN</p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-gray-500 text-sm">No earning history</p>
                  </div>
                )}
              </div>
            </div>
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
      <span className="text-gray-100">{label}</span>
      <span className={`font-medium text-gray-400 ${mono ? 'font-mono text-sm' : ''}`}>
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
        <p className="text-gray-100">{label}</p>
        <p className="text-xs text-gray-400">{subtext}</p>
      </div>
      <p className={`text-2xl font-semibold text-lg ${colorClasses[color]}`}>{value} RCN</p>
    </div>
  );
};