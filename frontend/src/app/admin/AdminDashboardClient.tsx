"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { toast, Toaster } from "react-hot-toast";
import { authManager } from "@/utils/auth";

// Import our new components
import { OverviewTab } from "@/components/admin/OverviewTab";
import AdminsTab from "@/components/admin/AdminsTab";
import { CustomersTabEnhanced } from "@/components/admin/CustomersTabEnhanced";
import { ShopsTab } from "@/components/admin/ShopsTab";
import { ShopApplicationsTab } from "@/components/admin/ShopApplicationsTab";
import { ShopsManagementTab } from "@/components/admin/ShopsManagementTab";
import { TreasuryTab } from "@/components/admin/TreasuryTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import SubscriptionManagementTab from "@/components/admin/SubscriptionManagementTab";
import PromoCodesAnalyticsTab from "@/components/admin/PromoCodesAnalyticsTab";
// UnsuspendRequestsTab removed - functionality integrated into Shop and Customer tabs
import { CreateAdminTab } from "@/components/admin/CreateAdminTab";
import { ShopReviewModal } from "@/components/admin/ShopReviewModal";
import DashboardLayout from "@/components/ui/DashboardLayout";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface PlatformStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  activeCustomersLast30Days: number;
  averageTransactionValue: number;
  topPerformingShops: Array<{
    shopId: string;
    name: string;
    totalTransactions: number;
  }>;
}

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  totalTokensIssued?: number;
  totalRedemptions?: number;
  crossShopEnabled?: boolean;
  cross_shop_enabled?: boolean;
  purchasedRcnBalance?: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  suspended_at?: string;
  suspension_reason?: string;
}

export default function AdminDashboardClient() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [rejectedShops, setRejectedShops] = useState<Shop[]>([]);
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    shop: any | null;
  }>({
    isOpen: false,
    shop: null,
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState<string>(""); // Will be set when customers tab is active
  const [customerView, setCustomerView] = useState<"grouped" | "all" | "unsuspend-requests">("grouped");
  const [shopView, setShopView] = useState<"all" | "active" | "pending" | "rejected" | "unsuspend-requests">("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);

  // Fetch admin profile with permissions
  const fetchAdminProfile = async () => {
    if (!account?.address) return null;
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        console.error("Failed to generate admin token for profile fetch");
        return null;
      }
      
      const response = await fetch(`${API_URL}/admin/me`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      
      if (!response.ok) {
        console.error("Failed to fetch admin profile:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error response:", errorText);
        return null;
      }
      
      const result = await response.json();
      console.log("Admin profile response:", result);
      return result.data;
    } catch (error) {
      console.error("Error fetching admin profile:", error);
      return null;
    }
  };

  // Check admin status
  useEffect(() => {
    // First, always reset state when account changes
    // This ensures we don't carry over permissions from previous account
    console.log("Account changed, resetting all admin state");
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setAdminPermissions([]);
    setActiveTab("overview"); // Reset to overview tab
    
    // Clear any cached authentication tokens
    authManager.clearToken("admin");
    localStorage.removeItem('isSuperAdmin');
    
    // Reset dashboard data from previous admin
    setStats(null);
    setShops([]);
    setPendingShops([]);
    setRejectedShops([]);
    setError(null);
    setLoading(true);
    
    const checkAdminStatus = async () => {
      if (!account?.address) {
        console.log("No account address, keeping reset state");
        return;
      }

      console.log("Checking admin status for new account:", account.address);

      // First, check if this is the super admin from env
      const adminAddresses = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || "")
        .split(",")
        .map((addr) => addr.toLowerCase().trim())
        .filter(addr => addr.length > 0);
      
      const isSuperAdminFromEnv = adminAddresses.length > 0 && adminAddresses[0] === account.address.toLowerCase();
      
      console.log("Admin addresses from env:", adminAddresses);
      console.log("Is super admin from env:", isSuperAdminFromEnv);

      try {
        // Small delay to ensure wallet is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to fetch admin profile - this will confirm admin status and get permissions
        const profile = await fetchAdminProfile();
        
        if (profile) {
          // User is an admin (either from env or database)
          console.log("Admin profile fetched:", profile);
          console.log("Profile says Is Super Admin:", profile.isSuperAdmin);
          console.log("Profile Permissions:", profile.permissions);
          
          setIsAdmin(true);
          
          // Trust the backend's determination of super admin status
          // Backend checks env and returns isSuperAdmin: true for env super admin
          const isSuper = profile.isSuperAdmin === true;
          setIsSuperAdmin(isSuper);
          
          // Set permissions - super admin gets ['*'], others get specific permissions
          const perms = profile.permissions || [];
          setAdminPermissions(perms);
          
          console.log("Final state - isSuperAdmin:", isSuper);
          console.log("Final state - permissions:", perms);
          
          // Store super admin status for future reference
          if (isSuper) {
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            localStorage.removeItem('isSuperAdmin');
          }
        } else {
          console.log("No admin profile found, user is not an admin");
          // Not an admin at all - state already reset above
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        // State already reset above, no need to reset again
      }
    };

    if (account?.address) {
      checkAdminStatus();
    }
  }, [account]);

  // Generate JWT token for admin authentication
  const generateAdminToken = async (
    forceRefresh: boolean = false
  ): Promise<string | null> => {
    if (!account?.address) return null;

    // Check if we already have a token stored (unless forcing refresh)
    if (!forceRefresh) {
      const storedToken = authManager.getToken("admin");
      if (storedToken) {
        return storedToken;
      }
    }

    try {
      const response = await fetch(
        `${API_URL}/auth/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: account.address,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        if (token) {
          // Store token using authManager
          authManager.setToken("admin", token, 24); // 24 hour expiry
          
          // Check if user is super admin
          if (data.user?.isSuperAdmin) {
            setIsSuperAdmin(true);
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            setIsSuperAdmin(false);
            localStorage.setItem('isSuperAdmin', 'false');
          }
          
          return token;
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Admin authentication failed");
        console.error("Admin auth failed:", errorData);
      }
    } catch (error) {
      console.error("Failed to generate admin token:", error);
      toast.error("Network error during authentication");
    }

    return null;
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError("Failed to authenticate as admin");
        return;
      }

      // Fetch platform statistics
      let statsResponse = await fetch(
        `${API_URL}/admin/stats`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      // If unauthorized, try refreshing the token
      if (statsResponse.status === 401 || statsResponse.status === 403) {
        console.log("Token expired or invalid, refreshing...");
        authManager.clearToken("admin");
        const newToken = await generateAdminToken(true);
        if (newToken) {
          statsResponse = await fetch(
            `${API_URL}/admin/stats`,
            {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            }
          );
        } else {
          setError(
            "Failed to authenticate as admin. Please check your wallet address."
          );
          setLoading(false);
          return;
        }
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log("Stats data:", statsData);
        setStats(statsData.data || statsData);
      } else {
        console.error(
          "Failed to fetch stats:",
          statsResponse.status,
          await statsResponse.text()
        );
      }

      // Only fetch shops if user has manage_shops permission
      const canManageShops = isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes('manage_shops');
      if (canManageShops) {
        // Fetch ALL shops to get complete data (including pending/unverified)
        const allShopsResponse = await fetch(
          `${API_URL}/admin/shops?active=all&verified=all`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          }
        );
        if (allShopsResponse.ok) {
          const allShopsData = await allShopsResponse.json();
          const allShops = allShopsData.data?.shops || [];
          console.log("All shops data:", allShops);

          // Separate shops based on their status
          const activeVerifiedShops = allShops.filter(
            (shop: any) => shop.active && shop.verified && !shop.suspended_at
          );
          const pendingShops = allShops.filter(
            (shop: any) => !shop.verified && !shop.suspended_at
          );
          const rejectedShops = allShops.filter(
            (shop: any) => shop.suspended_at || (!shop.active && shop.verified)
          );

          setShops(activeVerifiedShops);
          setPendingShops(pendingShops);
          setRejectedShops(rejectedShops);
        } else {
          console.error(
            "Failed to fetch shops:",
            allShopsResponse.status,
            await allShopsResponse.text()
          );
          // Fallback to empty arrays on error
          setShops([]);
          setPendingShops([]);
          setRejectedShops([]);
        }
      } else {
        // Clear all shops if user doesn't have permission
        setShops([]);
        setPendingShops([]);
        setRejectedShops([]);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load dashboard data when admin is confirmed and either:
    // - Has permissions set, or
    // - Is a super admin (who has all permissions implicitly)
    if (isAdmin && (adminPermissions.length > 0 || isSuperAdmin)) {
      loadDashboardData();
    }
  }, [isAdmin, adminPermissions, isSuperAdmin]);


  // Action handlers
  const mintTokensToCustomer = async (
    customerAddress: string,
    amount: number,
    reason: string
  ) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError("Failed to authenticate as admin");
        return;
      }

      const response = await fetch(
        `${API_URL}/admin/mint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            customerAddress,
            amount,
            reason,
          }),
        }
      );

      if (response.ok) {
        await loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to mint tokens");
      }
    } catch (error) {
      console.error("Error minting tokens:", error);
      setError("Failed to mint tokens");
    }
  };

  const suspendCustomer = async (address: string, reason: string = "Admin decision") => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error("Failed to authenticate");

    const response = await fetch(
      `${API_URL}/admin/customers/${address}/suspend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to suspend customer");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const unsuspendCustomer = async (address: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error("Failed to authenticate");

    const response = await fetch(
      `${API_URL}/admin/customers/${address}/unsuspend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to unsuspend customer");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const suspendShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error("Failed to authenticate");

    const response = await fetch(
      `${API_URL}/admin/shops/${shopId}/suspend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: "Admin action" }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to suspend shop");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const unsuspendShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error("Failed to authenticate");

    const response = await fetch(
      `${API_URL}/admin/shops/${shopId}/unsuspend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to unsuspend shop");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const verifyShop = async (shopId: string) => {
    const adminToken = await generateAdminToken();
    if (!adminToken) throw new Error("Failed to authenticate");

    const response = await fetch(
      `${API_URL}/admin/shops/${shopId}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to verify shop");
    }
  };

  const approveShop = async (shopId: string) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) throw new Error("Failed to authenticate");

      const response = await fetch(
        `${API_URL}/admin/shops/${shopId}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Approve shop error:", errorData);
        throw new Error(errorData.error || "Failed to approve shop");
      }

      // Refresh the data after approval
      await loadDashboardData();
      toast.success(`Shop ${shopId} approved successfully!`);
    } catch (error: any) {
      console.error("Error approving shop:", error);
      toast.error(error.message || "Failed to approve shop");
    }
  };

  const reviewShop = (shopId: string) => {
    const shop = pendingShops.find((s) => (s.shopId || s.shop_id) === shopId);
    if (shop) {
      setReviewModal({ isOpen: true, shop });
    }
  };

  const rejectShop = async (shopId: string, reason?: string) => {
    console.log("Rejecting shop:", shopId);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) throw new Error("Failed to authenticate");

      // Since there's no reject endpoint, we'll use suspend for unverified shops
      // This effectively "rejects" the application
      const url = `${API_URL}/admin/shops/${shopId}/suspend`;
      console.log("Suspend URL:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reason: `Application Rejected: ${
            reason || "Does not meet requirements"
          }`,
        }),
      });

      console.log("Suspend response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Reject shop error:", errorData);
        throw new Error(errorData.error || "Failed to reject shop");
      }

      const responseData = await response.json();
      console.log("Suspend response data:", responseData);

      // Refresh the data after rejection
      await loadDashboardData();
      toast.success(`Shop application rejected successfully!`);
    } catch (error: any) {
      console.error("Error rejecting shop:", error);
      toast.error(error.message || "Failed to reject shop");
      throw error; // Re-throw to handle in the UI
    }
  };

  const mintShopBalance = async (shopId: string) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        throw new Error("Failed to authenticate as admin");
      }

      const response = await fetch(
        `${API_URL}/admin/shops/${shopId}/mint-balance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mint balance");
      }

      const result = await response.json();
      toast.success(result.message || "Balance minted successfully");

      // Refresh shops data
      loadDashboardData();
    } catch (error) {
      console.error("Error minting balance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to mint balance"
      );
    }
  };

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

  // Helper function to check if user has a specific permission
  const hasPermission = (permission: string) => {
    console.log("Checking permission:", isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes(permission))
    return isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes(permission);
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">⚡</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your admin wallet to access the dashboard
            </p>
            <ConnectButton client={client} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 mb-8">
              You do not have admin privileges
            </p>
            <p className="text-sm text-gray-500">
              Connected wallet: {account.address}
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log("Rendering AdminDashboard - isSuperAdmin:", isSuperAdmin);
  console.log("Rendering AdminDashboard - adminPermissions:", adminPermissions);
  
  return (
    <DashboardLayout
      userRole="admin"
      activeTab={activeTab}
      activeSubTab={activeSubTab}
      onTabChange={handleTabChange}
      isSuperAdmin={isSuperAdmin}
      adminPermissions={adminPermissions}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              stats={stats}
              pendingShopsCount={pendingShops.length}
              loading={loading}
              generateAdminToken={generateAdminToken}
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

          {activeTab === "customers" && hasPermission('manage_customers') && (
            <CustomersTabEnhanced
              generateAdminToken={generateAdminToken}
              onMintTokens={mintTokensToCustomer}
              onRefresh={loadDashboardData}
              onSuspendCustomer={suspendCustomer}
              onUnsuspendCustomer={unsuspendCustomer}
              initialView={customerView}
            />
          )}

          {/* New Combined Shop Management Tab */}
          {activeTab === "shops-management" && hasPermission('manage_shops') && (
            <ShopsManagementTab
              activeShops={shops}
              pendingShops={pendingShops}
              rejectedShops={rejectedShops}
              onApproveShop={approveShop}
              onRejectShop={rejectShop}
              onVerifyShop={verifyShop}
              onSuspendShop={suspendShop}
              onUnsuspendShop={unsuspendShop}
              onMintBalance={mintShopBalance}
              onRefresh={loadDashboardData}
              loading={loading}
              generateAdminToken={generateAdminToken}
              initialView={shopView}
            />
          )}

          {/* Keep old tabs for backward compatibility - can be removed later */}
          {activeTab === "shops" && (
            <ShopsTab
              shops={shops}
              onVerifyShop={verifyShop}
              onSuspendShop={suspendShop}
              onUnsuspendShop={unsuspendShop}
              onEditShop={(shop) => console.log("Edit shop:", shop)}
              onMintBalance={mintShopBalance}
              onRefresh={loadDashboardData}
              generateAdminToken={generateAdminToken}
            />
          )}

          {activeTab === "shop-applications" && (
            <ShopApplicationsTab
              pendingShops={pendingShops}
              rejectedShops={rejectedShops}
              onApproveShop={approveShop}
              onReviewShop={reviewShop}
              onRejectShop={rejectShop}
              onRefresh={loadDashboardData}
            />
          )}

          {/* Other tabs - TODO: Create components for these */}
          {activeTab === "treasury" && hasPermission('manage_treasury') && (
            <TreasuryTab
              generateAdminToken={generateAdminToken}
              onError={setError}
            />
          )}

          {activeTab === "admins" && (isSuperAdmin || hasPermission('manage_admins')) && (
            loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="text-gray-600">Loading admin management...</div>
              </div>
            ) : (
              <AdminsTab />
            )
          )}

          {activeTab === "create-admin" && (
            <CreateAdminTab
              generateAdminToken={generateAdminToken}
              onError={setError}
              onSuccess={loadDashboardData}
            />
          )}

          {activeTab === "analytics" && hasPermission('view_analytics') && (
            <AnalyticsTab
              generateAdminToken={generateAdminToken}
              onError={setError}
            />
          )}
          {activeTab === "subscriptions" && hasPermission('manage_shops') && (
            <SubscriptionManagementTab />
          )}
          {activeTab === "promo-codes" && hasPermission('manage_shops') && (
            <PromoCodesAnalyticsTab/>
          )}
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
