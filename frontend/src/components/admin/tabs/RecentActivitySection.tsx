'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Store, Users, Coins, ArrowRight, Gift, ShoppingCart, UserPlus, CheckCircle, XCircle, Clock, Building2, DollarSign, UserCheck } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

interface ActivityItem {
  id: string;
  type: 'shop_registration' | 'shop_approval' | 'rcn_purchase' | 'new_customer' | 'customer_reward' | 'redemption' | 'referral' | 'tier_upgrade';
  timestamp: string;
  title: string;
  description: string;
  metadata?: {
    shopId?: string;
    shopName?: string;
    customerAddress?: string;
    amount?: number;
    tier?: string;
    status?: string;
    txHash?: string;
    location?: string;
    owner?: string;
    paymentMethod?: string;
    referredBy?: string;
    usdAmount?: number;
  };
  icon: React.ReactNode;
  iconBg: string;
  status?: 'success' | 'pending' | 'failed';
}

interface RecentActivitySectionProps {
  generateAdminToken?: () => Promise<string | null>;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({ generateAdminToken }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchActivities = async () => {
      if (!generateAdminToken) return;
      
      try {
        setLoading(true);
        // Cookies sent automatically with apiClient
        if (!token) return;

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const activities: ActivityItem[] = [];

        // Fetch recent shop registrations and approvals
        try {
          const [activeShops, pendingShops] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops?limit=5&orderBy=join_date&order=DESC`, { headers }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops?verified=false&limit=5`, { headers })
          ]);

          if (activeShops.ok) {
            const activeData = await activeShops.json();
            activeData.data?.shops?.forEach((shop: any, index: number) => {
              activities.push({
                id: `shop-verified-${shop.id || index}-${Date.now()}-${index}`,
                type: 'shop_approval',
                timestamp: shop.verifiedAt || shop.joinDate,
                title: 'Shop Approved',
                description: `${shop.name} has been verified and activated`,
                metadata: {
                  shopId: shop.id,
                  shopName: shop.name,
                  status: 'verified',
                  location: shop.city ? `${shop.city}, ${shop.country}` : shop.country
                },
                icon: <CheckCircle className="w-5 h-5" />,
                iconBg: 'bg-gradient-to-br from-green-400 to-emerald-600',
                status: 'success'
              });
            });
          }

          if (pendingShops.ok) {
            const pendingData = await pendingShops.json();
            pendingData.data?.shops?.forEach((shop: any, index: number) => {
              activities.push({
                id: `shop-pending-${shop.id || index}-${Date.now()}-${index}`,
                type: 'shop_registration',
                timestamp: shop.joinDate,
                title: 'New Shop Application',
                description: `${shop.name} applied for partnership`,
                metadata: {
                  shopId: shop.id,
                  shopName: shop.name,
                  status: 'pending',
                  location: shop.city ? `${shop.city}, ${shop.country}` : shop.country,
                  owner: shop.contactName
                },
                icon: <Building2 className="w-5 h-5" />,
                iconBg: 'bg-gradient-to-br from-amber-400 to-orange-600',
                status: 'pending'
              });
            });
          }
        } catch (err) {
          console.warn('Failed to fetch shop data:', err);
        }

        // Fetch recent RCN purchases by shops
        try {
          const treasuryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, { headers });
          if (treasuryRes.ok) {
            const treasuryData = await treasuryRes.json();
            treasuryData.data?.recentPurchases?.forEach((purchase: any, index: number) => {
              activities.push({
                id: `purchase-${purchase.id || index}-${Date.now()}-${index}`,
                type: 'rcn_purchase',
                timestamp: purchase.purchase_date,
                title: 'RCN Purchase',
                description: `${purchase.shop_name} purchased ${purchase.rcn_amount.toLocaleString()} RCN`,
                metadata: {
                  shopId: purchase.shop_id,
                  shopName: purchase.shop_name,
                  amount: purchase.rcn_amount,
                  usdAmount: purchase.total_cost,
                  paymentMethod: purchase.payment_method
                },
                icon: <DollarSign className="w-5 h-5" />,
                iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-600',
                status: 'success'
              });
            });
          }
        } catch (err) {
          console.warn('Failed to fetch treasury data:', err);
        }

        // Fetch recent customer registrations
        try {
          const customersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/customers?limit=5`, { headers });
          if (customersRes.ok) {
            const customerData = await customersRes.json();
            customerData.data?.customers?.forEach((customer: any, index: number) => {
              activities.push({
                id: `customer-${customer.id || customer.address || index}-${Date.now()}`,
                type: 'new_customer',
                timestamp: customer.joinDate,
                title: 'New Customer',
                description: `Customer ${customer.address.slice(0, 6)}...${customer.address.slice(-4)} joined the network`,
                metadata: {
                  customerAddress: customer.address,
                  tier: customer.tier,
                  referredBy: customer.referredBy
                },
                icon: <UserCheck className="w-5 h-5" />,
                iconBg: 'bg-gradient-to-br from-purple-400 to-pink-600',
                status: 'success'
              });
            });
          }
        } catch (err) {
          console.warn('Failed to fetch customer data:', err);
        }

        // Sort all activities by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Take only the most recent 20 activities
        setActivities(activities.slice(0, 20));
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  // Define columns for the DataTable
  const columns: Column<ActivityItem>[] = [
    {
      key: 'type',
      header: 'TYPE',
      accessor: (activity) => (
        <div className="flex items-center gap-3">
          <div className={`${activity.iconBg} p-2 rounded-lg shadow-lg flex-shrink-0`}>
            <div className="text-white">{activity.icon}</div>
          </div>
          <span className="text-sm text-gray-300">{activity.title}</span>
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'description',
      header: 'DETAILS',
      accessor: (activity) => (
        <div className="space-y-1">
          <p className="text-sm text-gray-300">{activity.description}</p>
          {activity.metadata && (
            <div className="flex flex-wrap items-center gap-2">
              {activity.metadata.amount && (
                <div className="flex items-center gap-1">
                  <Coins className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-yellow-400 font-semibold">
                    {activity.metadata.amount.toLocaleString()} RCN
                    {activity.metadata.usdAmount && (
                      <span className="text-gray-500 ml-1">(${activity.metadata.usdAmount})</span>
                    )}
                  </span>
                </div>
              )}
              {activity.metadata.tier && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activity.metadata.tier === 'GOLD' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50' :
                  activity.metadata.tier === 'SILVER' ? 'bg-gray-700/30 text-gray-300 border border-gray-600/50' :
                  'bg-orange-900/30 text-orange-400 border border-orange-700/50'
                }`}>
                  {activity.metadata.tier} Tier
                </span>
              )}
              {activity.metadata.location && (
                <span className="text-xs text-gray-500">📍 {activity.metadata.location}</span>
              )}
              {activity.metadata.owner && (
                <span className="text-xs text-gray-500">👤 {activity.metadata.owner}</span>
              )}
              {activity.metadata.paymentMethod && (
                <span className="text-xs text-gray-500">💳 {activity.metadata.paymentMethod}</span>
              )}
              {activity.metadata.referredBy && (
                <span className="text-xs text-purple-400">🎯 Referred</span>
              )}
            </div>
          )}
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (activity) => activity.status ? (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          activity.status === 'success' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
          activity.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' :
          'bg-red-900/50 text-red-400 border border-red-700/50'
        }`}>
          {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
        </span>
      ) : null,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'timestamp',
      header: 'TIME',
      accessor: (activity) => (
        <div className="text-sm">
          <div className="text-gray-300">{getRelativeTime(activity.timestamp)}</div>
          <div className="text-gray-500 text-xs">
            {new Date(activity.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
          </div>
        </div>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    }
  ];

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
      <div className="px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              Recent Activity
            </h2>
            <p className="text-gray-400 text-sm mt-1">Real-time platform activities</p>
          </div>
          <select
            className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">🌐 All Activities</option>
            <option value="shop_registration">🏢 Shop Applications</option>
            <option value="shop_approval">✅ Shop Approvals</option>
            <option value="rcn_purchase">💰 RCN Purchases</option>
            <option value="new_customer">👥 New Customers</option>
          </select>
        </div>
      </div>

      <DataTable
        data={filteredActivities}
        columns={columns}
        keyExtractor={(activity) => activity.id}
        loading={loading}
        loadingRows={5}
        emptyMessage="No recent activities"
        emptyIcon={<div className="text-4xl mb-2">📋</div>}
        headerClassName="bg-gray-900/30"
        className="text-gray-300"
      />

      {filteredActivities.length > 10 && (
        <div className="px-6 py-3 border-t border-gray-700/30">
          <button className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1">
            View all activities
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};