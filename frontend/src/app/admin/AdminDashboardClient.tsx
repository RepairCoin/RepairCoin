'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { toast, Toaster } from 'react-hot-toast';
import { authManager } from '@/utils/auth';

// Import our new components
import { OverviewTab } from '@/components/admin/OverviewTab';
import { CustomersTab } from '@/components/admin/CustomersTab';
import { CustomersTabEnhanced } from '@/components/admin/CustomersTabEnhanced';
import { ShopsTab } from '@/components/admin/ShopsTab';
import { ShopApplicationsTab } from '@/components/admin/ShopApplicationsTab';
import { TreasuryTab } from '@/components/admin/TreasuryTab';
import { TransactionsTab } from '@/components/admin/TransactionsTab';
import { ActivityLogsTab } from '@/components/admin/ActivityLogsTab';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { UnsuspendRequestsTab } from '@/components/admin/UnsuspendRequestsTab';
import { CreateAdminTab } from '@/components/admin/CreateAdminTab';
import { CreateShopTab } from '@/components/admin/CreateShopTab';
import { ShopReviewModal } from '@/components/admin/ShopReviewModal';

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
  suspended_at?: string;
  suspension_reason?: string;
}

export default function AdminDashboardClient() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [rejectedShops, setRejectedShops] = useState<Shop[]>([]);
  const [reviewModal, setReviewModal] = useState<{ isOpen: boolean; shop: any | null }>({
    isOpen: false,
    shop: null
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [useEnhancedCustomers, setUseEnhancedCustomers] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!account?.address) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminAddresses = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
        setIsAdmin(adminAddresses.includes(account.address.toLowerCase()));
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [account]);

  // Generate JWT token for admin authentication
  const generateAdminToken = async (forceRefresh: boolean = false): Promise<string | null> => {
    if (!account?.address) return null;
    
    // Check if we already have a token stored (unless forcing refresh)
    if (!forceRefresh) {
      const storedToken = authManager.getToken('admin');
      if (storedToken) {
        return storedToken;
      }
    }
    
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
        const token = data.token;
        if (token) {
          // Store token using authManager
          authManager.setToken('admin', token, 24); // 24 hour expiry
          return token;
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Admin authentication failed');
        console.error('Admin auth failed:', errorData);
      }
    } catch (error) {
      console.error('Failed to generate admin token:', error);
      toast.error('Network error during authentication');
    }
    
    return null;
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        return;
      }

      // Fetch platform statistics
      let statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      // If unauthorized, try refreshing the token
      if (statsResponse.status === 401 || statsResponse.status === 403) {
        console.log('Token expired or invalid, refreshing...');
        authManager.clearToken('admin');
        const newToken = await generateAdminToken(true);
        if (newToken) {
          statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
            headers: {
              'Authorization': `Bearer ${newToken}`
            }
          });
        } else {
          setError('Failed to authenticate as admin. Please check your wallet address.');
          setLoading(false);
          return;
        }
      }
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Stats data:', statsData);
        setStats(statsData.data || statsData);
      } else {
        console.error('Failed to fetch stats:', statsResponse.status, await statsResponse.text());
      }

      // Fetch customers
      const customersResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/customers?page=1&limit=100`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData.data?.customers || []);
      }

      // Fetch shops
      const shopsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops?active=true&verified=true`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (shopsResponse.ok) {
        const shopsData = await shopsResponse.json();
        console.log('Shops data:', shopsData);
        setShops(shopsData.data?.shops || []);
      } else {
        console.error('Failed to fetch shops:', shopsResponse.status, await shopsResponse.text());
      }

      // Fetch all unverified shops (both pending and rejected)
      const unverifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops?verified=false&active=all`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (unverifiedResponse.ok) {
        const unverifiedData = await unverifiedResponse.json();
        const allUnverifiedShops = unverifiedData.data?.shops || [];
        
        // Separate pending (not suspended) and rejected (suspended) shops
        const pending = allUnverifiedShops.filter((shop: any) => !shop.suspended_at);
        const rejected = allUnverifiedShops.filter((shop: any) => shop.suspended_at);
        
        setPendingShops(pending);
        setRejectedShops(rejected);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin]);

  // Action handlers
  const mintTokensToCustomer = async (customerAddress: string, amount: number, reason: string) => {
    try {
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
          reason
        }),
      });

      if (response.ok) {
        await loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to mint tokens');
      }
    } catch (error) {
      console.error('Error minting tokens:', error);
      setError('Failed to mint tokens');
    }
  };

  const suspendCustomer = async (address: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error('Failed to authenticate');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/customers/${address}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Admin action' })
    });

    if (!response.ok) {
      throw new Error('Failed to suspend customer');
    }
  };

  const unsuspendCustomer = async (address: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error('Failed to authenticate');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/customers/${address}/unsuspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to unsuspend customer');
    }
  };

  const suspendShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error('Failed to authenticate');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Admin action' })
    });

    if (!response.ok) {
      throw new Error('Failed to suspend shop');
    }
  };

  const unsuspendShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error('Failed to authenticate');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/unsuspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to unsuspend shop');
    }
  };

  const verifyShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error('Failed to authenticate');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to verify shop');
    }
  };

  const approveShop = async (shopId: string) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) throw new Error('Failed to authenticate');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Approve shop error:', errorData);
        throw new Error(errorData.error || 'Failed to approve shop');
      }

      // Refresh the data after approval
      await loadDashboardData();
      toast.success(`Shop ${shopId} approved successfully!`);
    } catch (error: any) {
      console.error('Error approving shop:', error);
      toast.error(error.message || 'Failed to approve shop');
    }
  };

  const reviewShop = (shopId: string) => {
    const shop = pendingShops.find(s => (s.shopId || s.shop_id) === shopId);
    if (shop) {
      setReviewModal({ isOpen: true, shop });
    }
  };

  const rejectShop = async (shopId: string, reason?: string) => {
    console.log('Rejecting shop:', shopId);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) throw new Error('Failed to authenticate');

      // Since there's no reject endpoint, we'll use suspend for unverified shops
      // This effectively "rejects" the application
      const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/suspend`;
      console.log('Suspend URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ 
          reason: `Application Rejected: ${reason || 'Does not meet requirements'}` 
        })
      });

      console.log('Suspend response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Reject shop error:', errorData);
        throw new Error(errorData.error || 'Failed to reject shop');
      }

      const responseData = await response.json();
      console.log('Suspend response data:', responseData);

      // Refresh the data after rejection
      await loadDashboardData();
      toast.success(`Shop application rejected successfully!`);
    } catch (error: any) {
      console.error('Error rejecting shop:', error);
      toast.error(error.message || 'Failed to reject shop');
      throw error; // Re-throw to handle in the UI
    }
  };

  const mintShopBalance = async (shopId: string) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        throw new Error('Failed to authenticate as admin');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/mint-balance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mint balance');
      }

      const result = await response.json();
      toast.success(result.message || 'Balance minted successfully');
      
      // Refresh shops data
      loadDashboardData();
    } catch (error) {
      console.error('Error minting balance:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mint balance');
    }
  };

  // Tab navigation buttons
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'shops', label: 'Active Shops', icon: '🏪' },
    { id: 'shop-applications', label: 'Shop Applications', icon: '📝' },
    { id: 'treasury', label: 'Treasury', icon: '💰' },
    { id: 'transactions', label: 'Transactions', icon: '💸' },
    { id: 'create-admin', label: 'Create Admin', icon: '👤' },
    { id: 'activity-logs', label: 'Activity Logs', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'create-shop', label: 'Create Shop', icon: '🏪' },
    { id: 'unsuspend-requests', label: 'Unsuspend Requests', icon: '🔓' },
  ];

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">⚡</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
            <p className="text-gray-600 mb-8">Connect your admin wallet to access the dashboard</p>
            <ConnectButton client={client} />
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
            <p className="text-gray-600 mb-8">You do not have admin privileges</p>
            <p className="text-sm text-gray-500">Connected wallet: {account.address}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              ⚡ RepairCoin Admin
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  authManager.clearToken('admin');
                  const newToken = await generateAdminToken(true);
                  if (newToken) {
                    loadDashboardData();
                  }
                }}
                className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
              >
                Refresh Data
              </button>
              <span className="text-sm text-gray-600">Welcome, Admin</span>
              <ConnectButton client={client} />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 bg-white rounded-2xl shadow-xl p-2 border border-gray-100">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            pendingShopsCount={pendingShops.length}
            loading={loading}
            onQuickAction={(action) => {
              switch(action) {
                case 'mint':
                  setActiveTab('customers');
                  break;
                case 'shops':
                  setActiveTab('shop-applications');
                  break;
                case 'reports':
                  setActiveTab('analytics');
                  break;
              }
            }}
          />
        )}

        {activeTab === 'customers' && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setUseEnhancedCustomers(!useEnhancedCustomers)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Switch to {useEnhancedCustomers ? 'Simple' : 'Enhanced'} View
              </button>
            </div>
            {useEnhancedCustomers ? (
              <CustomersTabEnhanced
                generateAdminToken={generateAdminToken}
                onMintTokens={mintTokensToCustomer}
                onRefresh={loadDashboardData}
              />
            ) : (
              <CustomersTab
                customers={customers}
                onMintTokens={mintTokensToCustomer}
                onSuspendCustomer={suspendCustomer}
                onUnsuspendCustomer={unsuspendCustomer}
                onRefresh={loadDashboardData}
              />
            )}
          </>
        )}

        {activeTab === 'shops' && (
          <ShopsTab
            shops={shops}
            onVerifyShop={verifyShop}
            onSuspendShop={suspendShop}
            onUnsuspendShop={unsuspendShop}
            onEditShop={(shop) => console.log('Edit shop:', shop)}
            onMintBalance={mintShopBalance}
            onRefresh={loadDashboardData}
            generateAdminToken={generateAdminToken}
          />
        )}

        {activeTab === 'shop-applications' && (
          <ShopApplicationsTab
            pendingShops={pendingShops}
            rejectedShops={rejectedShops}
            onApproveShop={approveShop}
            onReviewShop={reviewShop}
            onRejectShop={rejectShop}
            onRefresh={loadDashboardData}
          />
        )}

        {/* Other tabs - TODO: Create components for these */}
        {activeTab === 'treasury' && (
          <TreasuryTab
            generateAdminToken={generateAdminToken}
            onError={setError}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            generateAdminToken={generateAdminToken}
            onError={setError}
          />
        )}

        {activeTab === 'create-admin' && (
          <CreateAdminTab
            generateAdminToken={generateAdminToken}
            onError={setError}
            onSuccess={loadDashboardData}
          />
        )}

        {activeTab === 'activity-logs' && (
          <ActivityLogsTab
            generateAdminToken={generateAdminToken}
            onError={setError}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            generateAdminToken={generateAdminToken}
            onError={setError}
          />
        )}

        {activeTab === 'create-shop' && (
          <CreateShopTab
            generateAdminToken={generateAdminToken}
            onError={setError}
            onSuccess={loadDashboardData}
          />
        )}

        {activeTab === 'unsuspend-requests' && (
          <UnsuspendRequestsTab
            generateAdminToken={generateAdminToken}
            onError={setError}
          />
        )}
      </div>
    </div>

    {/* Shop Review Modal */}
    <ShopReviewModal
      isOpen={reviewModal.isOpen}
      onClose={() => setReviewModal({ isOpen: false, shop: null })}
      shop={reviewModal.shop}
      onApprove={(shopId) => {
        approveShop(shopId);
        setReviewModal({ isOpen: false, shop: null });
      }}
      onReject={(shopId) => {
        rejectShop(shopId);
        setReviewModal({ isOpen: false, shop: null });
      }}
    />
    </>
  );
}