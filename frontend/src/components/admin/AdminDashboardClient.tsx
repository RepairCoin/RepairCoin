"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
import { OverviewTab } from "@/components/admin/tabs/OverviewTab";
import AdminsTab from "@/components/admin/tabs/AdminsTab";
import { CustomersTabEnhanced } from "@/components/admin/tabs/CustomersTabEnhanced";
import { ShopsManagementTab } from "@/components/admin/tabs/ShopsManagementTab";
import { AdvancedTreasuryTab } from "@/components/admin/tabs/AdvancedTreasuryTab";
import { AnalyticsTab } from "@/components/admin/tabs/AnalyticsTab";
import SubscriptionManagementTab from "@/components/admin/tabs/SubscriptionManagementTab";
import PromoCodesAnalyticsTab from "@/components/admin/tabs/PromoCodesAnalyticsTab";
import { CreateAdminTab } from "@/components/admin/tabs/CreateAdminTab";
import { SessionManagementTab } from "@/components/admin/tabs/SessionManagementTab";
import { AdminSupportTab } from "@/components/admin/tabs/AdminSupportTab";
import { AdminWaitlistTab } from "@/components/admin/tabs/AdminWaitlistTab";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { LazyTabWrapper } from "@/components/admin/LazyTabWrapper";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function AdminDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, userType, isLoading: authLoading } = useAuthStore();
  const [authInitialized, setAuthInitialized] = useState(false);

  // Connect to Thirdweb and populate auth store
  useAuth();

  // Authentication hook only - no data fetching here
  const {
    account,
    isAdmin,
    isSuperAdmin,
    adminRole,
  } = useAdminAuth();

  // Mark auth as initialized once authentication has been attempted
  useEffect(() => {
    // Auth is initialized when we have a definitive state:
    // 1. We have a userProfile (successfully authenticated), OR
    // 2. We have an account but no userProfile and auth is not loading (auth failed/not an admin), OR
    // 3. We don't have an account and auth is not loading (no wallet connected)

    if (userType !== null) {
      // We have a user profile - auth is complete
      setAuthInitialized(true);
    } else if (account && !authLoading) {
      // We have a wallet but no profile and not loading - give it a moment for auth to start
      // This prevents premature redirect during the brief moment between wallet connection and auth start
      const timer = setTimeout(() => {
        setAuthInitialized(true);
      }, 500); // 500ms delay to allow auth initialization to begin
      return () => clearTimeout(timer);
    } else if (!account && !authLoading) {
      // No wallet and not loading - definitely not authenticated
      setAuthInitialized(true);
    }
  }, [account, authLoading, userType]);

  // Client-side auth protection (since middleware is disabled for cross-domain)
  useEffect(() => {
    // CRITICAL: Wait for auth to initialize before redirecting
    // This prevents redirect on page refresh while session is being restored
    if (!authInitialized) {
      console.log('[AdminDashboard] Auth not initialized yet, waiting...');
      return;
    }

    // Don't redirect if we're still loading (isAuthenticated is false but may become true)
    if (isAuthenticated === false && userType) {
      // Auth has loaded and user is not authenticated
      console.log('[AdminDashboard] Not authenticated, redirecting to home');
      router.push('/');
    } else if (isAuthenticated && userType && userType !== 'admin') {
      // User is authenticated but wrong role
      console.log('[AdminDashboard] Wrong role, redirecting to home');
      router.push('/');
    }
  }, [isAuthenticated, userType, router, authInitialized]);

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState<string>("");
  const [customerView, setCustomerView] = useState<
    "grouped" | "all" | "unsuspend-requests"
  >("grouped");
  const [shopView, setShopView] = useState<
    "all" | "active" | "pending" | "rejected" | "unsuspend-requests"
  >("all");

  // Initialize tab and view from URL query parameters
  useEffect(() => {
    const tab = searchParams.get("tab");
    const view = searchParams.get("view");

    if (tab) {
      if (tab === "customers") {
        setActiveTab("customers");
        if (view === "grouped") {
          setActiveSubTab("customers-grouped");
          setCustomerView("grouped");
        } else if (view === "all") {
          setActiveSubTab("customers-all");
          setCustomerView("all");
        } else if (view === "unsuspend") {
          setActiveSubTab("customers-unsuspend");
          setCustomerView("unsuspend-requests");
        } else {
          // Default to grouped view
          setActiveSubTab("customers-grouped");
          setCustomerView("grouped");
        }
      } else if (tab === "shops-management") {
        setActiveTab("shops-management");
        if (view === "all") {
          setActiveSubTab("shops-all");
          setShopView("all");
        } else if (view === "active") {
          setActiveSubTab("shops-active");
          setShopView("active");
        } else if (view === "pending") {
          setActiveSubTab("shops-pending");
          setShopView("pending");
        } else if (view === "rejected") {
          setActiveSubTab("shops-rejected");
          setShopView("rejected");
        } else if (view === "unsuspend") {
          setActiveSubTab("shops-unsuspend");
          setShopView("unsuspend-requests");
        } else {
          // Default to all view
          setActiveSubTab("shops-all");
          setShopView("all");
        }
      } else {
        setActiveTab(tab);
        setActiveSubTab("");
      }
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    // Update URL with tab and view query parameters
    const url = new URL(window.location.href);

    // Handle customer sub-navigation
    if (tab === "customers-grouped") {
      setActiveTab("customers");
      setActiveSubTab("customers-grouped");
      setCustomerView("grouped");
      url.searchParams.set("tab", "customers");
      url.searchParams.set("view", "grouped");
    } else if (tab === "customers-all") {
      setActiveTab("customers");
      setActiveSubTab("customers-all");
      setCustomerView("all");
      url.searchParams.set("tab", "customers");
      url.searchParams.set("view", "all");
    } else if (tab === "customers-unsuspend") {
      setActiveTab("customers");
      setActiveSubTab("customers-unsuspend");
      setCustomerView("unsuspend-requests");
      url.searchParams.set("tab", "customers");
      url.searchParams.set("view", "unsuspend");
    } else if (tab === "customers") {
      // When clicking main customers tab, default to grouped view
      setActiveTab("customers");
      setActiveSubTab("customers-grouped");
      setCustomerView("grouped");
      url.searchParams.set("tab", "customers");
      url.searchParams.set("view", "grouped");
    }
    // Handle shop sub-navigation
    else if (tab === "shops-all") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-all");
      setShopView("all");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "all");
    } else if (tab === "shops-active") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-active");
      setShopView("active");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "active");
    } else if (tab === "shops-pending") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-pending");
      setShopView("pending");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "pending");
    } else if (tab === "shops-rejected") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-rejected");
      setShopView("rejected");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "rejected");
    } else if (tab === "shops-unsuspend") {
      setActiveTab("shops-management");
      setActiveSubTab("shops-unsuspend");
      setShopView("unsuspend-requests");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "unsuspend");
    } else if (tab === "shops-management") {
      // When clicking main shops tab, default to all view
      setActiveTab("shops-management");
      setActiveSubTab("shops-all");
      setShopView("all");
      url.searchParams.set("tab", "shops-management");
      url.searchParams.set("view", "all");
    } else {
      setActiveTab(tab as any);
      // Clear subtab when switching to a non-sub-navigated tab
      setActiveSubTab("");
      url.searchParams.set("tab", tab);
      url.searchParams.delete("view");
    }

    // Update the URL without reloading the page
    window.history.pushState({}, "", url);
  };

  // Loading state - while auth is initializing
  if (!authInitialized || authLoading) {
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-[#FFCC00] mb-4">
              Initializing...
            </h3>
            <p className="text-gray-300">
              Checking your authentication status
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
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


  return (
    <DashboardLayout
      userRole="admin"
      activeTab={activeTab}
      activeSubTab={activeSubTab}
      onTabChange={handleTabChange}
      isSuperAdmin={isSuperAdmin}
      adminRole={adminRole}
    >
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
          {/* Tab Content with Lazy Loading */}
          {activeTab === "overview" && (
            <LazyTabWrapper isActive={activeTab === "overview"}>
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
            </LazyTabWrapper>
          )}

          {/* Role-based tab content visibility with Lazy Loading */}
          {activeTab === "customers" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "customers"}>
                <CustomersTabEnhanced initialView={customerView} />
              </LazyTabWrapper>
            )}

          {/* New Combined Shop Management Tab with Lazy Loading */}
          {activeTab === "shops-management" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "shops-management"}>
                <ShopsManagementTab initialView={shopView} />
              </LazyTabWrapper>
            )}

          {/* Other tabs with Lazy Loading */}
          {activeTab === "treasury" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "treasury"}>
                <AdvancedTreasuryTab />
              </LazyTabWrapper>
            )}

          {activeTab === "admins" &&
            (isSuperAdmin || adminRole === "super_admin") && (
              <LazyTabWrapper isActive={activeTab === "admins"}>
                <AdminsTab />
              </LazyTabWrapper>
            )}

          {activeTab === "create-admin" && (
            <LazyTabWrapper isActive={activeTab === "create-admin"}>
              <CreateAdminTab />
            </LazyTabWrapper>
          )}

          {activeTab === "analytics" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "analytics"}>
                <AnalyticsTab />
              </LazyTabWrapper>
            )}
          {activeTab === "subscriptions" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "subscriptions"}>
                <SubscriptionManagementTab />
              </LazyTabWrapper>
            )}
          {activeTab === "promo-codes" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "promo-codes"}>
                <PromoCodesAnalyticsTab />
              </LazyTabWrapper>
            )}

          {/* Support Tab */}
          {activeTab === "support" && (
            <LazyTabWrapper isActive={activeTab === "support"}>
              <AdminSupportTab />
            </LazyTabWrapper>
          )}

          {/* Waitlist Tab */}
          {activeTab === "waitlist" && (
            <LazyTabWrapper isActive={activeTab === "waitlist"}>
              <AdminWaitlistTab />
            </LazyTabWrapper>
          )}

          {/* Session Management Tab */}
          {activeTab === "sessions" &&
            (isSuperAdmin ||
              adminRole === "super_admin" ||
              adminRole === "admin") && (
              <LazyTabWrapper isActive={activeTab === "sessions"}>
                <SessionManagementTab />
              </LazyTabWrapper>
            )}
        </div>
      </div>

    </DashboardLayout>
  );
}
