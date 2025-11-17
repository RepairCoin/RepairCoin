"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users,
  Store,
  DollarSign
} from 'lucide-react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { RecentActivityTimeline } from './RecentActivityTimeline';
import { useOverviewData } from '@/hooks/useOverviewData';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useShopsData } from '@/hooks/useShopsData';
import { StatCard } from '@/components/ui/StatCard';

interface Transaction {
  id: number | string;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  type: "mint" | "redemption" | "purchase";
  amount: number;
  status: "completed" | "pending" | "failed";
  createdAt: string;
  txHash?: string;
  details?: any;
}

interface OverviewTabProps {
  onQuickAction?: (action: "mint" | "shops" | "reports") => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = React.memo(() => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionFilter, setTransactionFilter] = useState('all');
  
  // Fetch overview data only for this tab
  const { stats, loading: statsLoading, error: statsError } = useOverviewData();
  const {  } = useAdminAuth();
  const { pendingShops } = useShopsData();
  const pendingShopsCount = pendingShops?.length || 0;

  // Memoize filtered transactions
  const filteredTransactions = useMemo(() => 
    transactions.filter((tx) => 
      transactionFilter === "all" || tx.type === transactionFilter
    ),
  [transactions, transactionFilter]);

  // Fetch transactions with optimized parallel loading
  useEffect(() => {
    const loadTransactions = async () => {

      try {
        setTransactionsLoading(true);
        // Cookies sent automatically with fetch when using credentials: 'include'

        // Parallel fetch both data sources
        const [treasuryResponse, customersResponse] = await Promise.allSettled([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`,
            { credentials: 'include' }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/admin/customers?limit=2&orderBy=last_earned_date&order=DESC`,
            { credentials: 'include' }
          )
        ]);

        const transactionsData: Transaction[] = [];

        // Process treasury data
        if (treasuryResponse.status === 'fulfilled' && treasuryResponse.value.ok) {
          const treasuryData = await treasuryResponse.value.json();
          if (treasuryData.data?.recentPurchases) {
            treasuryData.data.recentPurchases.forEach((purchase: any) => {
              transactionsData.push({
                id: purchase.id,
                shopId: purchase.shop_id,
                shopName: purchase.shop_name,
                customerAddress: "", // Not applicable for purchases
                type: "purchase",
                amount: purchase.rcn_amount,
                status: "completed",
                createdAt: purchase.purchase_date,
                details: {
                  paymentMethod: purchase.payment_method,
                  paymentReference: purchase.payment_reference,
                  usdAmount: purchase.total_cost,
                },
              });
            });
          }
        }

        // Process customer rewards data
        if (customersResponse.status === 'fulfilled' && customersResponse.value.ok) {
          const customerData = await customersResponse.value.json();
          // Filter customers who have earned recently
          customerData.data?.customers?.forEach((customer: any, index: number) => {
            if (customer.lifetimeEarnings > 0 && customer.lastEarnedDate) {
              transactionsData.push({
                id: `reward-${customer.id || customer.address || index}`,
                shopId: customer.homeShopId || 'Unknown',
                shopName: customer.homeShopName || 'Unknown Shop',
                customerAddress: customer.address,
                customerName: `${customer.address.slice(
                  0,
                  6
                )}...${customer.address.slice(-4)}`,
                type: "mint",
                amount: customer.lastEarnedAmount || 10, // Default reward amount
                status: "completed",
                createdAt: customer.lastEarnedDate,
                details: {
                  tier: customer.tier,
                  lifetimeEarnings: customer.lifetimeEarnings,
                },
              });
            }
          });
        }

        // Sort by date descending
        transactionsData.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setTransactions(transactionsData.slice(0, 30)); // Limit to 30 for better performance
      } catch (error) {
        console.error("Error loading transactions:", error);
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };

    loadTransactions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <DashboardHeader
        title="Dashboard Overview"
        subtitle="Welcome back! Here's what's happening today"
      />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon={<Users className="w-6 h-6 text-white" />}
        />
        <StatCard
          title="Active Shops"
          value={stats?.totalShops || 0}
          icon={<Store className="w-6 h-6 text-white" />}
        />
        <StatCard
          title="Pending Application"
          value={pendingShopsCount || 0}
          icon={<Store className="w-6 h-6 text-white" />}
        />
        {/* <MetricCard
          title="Tokens Issued"
          value={stats?.totalTokensIssued || 0}
          icon={<Coins className="w-6 h-6" />}
        /> */}
        <StatCard
          title="Total Revenue"
          value={`$${((stats?.totalTokensIssued || 0) * 0.1).toFixed(0)}`}
          icon={<DollarSign className="w-6 h-6 text-white" />}
        />
      </div>

      {/* Two Column Layout: Recent Activity & Transactions (40/60 split) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Recent Transactions Timeline (60% width) */}
        <div className="bg-[#212121] rounded-3xl lg:col-span-3 h-auto">
          <div
            className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
            style={{
              backgroundImage: `url('/img/cust-ref-widget3.png')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
              Recent Transactions
            </p>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <select
                  className="px-3 py-1.5 bg-black border border-gray-600 rounded-3xl text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
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
          <div className="overflow-x-auto my-4">
            <TransactionsTable
              transactions={filteredTransactions}
              loading={transactionsLoading}
            />
          </div>
        </div>

        {/* Right Column: Recent Activity Section (40% width) */}
        <RecentActivityTimeline />
      </div>
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';

// Memoized Transactions Table Component
const TransactionsTable: React.FC<{
  transactions: Transaction[];
  loading: boolean;
}> = React.memo(({ transactions, loading }) => {
  const columns: Column<Transaction>[] = useMemo(() => [
    {
      key: "date",
      header: "DATE",
      accessor: (tx) => {
        const date = new Date(tx.createdAt);
        if (isNaN(date.getTime())) {
          return <span className="text-sm text-gray-400">N/A</span>;
        }
        return (
          <div className="text-sm">
            <div className="text-gray-300">{date.toLocaleDateString()}</div>
            <div className="text-gray-500 text-xs">
              {date.toLocaleTimeString()}
            </div>
          </div>
        );
      },
      headerClassName: "uppercase text-xs tracking-wider",
    },
    {
      key: "type",
      header: "TYPE",
      accessor: (tx) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            tx.type === "purchase"
              ? "bg-blue-900/50 text-blue-400 border border-blue-700/50"
              : tx.type === "mint"
              ? "bg-green-900/50 text-green-400 border border-green-700/50"
              : "bg-orange-900/50 text-orange-400 border border-orange-700/50"
          }`}
        >
          {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
        </span>
      ),
      headerClassName: "uppercase text-xs tracking-wider",
    },
    {
      key: "entity",
      header: "SHOP/CUSTOMER",
      accessor: (tx) => (
        <div className="text-sm">
          {tx.type === "purchase" ? (
            <>
              <div className="text-gray-300 font-medium">
                {tx.shopName || "Unknown Shop"}
              </div>
              <div className="text-gray-500 text-xs">{tx.shopId}</div>
            </>
          ) : (
            <>
              <div className="text-gray-300 font-medium">
                Customer:{" "}
                {tx.customerAddress
                  ? `${tx.customerAddress.slice(
                      0,
                      6
                    )}...${tx.customerAddress.slice(-4)}`
                  : "Unknown"}
              </div>
              <div className="text-gray-500 text-xs">
                Shop: {tx.shopName || tx.shopId || "Unknown"}
              </div>
            </>
          )}
        </div>
      ),
      headerClassName: "uppercase text-xs tracking-wider",
    },
    {
      key: "amount",
      header: "AMOUNT",
      accessor: (tx) => (
        <span className="text-sm font-semibold text-yellow-400">
          {parseFloat(tx.amount).toFixed(2)} RCN
        </span>
      ),
      sortable: true,
      headerClassName: "uppercase text-xs tracking-wider",
    },
    {
      key: "status",
      header: "STATUS",
      accessor: (tx) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            tx.status === "completed"
              ? "bg-green-900/50 text-green-400 border border-green-700/50"
              : tx.status === "pending"
              ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700/50"
              : "bg-red-900/50 text-red-400 border border-red-700/50"
          }`}
        >
          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
        </span>
      ),
      headerClassName: "uppercase text-xs tracking-wider",
    },
  ], []);

  return (
    <DataTable
      data={transactions}
      columns={columns}
      keyExtractor={(tx) =>
        tx.id
          ? String(tx.id)
          : `tx-${tx.shopId}-${tx.customerAddress}-${tx.createdAt}-${tx.amount}`
      }
      loading={loading}
      loadingRows={5}
      emptyMessage="No transactions found. Transactions will appear here once shops start purchasing RCN."
      emptyIcon={<div className="text-4xl mb-2">💸</div>}
      headerClassName="bg-gray-900/30"
      className="text-gray-300"
      showPagination={true}
      itemsPerPage={6}
      paginationClassName=""
    />
  );
});

TransactionsTable.displayName = 'TransactionsTable';
