'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Store, Users, Coins, Gift, ShoppingCart, UserPlus, CheckCircle, Building2, Award, AlertCircle } from 'lucide-react';

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

interface RecentActivityTimelineProps {
  generateAdminToken?: () => Promise<string | null>;
}

const getRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return then.toLocaleDateString();
};

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'shop_registration':
      return <Store className="w-4 h-4" />;
    case 'shop_approval':
      return <CheckCircle className="w-4 h-4" />;
    case 'rcn_purchase':
      return <ShoppingCart className="w-4 h-4" />;
    case 'new_customer':
      return <UserPlus className="w-4 h-4" />;
    case 'customer_reward':
      return <Gift className="w-4 h-4" />;
    case 'redemption':
      return <Coins className="w-4 h-4" />;
    case 'referral':
      return <Users className="w-4 h-4" />;
    case 'tier_upgrade':
      return <Award className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
};

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'shop_registration':
      return 'from-blue-500 to-indigo-600';
    case 'shop_approval':
      return 'from-green-500 to-emerald-600';
    case 'rcn_purchase':
      return 'from-yellow-500 to-orange-600';
    case 'new_customer':
      return 'from-purple-500 to-pink-600';
    case 'customer_reward':
      return 'from-cyan-500 to-teal-600';
    case 'redemption':
      return 'from-amber-500 to-yellow-600';
    case 'referral':
      return 'from-violet-500 to-purple-600';
    case 'tier_upgrade':
      return 'from-rose-500 to-pink-600';
    default:
      return 'from-gray-500 to-gray-600';
  }
};

export const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({ generateAdminToken }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchActivities = async () => {
      if (!generateAdminToken) return;
      
      try {
        setLoading(true);
        const token = await generateAdminToken();
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
                timestamp: shop.verifiedAt || shop.joinDate || new Date().toISOString(),
                title: 'Shop Approved',
                description: `${shop.name} has been verified`,
                metadata: {
                  shopId: shop.id,
                  shopName: shop.name,
                  status: 'verified',
                  location: shop.city ? `${shop.city}, ${shop.country}` : shop.country
                },
                icon: getActivityIcon('shop_approval'),
                iconBg: `bg-gradient-to-br ${getActivityColor('shop_approval')}`,
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
                timestamp: shop.joinDate || new Date().toISOString(),
                title: 'New Shop Application',
                description: `${shop.name} applied`,
                metadata: {
                  shopId: shop.id,
                  shopName: shop.name,
                  status: 'pending',
                  location: shop.city ? `${shop.city}, ${shop.country}` : shop.country,
                  owner: shop.contactName
                },
                icon: getActivityIcon('shop_registration'),
                iconBg: `bg-gradient-to-br ${getActivityColor('shop_registration')}`,
                status: 'pending'
              });
            });
          }
        } catch (error) {
          console.error('Error fetching shop activities:', error);
        }

        // Sort activities by timestamp
        const allActivities = [...activities]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);

        setActivities(allActivities);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [generateAdminToken]);

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 flex flex-col max-h-[600px]">
      <div className="px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Recent Activity
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
            >
              <option value="all">All Events</option>
              <option value="shop_registration">Registrations</option>
              <option value="shop_approval">Approvals</option>
              <option value="rcn_purchase">Purchases</option>
              <option value="tier_upgrade">Upgrades</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No recent activity</p>
            <p className="text-gray-500 text-sm mt-2">Shop registrations and approvals will appear here</p>
          </div>
        ) : (
          <div className="relative">
            {/* Activity items */}
            <div>
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="relative flex gap-4 group">
                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{activity.title}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{activity.description}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {getRelativeTime(activity.timestamp)}
                        </span>
                      </div>

                      {activity.metadata && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {activity.metadata.amount && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-900/30 rounded-md border border-yellow-700/30">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-xs text-yellow-400 font-semibold">
                                {activity.metadata.amount.toLocaleString()} RCN
                              </span>
                              {activity.metadata.usdAmount && (
                                <span className="text-xs text-gray-500">
                                  (${activity.metadata.usdAmount})
                                </span>
                              )}
                            </div>
                          )}
                          
                          {activity.metadata.tier && (
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                              activity.metadata.tier === 'GOLD' 
                                ? 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 text-yellow-400 border border-yellow-700/30' 
                                : activity.metadata.tier === 'SILVER' 
                                ? 'bg-gradient-to-r from-gray-800/30 to-gray-700/30 text-gray-300 border border-gray-600/30' 
                                : 'bg-gradient-to-r from-orange-900/30 to-amber-900/30 text-orange-400 border border-orange-700/30'
                            }`}>
                              {activity.metadata.tier}
                            </span>
                          )}
                          
                          {activity.metadata.location && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {activity.metadata.location}
                            </span>
                          )}
                          
                          {activity.status && (
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                              activity.status === 'success' 
                                ? 'bg-green-900/30 text-green-400 border border-green-700/30' 
                                : activity.status === 'pending' 
                                ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30' 
                                : 'bg-red-900/30 text-red-400 border border-red-700/30'
                            }`}>
                              {activity.status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};