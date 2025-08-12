'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface Customer {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  totalTransactions?: number;
  isActive: boolean;
  joinDate?: string;
  referralCode?: string;
}

interface ShopWithCustomers {
  shopId: string;
  shopName: string;
  totalCustomers: number;
  customers: Customer[];
}

interface GroupedCustomersData {
  totalShops: number;
  totalCustomersWithShops: number;
  totalCustomersWithoutShops: number;
  totalCustomers: number;
  shopsWithCustomers: ShopWithCustomers[];
  customersWithoutShops: Customer[];
}

interface CustomersTabEnhancedProps {
  generateAdminToken: () => Promise<string | null>;
  onMintTokens: (address: string, amount: number, reason: string) => void;
  onRefresh: () => void;
}

export const CustomersTabEnhanced: React.FC<CustomersTabEnhancedProps> = ({
  generateAdminToken,
  onMintTokens,
  onRefresh
}) => {
  const [data, setData] = useState<GroupedCustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grouped' | 'all' | 'no-shop'>('grouped');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCustomersData();
  }, []);

  const loadCustomersData = async () => {
    setLoading(true);
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error('Failed to authenticate as admin');
        setLoading(false);
        return;
      }

      console.log('Loading grouped customers data...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/customers/grouped-by-shop`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Grouped customers data:', result);
        setData(result.data);
      } else {
        const errorData = await response.json();
        console.error('Failed to load customers:', errorData);
        toast.error(errorData.error || 'Failed to load customer data');
        
        // If unauthorized, prompt to refresh token
        if (response.status === 401) {
          toast.error('Session expired. Please refresh the page.');
        }
      }
    } catch (error) {
      console.error('Error loading grouped customers:', error);
      toast.error('Network error while loading customer data');
    } finally {
      setLoading(false);
    }
  };

  const toggleShopExpansion = (shopId: string) => {
    const newExpanded = new Set(expandedShops);
    if (newExpanded.has(shopId)) {
      newExpanded.delete(shopId);
    } else {
      newExpanded.add(shopId);
    }
    setExpandedShops(newExpanded);
  };

  const expandAll = () => {
    if (data) {
      setExpandedShops(new Set(data.shopsWithCustomers.map(s => s.shopId)));
    }
  };

  const collapseAll = () => {
    setExpandedShops(new Set());
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };


  const filterCustomers = (customers: Customer[]) => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.address.toLowerCase().includes(term) ||
      c.name?.toLowerCase().includes(term) ||
      c.referralCode?.toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <p className="text-center text-gray-500">No customer data available</p>
      </div>
    );
  }

  // Get all customers for 'all' view
  const allCustomers = [
    ...data.shopsWithCustomers.flatMap(shop => shop.customers),
    ...data.customersWithoutShops
  ];

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-blue-600">{data.totalCustomers}</div>
            <div className="text-sm text-blue-700">Total Customers</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-600">{data.totalCustomersWithShops}</div>
            <div className="text-sm text-green-700">Active in Shops</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-600">{data.totalCustomersWithoutShops}</div>
            <div className="text-sm text-yellow-700">No Shop Activity</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-purple-600">{data.totalShops}</div>
            <div className="text-sm text-purple-700">Active Shops</div>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'grouped' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Grouped by Shop
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Customers
          </button>
          <button
            onClick={() => setViewMode('no-shop')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'no-shop' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            No Shop Activity ({data.totalCustomersWithoutShops})
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by address, name, or referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          {viewMode === 'grouped' && (
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Collapse All
              </button>
            </div>
          )}
          <button
            onClick={() => {
              onRefresh();
              loadCustomersData();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {data.shopsWithCustomers.map(shop => {
            const isExpanded = expandedShops.has(shop.shopId);
            const filteredCustomers = filterCustomers(shop.customers);
            
            if (searchTerm && filteredCustomers.length === 0) return null;
            
            return (
              <div key={shop.shopId} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleShopExpansion(shop.shopId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{shop.shopName}</h3>
                        <p className="text-sm text-gray-500">Shop ID: {shop.shopId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">
                        {searchTerm ? filteredCustomers.length : shop.totalCustomers}
                      </div>
                      <div className="text-sm text-gray-500">Customers</div>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="max-h-96 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          No customers found matching "{searchTerm}"
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings (Shop)</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredCustomers.map(customer => (
                              <tr key={customer.address} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {customer.name || formatAddress(customer.address)}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                      {formatAddress(customer.address)}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTierColor(customer.tier)}`}>
                                    {customer.tier}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                  {customer.lifetimeEarnings} RCN
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                  {customer.totalTransactions || 0}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {customer.lastTransactionDate 
                                    ? new Date(customer.lastTransactionDate).toLocaleDateString()
                                    : 'N/A'
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'all' && (
        <CustomerTable 
          customers={filterCustomers(allCustomers)}
          showShopInfo={false}
        />
      )}

      {viewMode === 'no-shop' && (
        <CustomerTable 
          customers={filterCustomers(data.customersWithoutShops)}
          showShopInfo={false}
          emptyMessage="All customers have shop activity"
        />
      )}
    </div>
  );
};

// Reusable customer table component
const CustomerTable: React.FC<{
  customers: Customer[];
  showShopInfo?: boolean;
  emptyMessage?: string;
}> = ({ customers, showShopInfo = false, emptyMessage = 'No customers found' }) => {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Earnings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Join Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map(customer => (
              <tr key={customer.address} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">
                      {customer.name || formatAddress(customer.address)}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {formatAddress(customer.address)}
                    </div>
                    {customer.referralCode && (
                      <div className="text-xs text-indigo-600">
                        Ref: {customer.referralCode}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTierColor(customer.tier)}`}>
                    {customer.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {customer.lifetimeEarnings} RCN
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    customer.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {customer.isActive ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {customer.joinDate 
                    ? new Date(customer.joinDate).toLocaleDateString()
                    : 'N/A'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};