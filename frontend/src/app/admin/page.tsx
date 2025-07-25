'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from '../../hooks/useAuth';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface PlatformStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  activeCustomersLast30Days: number;
  averageTransactionValue: number;
  topPerformingShops: Array<{ shopId: string; name: string; totalTransactions: number }>;
}

interface Customer {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  isActive: boolean;
  lastEarnedDate: string;
}

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

export default function AdminDashboard() {
  const account = useActiveAccount();
  const { isAdmin, isLoading: authLoading, userProfile } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'shops' | 'shop-applications' | 'transactions' | 'create-admin' | 'create-shop'>('overview');
  
  // Modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Generate JWT token for admin authentication
  const generateAdminToken = async (): Promise<string | null> => {
    if (!account?.address) return null;
    
    try {
      // Call auth endpoint to get proper JWT token
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: account.address
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
      
      console.warn('Failed to get admin token:', await response.text());
      return null;
    } catch (error) {
      console.error('Error generating admin token:', error);
      return null;
    }
  };

  useEffect(() => {
    if (account?.address && isAdmin && !authLoading) {
      loadDashboardData();
    }
  }, [account?.address, isAdmin, authLoading]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Generate JWT token for admin
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        setLoading(false);
        return;
      }
      
      // Create headers with JWT authentication
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      };
      
      // Load platform statistics
      try {
        const statsResponse = await fetch(`${apiUrl}/admin/stats`, { headers });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.data || statsData);
        } else {
          console.warn('Stats API failed:', await statsResponse.text());
        }
      } catch (statsErr) {
        console.warn('Stats API error:', statsErr);
      }

      // Load customers
      try {
        const customersResponse = await fetch(`${apiUrl}/admin/customers?limit=50`, { headers });
        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          setCustomers(customersData.data?.customers || customersData.customers || []);
        } else {
          console.warn('Customers API failed:', await customersResponse.text());
        }
      } catch (customersErr) {
        console.warn('Customers API error:', customersErr);
      }

      // Load active/verified shops
      try {
        const shopsResponse = await fetch(`${apiUrl}/admin/shops`, { headers });
        if (shopsResponse.ok) {
          const shopsData = await shopsResponse.json();
          console.log('Active Shops API response:', shopsData);
          setShops(shopsData.data?.shops || shopsData.shops || []);
        } else {
          const errorText = await shopsResponse.text();
          console.warn('Active Shops API failed:', errorText);
        }
      } catch (shopsErr) {
        console.warn('Active Shops API error:', shopsErr);
      }

      // Load pending shop applications (unverified shops)
      try {
        const pendingShopsResponse = await fetch(`${apiUrl}/admin/shops?verified=false`, { headers });
        if (pendingShopsResponse.ok) {
          const pendingData = await pendingShopsResponse.json();
          console.log('Pending Shops API response:', pendingData);
          setPendingShops(pendingData.data?.shops || pendingData.shops || []);
        } else {
          console.warn('Pending Shops API failed:', await pendingShopsResponse.text());
        }
      } catch (pendingErr) {
        console.warn('Pending Shops API error:', pendingErr);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const mintTokensToCustomer = async (customerAddress: string, amount: number, reason: string) => {
    try {
      // Get admin token
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          customerAddress,
          amount,
          reason,
          adminAddress: account?.address
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mint tokens');
      }

      const result = await response.json();
      console.log('Tokens minted successfully:', result);
      
      // Reload data
      await loadDashboardData();
      
    } catch (err) {
      console.error('Error minting tokens:', err);
      setError('Failed to mint tokens');
    }
  };

  const approveShop = async (shopId: string) => {
    try {
      // Get admin token
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
      });

      if (!response.ok) {
        throw new Error('Failed to approve shop');
      }

      const result = await response.json();
      console.log('Shop approved successfully:', result);
      
      // Reload data to reflect changes
      await loadDashboardData();
      
    } catch (err) {
      console.error('Error approving shop:', err);
      setError('Failed to approve shop');
    }
  };

  const reviewShop = async (shopId: string) => {
    try {
      const shop = pendingShops.find(s => (s.shopId || s.shop_id) === shopId);
      if (shop) {
        setSelectedShop(shop);
        setReviewModalOpen(true);
      }
    } catch (err) {
      console.error('Error reviewing shop:', err);
      setError('Failed to review shop');
    }
  };

  const openRejectModal = (shopId: string) => {
    const shop = pendingShops.find(s => (s.shopId || s.shop_id) === shopId);
    if (shop) {
      setSelectedShop(shop);
      setRejectionReason('');
      setRejectModalOpen(true);
    }
  };

  const rejectShop = async () => {
    if (!selectedShop) return;
    
    try {
      // Get admin token
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      const shopId = selectedShop.shopId || selectedShop.shop_id;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          reason: rejectionReason || 'Application rejected by admin'
        })
      });

      if (!response.ok) {
        // If reject endpoint doesn't exist, we can delete the shop record
        const deleteResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        if (!deleteResponse.ok) {
          throw new Error('Failed to reject shop');
        }
      }

      console.log('Shop rejected successfully');
      
      // Close modal and reload data
      setRejectModalOpen(false);
      setSelectedShop(null);
      setRejectionReason('');
      await loadDashboardData();
      
    } catch (err) {
      console.error('Error rejecting shop:', err);
      setError('Failed to reject shop');
    }
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">⚡</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
            <p className="text-gray-600 mb-8">
              Connect your admin wallet to access the dashboard
            </p>
            <ConnectButton 
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-8">
              You don't have admin privileges to access this dashboard.
            </p>
            <ConnectButton 
              client={client}
              theme="light"
              connectModal={{ size: "compact" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Loading dashboard...</h2>
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">⚡</div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              </div>
              <p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-1 rounded-lg">
                {account.address?.slice(0, 6)}...{account.address?.slice(-4)}
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <ConnectButton 
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-xl p-2 mb-8 border border-gray-100">
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'customers', label: 'Customers', icon: '👥' },
              { id: 'shops', label: 'Active Shops', icon: '🏪' },
              { id: 'shop-applications', label: 'Shop Applications', icon: '📝' },
              { id: 'transactions', label: 'Transactions', icon: '💰' },
              { id: 'create-admin', label: 'Create Admin', icon: '⚡' },
              { id: 'create-shop', label: 'Create Shop', icon: '🆕' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Platform Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Customers</p>
                    <p className="text-3xl font-bold text-blue-600">{stats?.totalCustomers || 0}</p>
                  </div>
                  <div className="text-3xl">👥</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Active Shops</p>
                    <p className="text-3xl font-bold text-green-600">{stats?.totalShops || 0}</p>
                  </div>
                  <div className="text-3xl">🏪</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pending Applications</p>
                    <p className="text-3xl font-bold text-yellow-600">{pendingShops.length || 0}</p>
                  </div>
                  <div className="text-3xl">📝</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tokens Issued</p>
                    <p className="text-3xl font-bold text-purple-600">{stats?.totalTokensIssued || 0}</p>
                  </div>
                  <div className="text-3xl">🪙</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Redemptions</p>
                    <p className="text-3xl font-bold text-orange-600">{stats?.totalRedemptions || 0}</p>
                  </div>
                  <div className="text-3xl">💸</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">🪙</div>
                  <h3 className="font-bold text-gray-900 mb-2">Mint Tokens</h3>
                  <p className="text-sm text-gray-600">Issue RCN tokens to customers</p>
                </button>
                
                <button className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">🏪</div>
                  <h3 className="font-bold text-gray-900 mb-2">Manage Shops</h3>
                  <p className="text-sm text-gray-600">Approve and configure shops</p>
                </button>
                
                <button className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="font-bold text-gray-900 mb-2">View Reports</h3>
                  <p className="text-sm text-gray-600">Analyze platform performance</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lifetime Earnings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.address}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {customer.name || 'Anonymous'}
                          </div>
                          <div className="text-sm text-gray-500 font-mono">
                            {customer.address.slice(0, 6)}...{customer.address.slice(-4)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierColor(customer.tier)}`}>
                          {customer.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.lifetimeEarnings?.toFixed(2) || '0.00'} RCN
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => mintTokensToCustomer(customer.address, 100, 'Admin bonus')}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Mint 100 RCN
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shops Tab */}
        {activeTab === 'shops' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Shop Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens Issued</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RCN Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cross-Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shops.map((shop) => (
                    <tr key={shop.shopId}>
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
                            {shop.active ? 'Active' : 'Inactive'}
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
                          shop.crossShopEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {shop.crossShopEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-4">
                          Edit
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shop Applications Tab */}
        {activeTab === 'shop-applications' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Shop Applications</h2>
              <p className="text-gray-600 mt-1">Review and approve pending shop applications</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                      <tr key={shop.shopId || shop.shop_id}>
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
                            {shop.walletAddress || shop.wallet_address ? 
                              `${(shop.walletAddress || shop.wallet_address).slice(0, 6)}...${(shop.walletAddress || shop.wallet_address).slice(-4)}`
                              : 'Not provided'
                            }
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
                          {(() => {
                            const dateStr = shop.joinDate || shop.join_date;
                            if (!dateStr) return 'N/A';
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => approveShop(shop.shopId || shop.shop_id || '')}
                              className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button 
                              onClick={() => reviewShop(shop.shopId || shop.shop_id || '')}
                              className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                            >
                              👁 Review
                            </button>
                            <button 
                              onClick={() => openRejectModal(shop.shopId || shop.shop_id || '')}
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
        )}

        {/* Create Admin Tab */}
        {activeTab === 'create-admin' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Admin</h2>
              <p className="text-gray-600 mt-1">Grant admin privileges to a wallet address</p>
            </div>
            <div className="p-6">
              <AdminCreationForm onSuccess={loadDashboardData} account={account} />
            </div>
          </div>
        )}

        {/* Create Shop Tab */}
        {activeTab === 'create-shop' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Shop</h2>
              <p className="text-gray-600 mt-1">Register a new repair shop in the system</p>
            </div>
            <div className="p-6">
              <ShopCreationForm onSuccess={loadDashboardData} account={account} />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-6">
            <div className="flex">
              <div className="text-red-400 text-2xl mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Shop Application</DialogTitle>
              <DialogDescription>
                Review the details of this shop application before making a decision.
              </DialogDescription>
            </DialogHeader>
            
            {selectedShop && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Shop Name</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Shop ID</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg font-mono text-sm">{selectedShop.shopId || selectedShop.shop_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Email</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Phone</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.phone}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Business Address</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.address}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Business Type</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.business_type || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Services</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.services || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Website</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShop.website || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Wallet Address</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg font-mono text-sm break-all">
                        {selectedShop.walletAddress || selectedShop.wallet_address || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Application Date</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{(() => {
                        const dateStr = selectedShop.joinDate || selectedShop.join_date;
                        if (!dateStr) return 'N/A';
                        const date = new Date(dateStr);
                        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                      })()}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Application Status</label>
                    <div className="flex space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
                        (selectedShop.verified ?? false) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(selectedShop.verified ?? false) ? '✓ Verified' : '⏳ Pending Review'}
                      </span>
                      <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
                        (selectedShop.active ?? true) ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {(selectedShop.active ?? true) ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewModalOpen(false)}>
                Close
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  setReviewModalOpen(false);
                  openRejectModal(selectedShop?.shopId || selectedShop?.shop_id || '');
                }}
              >
                Reject
              </Button>
              <Button 
                onClick={() => {
                  if (selectedShop) {
                    approveShop(selectedShop.shopId || selectedShop.shop_id || '');
                    setReviewModalOpen(false);
                  }
                }}
              >
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shop Application</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject this shop application? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {selectedShop && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Shop Details</label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{selectedShop.name}</p>
                    <p className="text-sm text-gray-600">{selectedShop.shopId || selectedShop.shop_id}</p>
                    <p className="text-sm text-gray-600">{selectedShop.email}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Rejection Reason (Optional)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={rejectShop}>
                Reject Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Admin Creation Form Component
function AdminCreationForm({ onSuccess, account }: { onSuccess: () => void; account: any }) {
  const [formData, setFormData] = useState({
    walletAddress: '',
    name: '',
    email: '',
    permissions: ['manage_customers', 'manage_shops', 'view_analytics']
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate admin token first
      const generateToken = async (): Promise<string | null> => {
        if (!account?.address) return null;
        
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/admin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: account.address
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.token;
          }
          return null;
        } catch (error) {
          console.error('Error generating admin token:', error);
          return null;
        }
      };

      const adminToken = await generateToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create admin');
      }

      const result = await response.json();
      setSuccess('Admin created successfully!');
      setFormData({
        walletAddress: '',
        name: '',
        email: '',
        permissions: ['manage_customers', 'manage_shops', 'view_analytics']
      });
      
      setTimeout(() => {
        onSuccess();
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error creating admin:', err);
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permission]
        : prev.permissions.filter(p => p !== permission)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Wallet Address *
          </label>
          <input
            type="text"
            name="walletAddress"
            value={formData.walletAddress}
            onChange={handleInputChange}
            required
            placeholder="0x..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="John Doe"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="admin@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Permissions
        </label>
        <div className="space-y-3">
          {[
            { id: 'manage_customers', label: 'Manage Customers', desc: 'Create, edit, and suspend customer accounts' },
            { id: 'manage_shops', label: 'Manage Shops', desc: 'Approve, configure, and manage repair shops' },
            { id: 'manage_admins', label: 'Manage Admins', desc: 'Create and manage other admin accounts' },
            { id: 'view_analytics', label: 'View Analytics', desc: 'Access platform statistics and reports' },
            { id: 'mint_tokens', label: 'Mint Tokens', desc: 'Issue RepairCoin tokens to customers' }
          ].map((permission) => (
            <div key={permission.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                id={permission.id}
                checked={formData.permissions.includes(permission.id)}
                onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <div>
                <label htmlFor={permission.id} className="text-sm font-medium text-gray-900">
                  {permission.label}
                </label>
                <p className="text-xs text-gray-500">{permission.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
        >
          {loading ? 'Creating Admin...' : 'Create Admin'}
        </button>
      </div>
    </form>
  );
}

// Shop Creation Form Component
function ShopCreationForm({ onSuccess, account }: { onSuccess: () => void; account: any }) {
  const [formData, setFormData] = useState({
    shop_id: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    wallet_address: '',
    reimbursement_address: '',
    location_city: '',
    location_state: '',
    location_zip_code: '',
    location_lat: '',
    location_lng: '',
    fixflow_shop_id: '',
    verified: false,
    active: true,
    cross_shop_enabled: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate admin token first
      const generateToken = async (): Promise<string | null> => {
        if (!account?.address) return null;
        
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/admin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: account.address
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.token;
          }
          return null;
        } catch (error) {
          console.error('Error generating admin token:', error);
          return null;
        }
      };

      const adminToken = await generateToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      const submitData = {
        ...formData,
        location_lat: formData.location_lat ? parseFloat(formData.location_lat) : undefined,
        location_lng: formData.location_lng ? parseFloat(formData.location_lng) : undefined,
        reimbursement_address: formData.reimbursement_address || formData.wallet_address
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create shop');
      }

      const result = await response.json();
      setSuccess('Shop created successfully!');
      setFormData({
        shop_id: '',
        name: '',
        address: '',
        phone: '',
        email: '',
        wallet_address: '',
        reimbursement_address: '',
        location_city: '',
        location_state: '',
        location_zip_code: '',
        location_lat: '',
        location_lng: '',
        fixflow_shop_id: '',
        verified: false,
        active: true,
        cross_shop_enabled: false
      });
      
      setTimeout(() => {
        onSuccess();
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error creating shop:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop ID *
            </label>
            <input
              type="text"
              name="shop_id"
              value={formData.shop_id}
              onChange={handleInputChange}
              required
              placeholder="unique-shop-id"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Repair Shop Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Address *
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
              placeholder="123 Main St, City, State 12345"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              placeholder="+1-555-0123"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="shop@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Wallet Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wallet Address *
            </label>
            <input
              type="text"
              name="wallet_address"
              value={formData.wallet_address}
              onChange={handleInputChange}
              required
              placeholder="0x..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reimbursement Address (Optional)
            </label>
            <input
              type="text"
              name="reimbursement_address"
              value={formData.reimbursement_address}
              onChange={handleInputChange}
              placeholder="0x... (defaults to wallet address)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Location Information */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Location Information (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              name="location_city"
              value={formData.location_city}
              onChange={handleInputChange}
              placeholder="New York"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <input
              type="text"
              name="location_state"
              value={formData.location_state}
              onChange={handleInputChange}
              placeholder="NY"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
            <input
              type="text"
              name="location_zip_code"
              value={formData.location_zip_code}
              onChange={handleInputChange}
              placeholder="10001"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
            <input
              type="number"
              step="any"
              name="location_lat"
              value={formData.location_lat}
              onChange={handleInputChange}
              placeholder="40.7128"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
            <input
              type="number"
              step="any"
              name="location_lng"
              value={formData.location_lng}
              onChange={handleInputChange}
              placeholder="-74.0060"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">FixFlow Shop ID (Optional)</label>
            <input
              type="text"
              name="fixflow_shop_id"
              value={formData.fixflow_shop_id}
              onChange={handleInputChange}
              placeholder="shop_123"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">If you use FixFlow for repairs</p>
          </div>
        </div>
      </div>

      {/* Options */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Shop Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="verified"
              id="verified"
              checked={formData.verified}
              onChange={handleInputChange}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="verified" className="text-sm font-medium text-gray-900">
              Mark as verified (shop can immediately start operations)
            </label>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="active"
              id="active"
              checked={formData.active}
              onChange={handleInputChange}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-900">
              Shop is active (recommended: keep checked)
            </label>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="cross_shop_enabled"
              id="cross_shop_enabled"
              checked={formData.cross_shop_enabled}
              onChange={handleInputChange}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="cross_shop_enabled" className="text-sm font-medium text-gray-900">
              Enable cross-shop redemption (20% limit)
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
        >
          {loading ? 'Creating Shop...' : 'Create Shop'}
        </button>
      </div>
    </form>
  );
}