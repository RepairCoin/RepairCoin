"use client";

import { useState } from "react";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { Toaster } from "react-hot-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminDashboardData } from "@/hooks/useAdminDashboardData";
import { OverviewTab } from "@/components/admin/tabs/OverviewTab";
import AdminsTab from "@/components/admin/tabs/AdminsTab";
import { CustomersTabEnhanced } from "@/components/admin/tabs/CustomersTabEnhanced";
import { ShopsManagementTab } from "@/components/admin/tabs/ShopsManagementTab";
import { TreasuryTab } from "@/components/admin/tabs/TreasuryTab";
import { AnalyticsTab } from "@/components/admin/tabs/AnalyticsTab";
import SubscriptionManagementTab from "@/components/admin/tabs/SubscriptionManagementTab";
import PromoCodesAnalyticsTab from "@/components/admin/tabs/PromoCodesAnalyticsTab";
import { CreateAdminTab } from "@/components/admin/tabs/CreateAdminTab";
import { ShopReviewModal } from "@/components/admin/tabs/ShopReviewModal";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function AdminDashboardClient() {
  // Authentication hook
  const {
    account,
    isAdmin,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    loading: authLoading,
    generateAdminToken,
    hasPermission,
  } = useAdminAuth();
  const { isAuthenticated } = useAuth();

  console.log("adminRoleadminRoleadminRole: ", adminRole)

  // Dashboard data hook
  const {
    loading: dataLoading,
    error,
    pendingShops,
    approveShop,
    rejectShop,
  } = useAdminDashboardData(
    isAdmin,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    generateAdminToken,
    hasPermission
  );

  // UI state
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    shop: any | null;
  }>({
    isOpen: false,
    shop: null,
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState<string>("");
  const [customerView, setCustomerView] = useState<
    "grouped" | "all" | "unsuspend-requests"
  >("grouped");
  const [shopView, setShopView] = useState<
    "all" | "active" | "pending" | "rejected" | "unsuspend-requests"
  >("all");

  const handleTabChange = (tab: string) => {
    // Handle customer sub-navigation
    if (tab === "customers-grouped") {
      setActiveTab("customers");
      setActiveSubTab("customers-grouped");
      setCustomerView("grouped");
    } else if (tab === "customers-all") {
      setActiveTab("customers");
      setActiveSubTab("customers-all");
      setCustomerView("all");
    } else if (tab === "customers-unsuspend") {
      setActiveTab("customers");
      setActiveSubTab("customers-unsuspend");
      setCustomerView("unsuspend-requests");
    } else if (tab === "customers") {
      // When clicking main customers tab, default to grouped view
      setActiveTab("customers");
      setActiveSubTab("customers-grouped");
      setCustomerView("grouped");
    }
    // Handle shop sub-navigation
    else if (tab === "shops-all") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-all");
      setShopView("all");
    } else if (tab === "shops-active") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-active");
      setShopView("active");
    } else if (tab === "shops-pending") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-pending");
      setShopView("pending");
    } else if (tab === "shops-rejected") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-rejected");
      setShopView("rejected");
    } else if (tab === "shops-unsuspend") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-unsuspend");
      setShopView("unsuspend-requests");
    } else if (tab === "shops-management") {
      // When clicking main shops tab, default to all view
      setActiveTab("shops-management");
      setActiveSubTab("shops-all");
      setShopView("all");
    } else {
      setActiveTab(tab as any);
      // Clear subtab when switching to a non-sub-navigated tab
      setActiveSubTab("");
    }
  };

  if (!account && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          className="min-h-screen py-8 bg-[#0D0D0D] flex items-center justify-center"
          style={{
            backgroundImage: `url('/img/dashboard-bg.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="text-center rounded-lg p-8 border-gray-800 border-2 bg-[#212121]">
            <h1 className="text-3xl font-bold text-[#FFCC00] mb-4">
              Admin Dashboard
            </h1>
            <p className="text-gray-300 mb-8">
              Connect your admin wallet to access the dashboard
            </p>
            <ConnectButton client={client} />
          </div>
        </div>
      </div>
    );
  }

  console.log("isAdminisAdminisAdmin: ", isAdmin);

  return (
    <DashboardLayout
      userRole="admin"
      activeTab={activeTab}
      activeSubTab={activeSubTab}
      onTabChange={handleTabChange}
      isSuperAdmin={isSuperAdmin}
      adminRole={adminRole}
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
        <div className="max-w-7xl px-8 mx-auto py-8">
          {error && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              onQuickAction={(action) => {
                switch (action) {
                  case "mint":
                    setActiveTab("customers");
                    break;
                  case "shops":
                    setActiveTab("shop-applications");
                    break;
                  case "reports":
                    setActiveTab("analytics");
                    break;
                }
              }}
            />
          )}

          {/* Role-based tab content visibility */}
          {activeTab === "customers" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <CustomersTabEnhanced initialView={customerView} />
            )}

          {/* New Combined Shop Management Tab */}
          {activeTab === "shops-management" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <ShopsManagementTab initialView={shopView} />
            )}

          {/* Other tabs - TODO: Create components for these */}
          {activeTab === "treasury" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && <TreasuryTab />}

          {activeTab === "admins" &&
            (isSuperAdmin || adminRole === "super_admin") &&
            (authLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading admin data...</p>
                </div>
              </div>
            ) : (
              <AdminsTab />
            ))}

          {activeTab === "create-admin" && <CreateAdminTab />}

          {activeTab === "analytics" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && <AnalyticsTab />}
          {activeTab === "subscriptions" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && <SubscriptionManagementTab />}
          {activeTab === "promo-codes" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && <PromoCodesAnalyticsTab />}
        </div>
      </div>

      {/* Shop Review Modal */}
      <ShopReviewModal
        isOpen={reviewModal.isOpen}
        onClose={() => setReviewModal({ isOpen: false, shop: null })}
        shop={reviewModal.shop}
        onApprove={(shopId) => {
          approveShop(shopId);
          setReviewModal({ isOpen: false, shop: null });
        }}
        onReject={(shopId) => {
          rejectShop(shopId);
          setReviewModal({ isOpen: false, shop: null });
        }}
      />
    </DashboardLayout>
  );
}
