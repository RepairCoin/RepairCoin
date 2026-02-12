"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { ReferralDashboard } from "@/components/customer/ReferralDashboard";
import { RedemptionApprovals } from "@/components/customer/RedemptionApprovals";
import { OverviewTab } from "@/components/customer/OverviewTab";
import { SettingsTab } from "@/components/customer/SettingsTab";
import { FindShop } from "@/components/customer/FindShop";
import { TokenGiftingTab } from "@/components/customer/TokenGiftingTab";
import { SuspensionBanner } from "@/components/customer/SuspensionBanner";
import { ServiceMarketplaceClient } from "@/components/customer/ServiceMarketplaceClient";
import { ServiceOrdersTab } from "@/components/customer/ServiceOrdersTab";
import { AppointmentsTab } from "@/components/customer/AppointmentsTab";
import { MessagesTab } from "@/components/customer/tabs/MessagesTab";
import { CustomerFAQSection } from "@/components/customer/CustomerFAQSection";
import { CustomerBreadcrumb } from "@/components/customer/CustomerBreadcrumb";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { FilterTabs } from "@/components/ui/FilterTabs";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function CustomerDashboardClient() {
  const router = useRouter();
  const account = useActiveAccount();
  const searchParams = useSearchParams();
  const { isAuthenticated, userType, isLoading: authLoading, userProfile } = useAuthStore();
  const [authInitialized, setAuthInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "marketplace" | "orders" | "appointments" | "messages" | "referrals" | "approvals" | "findshop" | "gifting" | "settings" | "faq"
  >("overview");

  // Delayed loading modal - prevents flash when cache loads quickly
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  useEffect(() => {
    if (!authInitialized || authLoading) {
      const timer = setTimeout(() => setShowLoadingModal(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowLoadingModal(false);
    }
  }, [authInitialized, authLoading]);

  // Mark auth as initialized once authentication has been attempted
  useEffect(() => {
    // Auth is initialized when we have a definitive state:
    // 1. We have a userProfile (successfully authenticated), OR
    // 2. We have an account but no userProfile and auth is not loading (auth failed/not a customer), OR
    // 3. We don't have an account and auth is not loading (no wallet connected)

    if (userType !== null) {
      // We have a user profile - auth is complete
      setAuthInitialized(true);
    } else if (account?.address && !authLoading) {
      // We have a wallet but no profile and not loading - give it a moment for auth to start
      // This prevents premature redirect during the brief moment between wallet connection and auth start
      const timer = setTimeout(() => {
        setAuthInitialized(true);
      }, 500); // 500ms delay to allow auth initialization to begin
      return () => clearTimeout(timer);
    } else if (!account?.address && !authLoading) {
      // No wallet and not loading - definitely not authenticated
      setAuthInitialized(true);
    }
  }, [account?.address, authLoading, userType]);

  // Client-side auth protection (since middleware is disabled for cross-domain)
  useEffect(() => {
    // CRITICAL: Wait for auth to initialize before redirecting
    // This prevents redirect on page refresh while session is being restored
    if (!authInitialized) {
      console.log('[CustomerDashboard] Auth not initialized yet, waiting...');
      return;
    }

    // Don't redirect if we're still loading (isAuthenticated is false but may become true)
    if (isAuthenticated === false && userType) {
      // Auth has loaded and user is not authenticated
      console.log('[CustomerDashboard] Not authenticated, redirecting to home');
      router.push('/');
    } else if (isAuthenticated && userType && userType !== 'customer') {
      // User is authenticated but wrong role
      console.log('[CustomerDashboard] Wrong role, redirecting to home');
      router.push('/');
    }
  }, [isAuthenticated, userType, router, authInitialized]);

  // Initialize tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);

    // Update URL with tab query parameter
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState({}, "", url);
  };

  // NEVER return null - always show something visible
  const isInitializing = !authInitialized || authLoading;

  // During initialization with no profile, show loading state (not blank)
  if (isInitializing && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not connected state - only show AFTER initialization is complete
  if (!isInitializing && !account && !userProfile) {
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
      <div
        className="min-h-screen py-8 bg-[#0D0D0D] pt-16 lg:pt-8"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Suspension Banner - Show if account is suspended */}
          {userProfile?.suspended && (
            <SuspensionBanner
              reason={userProfile.suspensionReason}
              suspendedAt={userProfile.suspendedAt}
            />
          )}

          {/* Breadcrumb */}
          <CustomerBreadcrumb activeTab={activeTab} />

          {/* Tab Content */}
          {activeTab === "overview" && <OverviewTab />}

          {/* Marketplace Tab */}
          {activeTab === "marketplace" && <ServiceMarketplaceClient />}

          {/* Messages Tab */}
          {activeTab === "messages" && userProfile?.id && (
            <MessagesTab customerId={userProfile.id} />
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && <ServiceOrdersTab />}

          {/* Appointments Tab */}
          {activeTab === "appointments" && <AppointmentsTab />}

          {/* Referrals Tab */}
          {activeTab === "referrals" && <ReferralDashboard />}

          {/* Approvals Tab */}
          {activeTab === "approvals" && <RedemptionApprovals />}

          {/* Find Shop Tab */}
          {activeTab === "findshop" && <FindShop />}

          {/* Token Gifting Tab */}
          {activeTab === "gifting" && <TokenGiftingTab />}

          {/* Settings Tab */}
          {activeTab === "settings" && <SettingsTab />}

          {/* FAQ Tab */}
          {activeTab === "faq" && <CustomerFAQSection />}
        </div>
      </div>
    </DashboardLayout>
  );
}