'use client';

import React from 'react';

interface ShopData {
  shopId: string;
  name: string;
  active: boolean;
  verified: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  purchasedRcnBalance: number;
  totalRcnPurchased: number;
  lastPurchaseDate?: string;
}

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface OverviewTabProps {
  shopData: ShopData | null;
  purchases: PurchaseHistory[];
  blockchainBalance?: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ shopData, purchases, blockchainBalance = 0 }) => {
  if (!shopData) {
    return <div>Loading shop data...</div>;
  }


  return (
    <div className="space-y-8">
      {/* Shop Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="RCN Balance"
          value={blockchainBalance.toFixed(2)}
          subtitle="Available for bonuses"
          color="green"
          icon="💰"
        />
        <StatCard
          title="Tokens Issued"
          value={shopData.totalTokensIssued || 0}
          subtitle="To customers"
          color="blue"
          icon="🪙"
        />
        <StatCard
          title="Total Redemptions"
          value={shopData.totalRedemptions || 0}
          subtitle="RCN redeemed"
          color="purple"
          icon="💸"
        />
        <StatCard
          title="RCN Purchased"
          value={(Number(shopData.totalRcnPurchased) || 0).toFixed(2)}
          subtitle="Total investment"
          color="orange"
          icon="📈"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard shopData={shopData} />
        <BalanceAlertCard balance={blockchainBalance} />
      </div>

      {/* Recent Purchase History */}
      <RecentPurchasesCard purchases={purchases} />
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, color, icon }) => {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
            {value}
          </p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
};

const StatusCard: React.FC<{ shopData: ShopData }> = ({ shopData }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Shop Status</h3>
      <div className="space-y-3">
        <StatusRow
          label="Active Status"
          value={shopData.active ? 'Active' : 'Inactive'}
          status={shopData.active ? 'success' : 'error'}
        />
        <StatusRow
          label="Verification"
          value={shopData.verified ? 'Verified' : 'Pending'}
          status={shopData.verified ? 'info' : 'warning'}
        />
        <StatusRow
          label="Cross-Shop Redemption"
          value={shopData.crossShopEnabled ? 'Enabled' : 'Disabled'}
          status={shopData.crossShopEnabled ? 'success' : 'neutral'}
        />
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value: string; status: string }> = ({ label, value, status }) => {
  const statusColors = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    neutral: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[status as keyof typeof statusColors]}`}>
        {value}
      </span>
    </div>
  );
};

const BalanceAlertCard: React.FC<{ balance: number }> = ({ balance }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Balance Alert</h3>
      <div className="space-y-3">
        {balance < 50 ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <div className="text-red-400 text-xl mr-3">⚠️</div>
              <div>
                <h4 className="text-sm font-medium text-red-800">Low Balance</h4>
                <p className="text-sm text-red-700">
                  Your RCN balance is running low. Purchase more to continue offering tier bonuses.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center">
              <div className="text-green-400 text-xl mr-3">✅</div>
              <div>
                <h4 className="text-sm font-medium text-green-800">Healthy Balance</h4>
                <p className="text-sm text-green-700">
                  Your RCN balance is sufficient for tier bonuses.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RecentPurchasesCard: React.FC<{ purchases: PurchaseHistory[] }> = ({ purchases }) => {
  const recentPurchases = purchases.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent RCN Purchases</h3>
      {recentPurchases.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No purchases yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(purchase.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {purchase.amount} RCN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${purchase.totalCost?.toFixed(2) || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {purchase.paymentMethod.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      purchase.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : purchase.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {purchase.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};