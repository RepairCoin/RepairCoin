"use client";

import { useState } from "react";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from "../../hooks/useAuth";
import { ReferralDashboard } from "../../components/customer/ReferralDashboard";
import { RedemptionApprovals } from "../../components/customer/RedemptionApprovals";
import { OverviewTab } from "../../components/customer/OverviewTab";
import { SettingsTab } from "../../components/customer/SettingsTab";
import { Toaster } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function CustomerDashboardClient() {
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "overview" | "referrals" | "approvals" | "settings"
  >("overview");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
  };

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">👤</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Customer Dashboard
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to access the dashboard
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      userRole="customer"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <Toaster position="top-right" />
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
          {/* Tab Content */}
          {activeTab === "overview" && <OverviewTab />}

          {/* Referrals Tab */}
          {activeTab === "referrals" && <ReferralDashboard />}

          {/* Approvals Tab */}
          {activeTab === "approvals" && <RedemptionApprovals />}

          {/* Settings Tab */}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}