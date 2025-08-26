"use client";

import React from "react";
import { WalletIcon } from "../../icon/index";

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

export const OverviewTab: React.FC<OverviewTabProps> = ({
  shopData,
  purchases,
  blockchainBalance = 0,
}) => {
  if (!shopData) {
    return <div>Loading shop data...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Shop Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Wallet Balance"
          value={blockchainBalance.toFixed(2)}
          subtitle="Your RCN tokens"
          color="green"
          icon={<WalletIcon />}
        />
        <StatCard
          title="Tokens Issued"
          value={shopData.totalTokensIssued || 0}
          subtitle="To customers"
          color="blue"
          icon={<WalletIcon />}
        />
        <StatCard
          title="Total Redemptions"
          value={shopData.totalRedemptions || 0}
          subtitle="RCN redeemed"
          color="purple"
          icon={<WalletIcon />}
        />
        <StatCard
          title="Distribution Credits"
          value={(Number(shopData.purchasedRcnBalance) || 0).toFixed(2)}
          subtitle="Available to distribute"
          color="orange"
          icon={<WalletIcon />}
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
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  color,
  icon,
}) => {
  return (
    <div
      className="rounded-2xl shadow-xl p-6"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center gap-4 justify-between">
        <div className="flex flex-col gap-2">
          <p className={`text-3xl font-bold text-white`}>{value}</p>
          <p className="text-lg font-medium text-[#FFCC00]">{title}</p>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
        <div className="w-20 text-3xl">{icon}</div>
      </div>
    </div>
  );
};

const StatusCard: React.FC<{ shopData: ShopData }> = ({ shopData }) => {
  return (
    <div
      className="bg-white rounded-2xl shadow-xl p-6"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">Shop Status</h3>
      <div className="space-y-3">
        <StatusRow
          label="Active Status"
          value={shopData.active ? "Active" : "Inactive"}
          status={shopData.active ? "success" : "error"}
        />
        <StatusRow
          label="Verification"
          value={shopData.verified ? "Verified" : "Pending"}
          status={shopData.verified ? "info" : "warning"}
        />
        <StatusRow
          label="Cross-Shop Redemption"
          value={shopData.crossShopEnabled ? "Enabled" : "Disabled"}
          status={shopData.crossShopEnabled ? "success" : "neutral"}
        />
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value: string; status: string }> = ({
  label,
  value,
  status,
}) => {
  const statusColors = {
    success: "bg-green-900 text-green-300",
    error: "bg-red-900 text-red-300",
    info: "bg-blue-900 text-blue-300",
    warning: "bg-yellow-900 text-yellow-300",
    neutral: "bg-gray-700 text-gray-300",
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-base">{label}</span>
      <span
        className={`px-6 py-1 rounded-full text-base font-semibold ${
          statusColors[status as keyof typeof statusColors]
        }`}
      >
        {value}
      </span>
    </div>
  );
};

const BalanceAlertCard: React.FC<{ balance: number }> = ({ balance }) => {
  return (
    <div
      className="bg-gray-800 bg-opacity-90 rounded-lg p-6"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">Balance Alert</h3>
      <div className="space-y-3">
        {balance < 50 ? (
          <div className="rounded-lg p-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <div className="bg-red-900 p-2 rounded-full text-base mr-3">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.4766 4.6875H10.8984V4.33594C10.8977 3.44939 10.551 2.59812 9.9321 1.96338C9.31317 1.32864 8.47092 0.960555 7.58467 0.9375H7.41533C6.52908 0.960555 5.68683 1.32864 5.0679 1.96338C4.44897 2.59812 4.10226 3.44939 4.10156 4.33594V4.6875H1.52344C1.49236 4.6875 1.46255 4.69985 1.44057 4.72182C1.4186 4.7438 1.40625 4.77361 1.40625 4.80469V13.5938C1.40625 13.7181 1.45564 13.8373 1.54354 13.9252C1.63145 14.0131 1.75068 14.0625 1.875 14.0625H13.125C13.2493 14.0625 13.3685 14.0131 13.4565 13.9252C13.5444 13.8373 13.5938 13.7181 13.5938 13.5938V4.80469C13.5938 4.77361 13.5814 4.7438 13.5594 4.72182C13.5374 4.69985 13.5076 4.6875 13.4766 4.6875ZM5.27344 4.36523C5.27344 3.13945 6.25225 2.12227 7.47803 2.10938C7.77218 2.10678 8.06394 2.16245 8.33648 2.27315C8.60902 2.38386 8.85695 2.54742 9.06597 2.7544C9.275 2.96138 9.44099 3.2077 9.55436 3.47913C9.66774 3.75057 9.72626 4.04177 9.72656 4.33594V4.6875H5.27344V4.36523ZM6.76201 11.7516L4.96406 9.65039L5.67627 9.04072L6.73828 10.2806L9.30205 7.07549L10.0345 7.66143L6.76201 11.7516Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-red-300">
                  Low Balance
                </p>
              </div>
              <p className="text-base text-gray-400">
                Your RCN balance is running low. Purchase more to continue
                offering tier bonuses.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <div className="bg-[#00880E] p-2 rounded-full text-base mr-3">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.4766 4.6875H10.8984V4.33594C10.8977 3.44939 10.551 2.59812 9.9321 1.96338C9.31317 1.32864 8.47092 0.960555 7.58467 0.9375H7.41533C6.52908 0.960555 5.68683 1.32864 5.0679 1.96338C4.44897 2.59812 4.10226 3.44939 4.10156 4.33594V4.6875H1.52344C1.49236 4.6875 1.46255 4.69985 1.44057 4.72182C1.4186 4.7438 1.40625 4.77361 1.40625 4.80469V13.5938C1.40625 13.7181 1.45564 13.8373 1.54354 13.9252C1.63145 14.0131 1.75068 14.0625 1.875 14.0625H13.125C13.2493 14.0625 13.3685 14.0131 13.4565 13.9252C13.5444 13.8373 13.5938 13.7181 13.5938 13.5938V4.80469C13.5938 4.77361 13.5814 4.7438 13.5594 4.72182C13.5374 4.69985 13.5076 4.6875 13.4766 4.6875ZM5.27344 4.36523C5.27344 3.13945 6.25225 2.12227 7.47803 2.10938C7.77218 2.10678 8.06394 2.16245 8.33648 2.27315C8.60902 2.38386 8.85695 2.54742 9.06597 2.7544C9.275 2.96138 9.44099 3.2077 9.55436 3.47913C9.66774 3.75057 9.72626 4.04177 9.72656 4.33594V4.6875H5.27344V4.36523ZM6.76201 11.7516L4.96406 9.65039L5.67627 9.04072L6.73828 10.2806L9.30205 7.07549L10.0345 7.66143L6.76201 11.7516Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-[#00C814]">
                  Healthy Balance
                </p>
              </div>
              <p className="text-base text-gray-400">
                Your RCN balance is sufficient for tier bonuses.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RecentPurchasesCard: React.FC<{ purchases: PurchaseHistory[] }> = ({
  purchases,
}) => {
  const recentPurchases = purchases.slice(0, 5);

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-6">
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">
        Recent Credit Purchases
      </h3>
      {recentPurchases.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No purchases yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                    {purchase.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${purchase.totalCost?.toFixed(2) || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {purchase.paymentMethod.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        purchase.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : purchase.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
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
