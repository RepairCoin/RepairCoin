'use client';

import React from 'react';

interface PlatformStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
}

interface OverviewTabProps {
  stats: PlatformStats | null;
  pendingShopsCount: number;
  loading: boolean;
  onQuickAction?: (action: 'mint' | 'shops' | 'reports') => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  pendingShopsCount,
  loading,
  onQuickAction
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Active Shops"
          value={stats?.totalShops || 0}
          icon="🏪"
          color="green"
        />
        <StatCard
          title="Pending Applications"
          value={pendingShopsCount || 0}
          icon="📝"
          color="yellow"
        />
        <StatCard
          title="Tokens Issued"
          value={stats?.totalTokensIssued || 0}
          icon="🪙"
          color="purple"
        />
        <StatCard
          title="Total Redemptions"
          value={stats?.totalRedemptions || 0}
          icon="💸"
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard
            icon="🪙"
            title="Mint Tokens"
            description="Issue RCN tokens to customers"
            gradientFrom="blue"
            gradientTo="indigo"
            onClick={() => onQuickAction?.('mint')}
          />
          
          <QuickActionCard
            icon="🏪"
            title="Manage Shops"
            description="Approve and configure shops"
            gradientFrom="green"
            gradientTo="emerald"
            onClick={() => onQuickAction?.('shops')}
          />
          
          <QuickActionCard
            icon="📊"
            title="View Reports"
            description="Analyze platform performance"
            gradientFrom="purple"
            gradientTo="pink"
            onClick={() => onQuickAction?.('reports')}
          />
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
};

interface QuickActionCardProps {
  icon: string;
  title: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  onClick?: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  description,
  gradientFrom,
  gradientTo,
  onClick
}) => {
  return (
    <button 
      onClick={onClick}
      className={`p-6 bg-gradient-to-br from-${gradientFrom}-50 to-${gradientTo}-50 rounded-xl border border-${gradientFrom}-100 hover:shadow-lg transition-shadow`}
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
};