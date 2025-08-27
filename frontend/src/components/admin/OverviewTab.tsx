'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users,
  Store,
  DollarSign,
  Sparkles
} from 'lucide-react';

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

  // Fetch dynamic data
  useEffect(() => {
    const fetchDynamicData = async () => {
      if (!generateAdminToken) {
        return;
      }

      try {
        const token = await generateAdminToken();
        if (!token) return;
        
      } catch (error) {
        console.error('Error fetching dynamic data:', error);
      }
    };

    fetchDynamicData();
    const interval = setInterval(fetchDynamicData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [stats, generateAdminToken]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            Dashboard Overview
          </h1>
          <p className="text-gray-400 mt-1">Welcome back! Here's what's happening today</p>
        </div>
      </div>

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
