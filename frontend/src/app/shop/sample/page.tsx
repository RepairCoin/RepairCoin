"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";

export default function SampleDashboard() {
  return (
    <DashboardLayout userRole="shop">
      <div
        className="min-h-screen py-8 bg-[#0D0D0D]"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-6">Shop Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 bg-opacity-90 p-6 rounded-lg border border-gray-700">
              <h3 className="text-yellow-400 text-lg font-semibold mb-2">Total RCN Balance</h3>
              <p className="text-3xl font-bold text-white">1,250 RCN</p>
            </div>
            <div className="bg-gray-800 bg-opacity-90 p-6 rounded-lg border border-gray-700">
              <h3 className="text-yellow-400 text-lg font-semibold mb-2">Customers Served</h3>
              <p className="text-3xl font-bold text-white">342</p>
            </div>
            <div className="bg-gray-800 bg-opacity-90 p-6 rounded-lg border border-gray-700">
              <h3 className="text-yellow-400 text-lg font-semibold mb-2">This Month's Rewards</h3>
              <p className="text-3xl font-bold text-white">450 RCN</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
