'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users,
  Store,
  DollarSign,
  Sparkles,
  Download,
  TrendingUp,
  Activity
} from 'lucide-react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { DataTable, Column } from '@/components/ui/DataTable';

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

interface Transaction {
  id: number;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  type: 'mint' | 'redemption' | 'purchase';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  txHash?: string;
  details?: any;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionFilter, setTransactionFilter] = useState('all');

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

  // Fetch transactions
  useEffect(() => {
    const loadTransactions = async () => {
      if (!generateAdminToken) {
        return;
      }

      try {
        setTransactionsLoading(true);
        const adminToken = await generateAdminToken();
        if (!adminToken) {
          console.error('Authentication required');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        };

        const transactionsData: Transaction[] = [];
        
        // Get treasury data for shop RCN purchases
        try {
          const treasuryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, { headers });
          if (treasuryResponse.ok) {
            const treasuryData = await treasuryResponse.json();
            if (treasuryData.data?.recentPurchases) {
              treasuryData.data.recentPurchases.forEach((purchase: any) => {
                transactionsData.push({
                  id: purchase.id,
                  shopId: purchase.shop_id,
                  shopName: purchase.shop_name,
                  customerAddress: '', // Not applicable for purchases
                  type: 'purchase',
                  amount: purchase.rcn_amount,
                  status: 'completed',
                  createdAt: purchase.purchase_date,
                  details: {
                    paymentMethod: purchase.payment_method,
                    paymentReference: purchase.payment_reference,
                    usdAmount: purchase.total_cost
                  }
                });
              });
            }
          }
        } catch (err) {
          console.warn('Failed to load treasury data:', err);
        }

        // Sort by date descending and take only latest 10
        transactionsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransactions(transactionsData.slice(0, 10));
      } catch (error) {
        console.error('Error loading transactions:', error);
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };

    loadTransactions();
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
        <ActivityLogsTable logs={activityLogs} loading={logsLoading} />
      </div>

      {/* Recent Transactions Section */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="px-6 py-4 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
              <p className="text-gray-400 text-sm mt-1">Latest platform transactions</p>
            </div>
            <div className="flex gap-2">
              <select 
                className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="purchase">RCN Purchases</option>
                <option value="mint">Token Mints</option>
                <option value="redemption">Redemptions</option>
              </select>
            </div>
          </div>
        </div>
        <TransactionsTable 
          transactions={transactions.filter(tx => transactionFilter === 'all' || tx.type === transactionFilter)} 
          loading={transactionsLoading} 
        />
      </div>
    </div>
  );
};

// Activity Logs Table Component
const ActivityLogsTable: React.FC<{ logs: ActivityLog[]; loading: boolean }> = ({ logs, loading }) => {
  const columns: Column<ActivityLog>[] = [
    {
      key: 'time',
      header: 'TIME',
      accessor: (log) => (
        <span className="text-sm text-gray-300">
          {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'admin',
      header: 'ADMIN',
      accessor: (log) => (
        <div className="text-sm text-gray-300 font-mono">
          {log.adminAddress ? `${log.adminAddress.slice(0, 6)}...${log.adminAddress.slice(-4)}` : 'System'}
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'action',
      header: 'ACTION',
      accessor: (log) => (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-400 border border-blue-700/50">
          {log.action}
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'details',
      header: 'DETAILS',
      accessor: (log) => (
        <span className="text-sm text-gray-300 block truncate max-w-md">
          {log.details || log.description || '-'}
        </span>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (log) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          log.status === 'success' 
            ? 'bg-green-900/50 text-green-400 border border-green-700/50' 
            : log.status === 'failed'
            ? 'bg-red-900/50 text-red-400 border border-red-700/50'
            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
        }`}>
          {log.status || 'completed'}
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    }
  ];

  return (
    <DataTable
      data={logs}
      columns={columns}
      keyExtractor={(log) => String(log.id || Math.random())}
      loading={loading}
      loadingRows={3}
      emptyMessage="No recent activity"
      emptyIcon={<div className="text-4xl mb-2">📋</div>}
      headerClassName="bg-gray-900/30"
      className="text-gray-300"
    />
  );
};

// Transactions Table Component
const TransactionsTable: React.FC<{ transactions: Transaction[]; loading: boolean }> = ({ transactions, loading }) => {
  const columns: Column<Transaction>[] = [
    {
      key: 'date',
      header: 'DATE',
      accessor: (tx) => {
        const date = new Date(tx.createdAt);
        if (isNaN(date.getTime())) {
          return <span className="text-sm text-gray-400">N/A</span>;
        }
        return (
          <div className="text-sm">
            <div className="text-gray-300">{date.toLocaleDateString()}</div>
            <div className="text-gray-500 text-xs">{date.toLocaleTimeString()}</div>
          </div>
        );
      },
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'type',
      header: 'TYPE',
      accessor: (tx) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          tx.type === 'purchase' ? 'bg-blue-900/50 text-blue-400 border border-blue-700/50' :
          tx.type === 'mint' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
          'bg-orange-900/50 text-orange-400 border border-orange-700/50'
        }`}>
          {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
        </span>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'entity',
      header: 'SHOP/CUSTOMER',
      accessor: (tx) => (
        <div className="text-sm">
          <div className="text-gray-300 font-medium">
            {tx.shopName || tx.customerName || 'Unknown'}
          </div>
          <div className="text-gray-500 text-xs">
            {tx.shopId || (tx.customerAddress && `${tx.customerAddress.slice(0, 6)}...${tx.customerAddress.slice(-4)}`)}
          </div>
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'amount',
      header: 'AMOUNT',
      accessor: (tx) => (
        <span className="text-sm font-semibold text-yellow-400">
          {tx.amount} RCN
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (tx) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          tx.status === 'completed' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
          tx.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' :
          'bg-red-900/50 text-red-400 border border-red-700/50'
        }`}>
          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
        </span>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    }
  ];

  return (
    <DataTable
      data={transactions}
      columns={columns}
      keyExtractor={(tx) => String(tx.id)}
      loading={loading}
      loadingRows={5}
      emptyMessage="No transactions found. Transactions will appear here once shops start purchasing RCN."
      emptyIcon={<div className="text-4xl mb-2">💸</div>}
      headerClassName="bg-gray-900/30"
      className="text-gray-300"
    />
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
