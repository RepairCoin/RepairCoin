'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users,
  Store,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';

interface PlatformStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  activeCustomersLast30Days?: number;
  averageTransactionValue?: number;
  topPerformingShops?: Array<{
    shopId: string;
    name: string;
    totalTransactions: number;
  }>;
}

interface ActivityLog {
  id: string | number;
  timestamp?: string;
  createdAt?: string;
  adminAddress?: string;
  action: string;
  details?: string;
  description?: string;
  status?: 'success' | 'failed' | 'completed';
}

interface OverviewTabProps {
  stats: PlatformStats | null;
  pendingShopsCount: number;
  loading: boolean;
  onQuickAction?: (action: 'mint' | 'shops' | 'reports') => void;
  generateAdminToken?: () => Promise<string | null>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  pendingShopsCount,
  loading,
  generateAdminToken
}) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Fetch activity logs
  useEffect(() => {
    const loadActivityLogs = async () => {
      if (!generateAdminToken) {
        return;
      }

      try {
        setLogsLoading(true);
        const adminToken = await generateAdminToken();
        if (!adminToken) {
          console.error('Authentication required');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/analytics/activity-logs?limit=10`, { headers });
        
        if (response.ok) {
          const data = await response.json();
          setActivityLogs(data.data?.logs || data.logs || []);
        } else {
          console.warn('Activity logs API failed:', await response.text());
          setActivityLogs([]);
        }
      } catch (error) {
        console.error('Error loading activity logs:', error);
        setActivityLogs([]);
      } finally {
        setLogsLoading(false);
      }
    };

    loadActivityLogs();
    const interval = setInterval(loadActivityLogs, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [generateAdminToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <DashboardHeader 
        title="Dashboard Overview"
        subtitle="Welcome back! Here's what's happening today"
        icon={Sparkles}
      />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon={<Users className="w-6 h-6" />}
        />
        <MetricCard
          title="Active Shops"
          value={stats?.totalShops || 0}
          icon={<Store className="w-6 h-6" />}
        />
        <MetricCard
          title="Pending Application"
          value={pendingShopsCount || 0}
          icon={<Store className="w-6 h-6" />}
        />
        {/* <MetricCard
          title="Tokens Issued"
          value={stats?.totalTokensIssued || 0}
          icon={<Coins className="w-6 h-6" />}
        /> */}
        <MetricCard
          title="Total Revenue"
          value={`$${((stats?.totalTokensIssued || 0) * 0.1).toFixed(0)}`}
          icon={<DollarSign className="w-6 h-6" />}
        />
      </div>

      {/* Activity Logs Section */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="px-6 py-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">Recent Activity</h2>
          <p className="text-gray-400 text-sm mt-1">Latest admin actions and system events</p>
        </div>
        <div className="overflow-x-auto">
          {logsLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
              <p className="mt-3 text-gray-400">Loading activity logs...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-700/50">
              <thead className="bg-gray-900/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="text-4xl mb-2">📋</div>
                      <p>No recent activity</p>
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log, index) => (
                    <tr key={log.id || index} className="hover:bg-gray-800/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300 font-mono">
                          {log.adminAddress ? `${log.adminAddress.slice(0, 6)}...${log.adminAddress.slice(-4)}` : 'System'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-400 border border-blue-700/50">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-md truncate">
                        {log.details || log.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.status === 'success' 
                            ? 'bg-green-900/50 text-green-400 border border-green-700/50' 
                            : log.status === 'failed'
                            ? 'bg-red-900/50 text-red-400 border border-red-700/50'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
                        }`}>
                          {log.status || 'completed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// Component definitions
const MetricCard = ({ title, value, icon }: any) => (
  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center`}>
        <div className="text-white">{icon}</div>
      </div>
    </div>
    <p className="text-gray-400 text-sm mb-1">{title}</p>
    <p className="text-2xl font-bold text-white">
      {value.toLocaleString()}
    </p>
  </div>
);
