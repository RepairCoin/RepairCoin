"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ThirdwebPayment from "../ThirdwebPayment";
import "@/styles/animations.css";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";

// Import our new components
import { OverviewTab } from "@/components/shop/tabs/OverviewTab";
import { PurchaseTab } from "@/components/shop/tabs/PurchaseTab";
import { BonusesTab } from "@/components/shop/tabs/BonusesTab";
import { AnalyticsTab } from "@/components/shop/tabs/AnalyticsTab";
import { RedeemTabV2 } from "@/components/shop/tabs/RedeemTabV2";
import { IssueRewardsTab } from "@/components/shop/tabs/IssueRewardsTab";
import { CustomerLookupTab } from "@/components/shop/tabs/CustomerLookupTab";
import { SettingsTab } from "@/components/shop/tabs/SettingsTab";
import { CustomersTab } from "@/components/shop/tabs/CustomersTab";
import PromoCodesTab from "@/components/shop/tabs/PromoCodesTab";
import { ShopLocationTab } from "@/components/shop/tabs/ShopLocationTab";
import { ShopBreadcrumb } from "@/components/shop/ShopBreadcrumb";
import { GroupsTab } from "@/components/shop/tabs/GroupsTab";
import { ServicesTab } from "@/components/shop/tabs/ServicesTab";
import { ShopServiceOrdersTab } from "@/components/shop/tabs/ShopServiceOrdersTab";
import { MarketingTab } from "@/components/shop/tabs/MarketingTab";
import ServiceAnalyticsTab from "@/components/shop/tabs/ServiceAnalyticsTab";
import { AppointmentCalendar } from "@/components/shop/AppointmentCalendar";
import { useShopRegistration } from "@/hooks/useShopRegistration";
import { OnboardingModal } from "@/components/shop/OnboardingModal";
import { SuspendedShopModal } from "@/components/shop/SuspendedShopModal";
import { CancelledSubscriptionModal } from "@/components/shop/CancelledSubscriptionModal";
import { OperationalRequiredTab } from "@/components/shop/OperationalRequiredTab";
import { SubscriptionManagement } from "@/components/shop/SubscriptionManagement";
import { CoinsIcon } from 'lucide-react';
import SuccessModal from "@/components/modals/SuccessModal";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  subscriptionActive?: boolean;
  subscriptionStatus?: string | null;
  subscriptionCancelledAt?: string | null;
  subscriptionEndsAt?: string | null; // When subscription access ends (period end for cancelled subs)
  category?: string;
  totalTokensIssued: number;
  totalRedemptions: number;
  purchasedRcnBalance: number;
  totalRcnPurchased: number;
  lastPurchaseDate?: string;
  operational_status?:
    | "pending"
    | "rcg_qualified"
    | "subscription_qualified"
    | "not_qualified"
    | "paused";
  rcg_tier?: string;
  rcg_balance?: number;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  website?: string;
  suspended_at?: string;
  suspendedAt?: string;
  suspension_reason?: string;
  suspensionReason?: string;
  location?: {
    city?: string;
    state?: string;
    zipCode?: string;
    lat?: number;
    lng?: number;
  };
}

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface TierBonusStats {
  totalBonusesIssued: number;
  totalBonusAmount: number;
  bonusesByTier: { [key: string]: { count: number; amount: number } };
  averageBonusPerTransaction: number;
}

export default function ShopDashboardClient() {
  const router = useRouter();
  const account = useActiveAccount();
  const searchParams = useSearchParams();
  const { isAuthenticated, userType, isLoading: authLoading, authInitialized } = useAuthStore();
  const { existingApplication } = useShopRegistration();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [tierStats, setTierStats] = useState<TierBonusStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Purchase form state
  const [purchaseAmount, setPurchaseAmount] = useState<number>(0);
  const [purchasing, setPurchasing] = useState(false);

  // Payment flow state
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(
    null
  );
  const [showPayment, setShowPayment] = useState(false);

  // Onboarding modal state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Suspended/Rejected modal state
  const [showSuspendedModal, setShowSuspendedModal] = useState(true);

  // Cancelled subscription modal state
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    amount?: number;
    title?: string;
    subtitle?: string;
  }>({});

  // Auth token managed via httpOnly cookies - no longer needed in state
  // Keeping state for backward compatibility during migration
  useEffect(() => {
    // Token now managed by cookies - this is deprecated
    setAuthToken(null);
  }, []);

  // Note: authInitialized is now managed by useAuthInitializer hook in the auth store
  // No need for local state or useEffect - it's set when session check completes

  // Client-side auth protection (since middleware is disabled for cross-domain)
  useEffect(() => {
    // CRITICAL: Wait for auth to initialize before redirecting
    // This prevents redirect on page refresh while session is being restored
    if (!authInitialized) {
      console.log('[ShopDashboard] Auth not initialized yet, waiting...');
      return;
    }

    // Allow unverified shops to view dashboard (isAuthenticated=false but userType='shop')
    if (isAuthenticated === false && userType && userType !== 'shop') {
      // Auth has loaded, user has a profile but wrong role (not a shop)
      console.log('[ShopDashboard] Not a shop user, redirecting to home');
      router.push('/');
    } else if (isAuthenticated === false && !userType) {
      // No user profile at all (completely logged out)
      console.log('[ShopDashboard] No user profile, redirecting to home');
      router.push('/');
    } else if (isAuthenticated && userType && userType !== 'shop') {
      // User is authenticated but wrong role
      console.log('[ShopDashboard] Wrong role, redirecting to home');
      router.push('/');
    }
  }, [isAuthenticated, userType, router, authInitialized]);

  useEffect(() => {
    // Set active tab from URL query param
    const tab = searchParams.get("tab");
    const payment = searchParams.get("payment");
    const purchaseId = searchParams.get("purchase_id");
    const shouldReload = searchParams.get("reload");

    if (tab) {
      setActiveTab(tab);
    }

    // Check if we should force reload shop data (coming from subscription success)
    if (shouldReload === "true" || sessionStorage.getItem('forceReloadShopData') === 'true' || sessionStorage.getItem('subscriptionActivated') === 'true') {
      console.log('Force reloading shop data after subscription activation...');
      sessionStorage.removeItem('forceReloadShopData');
      sessionStorage.removeItem('subscriptionActivated');
      
      // Clear cached data and force reload
      localStorage.removeItem('shopData');
      if (account?.address) {
        loadShopData();
      }
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("reload");
      window.history.replaceState({}, '', url.toString());
    }

    // Handle Stripe payment success redirect
    if (payment === "success" && purchaseId) {
      // Show success modal instead of just toast
      setSuccessModalData({
        title: "Payment Successful!",
        subtitle: "Your RCN tokens have been added to your account.",
      });
      setShowSuccessModal(true);
      // Reload shop data to show updated balance
      if (account?.address) {
        loadShopData();
      }
      // Clear the payment params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("purchase_id");
      window.history.replaceState({}, "", url);
    } else if (payment === "cancelled") {
      toast.error("Payment was cancelled. Please try again.", {
        duration: 4000,
        position: 'top-right',
      });
      // Clear the payment params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("purchase_id");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams, account?.address]);

  useEffect(() => {
    if (account?.address) {
      loadShopData();
    }
  }, [account?.address]);

  // Check if shop is suspended or rejected
  const isSuspended = shopData && (shopData.suspended_at || shopData.suspendedAt);
  // Check if shop is pending (not yet verified) - must check this BEFORE rejected
  const isPending = shopData && !shopData.verified && !isSuspended;
  // Rejected means application was denied - shop is verified but inactive and NOT suspended
  // Only verified shops can be "rejected" - unverified shops are "pending"
  const isRejected = shopData && shopData.verified && !shopData.active && !isSuspended;

  // Check if shop is operational
  // If operational_status is not available (legacy), assume operational if shop is active and verified
  const isOperational =
    shopData &&
    (shopData.operational_status === "rcg_qualified" ||
      shopData.operational_status === "subscription_qualified" ||
      // Fallback: If operational_status is missing but shop is active and verified, assume operational
      (!shopData.operational_status && shopData.active && shopData.verified));

  // Check if subscription is paused
  const isPaused = shopData?.operational_status === 'paused' || shopData?.subscriptionStatus === 'paused';

  // Check if subscription is cancelled but still active (until period end)
  const isCancelledButActive = shopData?.subscriptionStatus === 'cancelled' &&
    shopData?.subscriptionCancelledAt &&
    shopData?.subscriptionEndsAt &&
    new Date(shopData.subscriptionEndsAt) > new Date();

  // Shop should be blocked if: suspended, rejected, pending, paused, or not operational (unsubscribed/expired)
  const isBlocked = !!(isSuspended || isRejected || isPending || isPaused || !isOperational);

  // Get the block reason
  const getBlockReason = () => {
    if (isSuspended) return "Shop is suspended";
    if (isRejected) return "Shop application was rejected";
    if (isPaused) return "Shop subscription is paused";
    if (isPending) return "Shop application is pending approval";
    if (!isOperational) return "Shop subscription is required or expired";
    return "Shop is not operational";
  };

  // Show appropriate modal based on shop status
  // Don't show if we're on the settings tab
  useEffect(() => {
    if (shopData && activeTab !== "settings") {
      // For pending shops without subscription, show onboarding modal
      if (isPending && !shopData.subscriptionActive) {
        setShowOnboardingModal(true);
        setShowSuspendedModal(false);
      } else if (isSuspended || isRejected || isPaused || !isOperational) {
        // Show suspended modal for suspended/rejected/paused/unsubscribed shops
        setShowSuspendedModal(true);
        setShowOnboardingModal(false);
      } else {
        setShowSuspendedModal(false);
        setShowOnboardingModal(false);
      }
    } else {
      setShowSuspendedModal(false);
      setShowOnboardingModal(false);
    }
  }, [shopData, isOperational, isSuspended, isRejected, isPending, isPaused, activeTab]);

  // Show cancelled subscription modal once when detected (unless on settings tab)
  useEffect(() => {
    if (shopData && activeTab !== "settings" && isCancelledButActive) {
      // Check if we've already shown this modal for this session
      const modalShownKey = `cancelledModalShown_${shopData.shopId}`;
      if (!sessionStorage.getItem(modalShownKey)) {
        setShowCancelledModal(true);
        sessionStorage.setItem(modalShownKey, 'true');
      }
    }
  }, [shopData, activeTab, isCancelledButActive]);

  // Check pending purchases on shop data load
  useEffect(() => {
    const checkPendingPurchases = async () => {
      if (!shopData || !account?.address) return;

      try {
        const response = await apiClient.get('/shops/purchase-sync/pending');

        if (response.success) {
          const result = response;
          if (result.data && result.data.length > 0) {
            // Silently check each pending purchase
            for (const purchase of result.data) {
              if (
                purchase.payment_reference &&
                purchase.payment_reference.startsWith("cs_")
              ) {
                try {
                  const checkResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/shops/purchase-sync/check-payment/${purchase.id}`,
                    {
                      method: "POST",
                      headers: {
                        Authorization: authToken ? `Bearer ${authToken}` : "",
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  const checkResult = await checkResponse.json();
                  if (
                    checkResult.success &&
                    checkResult.data.status === "completed"
                  ) {
                    // Reload to show updated balance
                    await loadShopData();
                  }
                } catch (err) {
                  console.error("Error checking purchase:", purchase.id, err);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking pending purchases:", error);
      }
    };

    // Check pending purchases after shop data loads
    if (shopData) {
      checkPendingPurchases();
    }
  }, [shopData?.shopId]);

  const loadShopData = async () => {
    setLoading(true);
    setError(null);

    try {
      // NOTE: Authentication is now handled globally by useAuthInitializer
      // No need to call /auth/shop here - cookies are already set

      // Load shop data with authentication (cookies sent automatically)
      const shopResult = await apiClient.get(`/shops/wallet/${account?.address}`);

      if (shopResult.success && shopResult.data) {
        let enhancedShopData = shopResult.data;

        // Load additional data if we have a shopId
        if (shopResult.data.shopId) {
          // Load subscription details to check for cancelled-but-active subscriptions
          try {
            const subResult = await apiClient.get(`/shops/subscription/status`);
            if (subResult.success && subResult.data?.currentSubscription) {
              const sub = subResult.data.currentSubscription;

              // Determine actual status - if cancelAtPeriodEnd is true, treat as cancelled
              const actualStatus = sub.cancelAtPeriodEnd ? 'cancelled' : sub.status;

              enhancedShopData = {
                ...enhancedShopData,
                subscriptionStatus: actualStatus,
                subscriptionCancelledAt: sub.cancelledAt || (sub.cancelAtPeriodEnd ? new Date().toISOString() : null),
                subscriptionEndsAt: sub.currentPeriodEnd || sub.nextPaymentDate || sub.activatedAt, // Use Stripe's currentPeriodEnd
              };

              console.log('📋 Subscription details loaded:', {
                status: actualStatus,
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                currentPeriodEnd: sub.currentPeriodEnd,
                nextPaymentDate: sub.nextPaymentDate
              });
            }
          } catch (subErr) {
            console.error("Error loading subscription details:", subErr);
            // Continue without subscription details
          }

          // Load purchase history
          const purchaseResult = await apiClient.get(`/shops/purchase/history/${shopResult.data.shopId}`);
          if (purchaseResult.success) {
            setPurchases(purchaseResult.data.purchases || []);
          }

          // Load tier bonus stats
          const tierResult = await apiClient.get(`/shops/tier-bonus/stats/${shopResult.data.shopId}`);
          if (tierResult.success) {
            setTierStats(tierResult.data);
          }
        }

        setShopData(enhancedShopData);
      } else {
        setError("Invalid shop data received");
      }
    } catch (err) {
      console.error("Error loading shop data:", err);
      setError("Failed to load shop data");
    } finally {
      setLoading(false);
    }
  };

  const initiatePurchase = async () => {
    if (!isOperational) {
      setShowOnboardingModal(true);
    } else {
      if (!shopData || !account?.address) {
        setError("Shop data not loaded or wallet not connected");
        return;
      }

      setPurchasing(true);
      setError(null);

      try {
        console.log("Creating Stripe checkout session:", {
          shopId: shopData.shopId,
          amount: purchaseAmount,
          shopData: shopData,
        });

        const response = await apiClient.post('/shops/purchase/stripe-checkout', {
          amount: purchaseAmount,
        }) as any;

        console.log("Stripe checkout response:", response);

        if (!response.success) {
          const errorMessage = response.error || "Stripe checkout creation failed";
          console.error("Stripe checkout creation failed:", errorMessage);
          throw new Error(errorMessage);
        }

        const checkoutUrl = response.data?.checkoutUrl;
        if (!checkoutUrl) {
          throw new Error("No checkout URL received from server");
        }

        console.log("Redirecting to Stripe checkout...");

        // Redirect to Stripe checkout
        window.location.href = checkoutUrl;
      } catch (err) {
        console.error("Error initiating purchase:", err);
        setError(
          err instanceof Error ? err.message : "Purchase initiation failed"
        );
      } finally {
        setPurchasing(false);
      }
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    setCurrentPurchaseId(null);

    // Show success modal with animation
    setSuccessModalData({
      title: "Payment Successful!",
      subtitle: `${purchaseAmount} distribution credits have been added to your account.`,
      amount: purchaseAmount,
    });
    setShowSuccessModal(true);

    // Reload shop data to show updated balance
    await loadShopData();
  };

  const handlePaymentError = (error: string) => {
    setError(`Payment failed: ${error}`);
  };

  const cancelPayment = () => {
    setShowPayment(false);
    setCurrentPurchaseId(null);
  };

  const checkPurchaseStatus = async (purchaseId: string) => {
    try {
      const result = await apiClient.post(`/shops/purchase-sync/check-payment/${purchaseId}`) as any;

      if (result.success && result.data.status === "completed") {
        toast.success(
          `Payment verified! ${result.data.amount} RCN has been added to your account.`,
          {
            duration: 5000,
            position: 'top-center',
            style: {
              background: '#10B981',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              padding: '16px',
            },
            icon: '✅',
          }
        );
        // Reload data to show updated balance
        await loadShopData();
      } else if (result.success === false && result.data?.status === "failed") {
        // Payment session has expired
        toast.error(
          result.message || "Payment session has expired. Please create a new purchase.",
          {
            duration: 5000,
            position: 'top-center',
            style: {
              background: '#EF4444',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              padding: '16px',
            },
            icon: '⏰',
          }
        );
        // Reload data to reflect the failed status
        await loadShopData();
      } else if (result.success === false && result.data?.stripeStatus) {
        setError(
          `Payment status: ${result.data.stripeStatus}. Please wait a moment and try again.`
        );
      } else {
        setError(result.message || "Could not verify payment status");
      }
    } catch (error) {
      console.error("Error checking purchase status:", error);
      setError("Failed to check payment status");
    }
  };

  // Error state (shop not found)
  if (error && !shopData && !existingApplication.hasApplication) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Shop Not Found
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <a
              href="/register/shop"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-105 inline-block"
            >
              Register Shop
            </a>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <ConnectButton
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state - while auth is initializing
  if (!authInitialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Initializing...
            </h3>
            <p className="text-gray-600">
              Checking your authentication status
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Shop Dashboard
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your shop wallet to access the dashboard
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

  // Show loading state if shop is verified but data is still loading
  if (
    existingApplication.hasApplication &&
    !shopData &&
    existingApplication.status === "verified" &&
    loading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-blue-500 text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Loading Dashboard
            </h3>
            <p className="text-gray-600 mb-6">
              Your shop is verified! Loading your dashboard data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If shop is verified but data failed to load, show error with retry option
  if (
    existingApplication.hasApplication &&
    !shopData &&
    existingApplication.status === "verified" &&
    !loading &&
    error
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Connection Issue
            </h3>
            <p className="text-gray-600 mb-6">
              Your shop is verified, but we're having trouble loading your
              dashboard data.
            </p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => loadShopData()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show pending message if application exists but is not verified
  if (
    existingApplication.hasApplication &&
    !shopData &&
    existingApplication.status !== "verified"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-yellow-500 text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Application Pending
            </h3>
            <p className="text-gray-600 mb-6">
              Your shop registration has been submitted and is awaiting admin
              verification. You'll be able to access the full dashboard once
              approved.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Shop Name:</span>
                <span className="font-medium text-gray-900">
                  {existingApplication.shopName}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Shop ID:</span>
                <span className="font-medium text-gray-900">
                  {existingApplication.shopId}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                  Pending Verification
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-6 text-left">
              <p>What happens next:</p>
              <ul className="mt-2 text-left space-y-1">
                <li>• Admin reviews your application</li>
                <li>• Shop verification process</li>
                <li>• Dashboard access granted</li>
                <li>• RCN purchasing enabled</li>
              </ul>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <ConnectButton
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("filter");
    window.history.pushState({}, "", url);
  };

  // Main dashboard
  return (
    <DashboardLayout
      userRole="shop"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <div className="min-h-screen py-8">
        <div className="max-w-screen-2xl w-[96%] mx-auto">
          {/* Warning Banner for Non-Operational Shops */}
          {/* Only show when shop data is loaded (not during loading state) */}
          {shopData && isBlocked && !showSuspendedModal && !showOnboardingModal && (
            <div className={`mb-6 rounded-xl p-4 ${
              isPending ? 'bg-yellow-900/20 border-2 border-yellow-500/50' :
              isPaused ? 'bg-blue-900/20 border-2 border-blue-500/50' :
              'bg-red-900/20 border-2 border-red-500/50'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`text-2xl ${
                  isPending ? 'text-yellow-400' :
                  isPaused ? 'text-blue-400' :
                  'text-red-400'
                }`}>⚠️</div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold mb-1 ${
                    isPending ? 'text-yellow-400' :
                    isPaused ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {isSuspended && "Shop Suspended"}
                    {isRejected && "Shop Application Rejected"}
                    {isPending && "Application Pending Approval"}
                    {isPaused && "Subscription Paused"}
                    {!isSuspended && !isRejected && !isPending && !isPaused && !isOperational && "Subscription Required"}
                  </h3>
                  <p className="text-gray-300 text-sm">
                    {isSuspended && "Your shop has been suspended. You cannot perform operational actions (issue rewards, process redemptions, purchase credits)."}
                    {isRejected && "Your shop application was rejected. You cannot perform operational actions until your application is approved."}
                    {isPending && "Your shop application is awaiting admin approval. You cannot perform operational actions until approved."}
                    {isPaused && "Your subscription has been temporarily paused by the administrator. You cannot perform operational actions until the subscription is resumed."}
                    {!isSuspended && !isRejected && !isPending && !isPaused && !isOperational && "Your shop requires an active subscription. You cannot perform operational actions until subscribed."}
                  </p>
                </div>
                {isBlocked && (
                  <button
                    onClick={() => setShowSuspendedModal(true)}
                    className="text-gray-400 hover:text-white text-sm px-3 py-1 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
                  >
                    Details
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Warning Banner for Cancelled but Active Subscriptions */}
          {isCancelledButActive && !isBlocked && (
            <div className="mb-6 rounded-xl p-4 bg-orange-900/20 border-2 border-orange-500/50">
              <div className="flex items-start gap-3">
                <div className="text-2xl text-orange-400">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1 text-orange-400">
                    Subscription Cancellation Scheduled
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Your subscription has been cancelled and will end on{' '}
                    <span className="font-semibold text-white">
                      {new Date(shopData?.subscriptionEndsAt!).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    . You can continue using all shop features until then. After this date, you will need to resubscribe to continue operations.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Manage Subscription
                    </button>
                    <span className="text-xs text-gray-400">
                      {Math.ceil((new Date(shopData?.subscriptionEndsAt!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Breadcrumb Navigation */}
          <ShopBreadcrumb activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              shopData={shopData}
              purchases={purchases}
              onRefreshData={loadShopData}
              authToken={authToken ?? undefined}
            />
          )}

          {activeTab === "services" && shopData && (
            <ServicesTab shopId={shopData.shopId} shopData={shopData} />
          )}

          {activeTab === "bookings" && shopData && (
            <ShopServiceOrdersTab shopId={shopData.shopId} />
          )}

          {activeTab === "service-analytics" && shopData && (
            <ServiceAnalyticsTab />
          )}

          {activeTab === "appointments" && shopData && (
            <AppointmentCalendar />
          )}

          {activeTab === "purchase" && (
            <PurchaseTab
              purchaseAmount={purchaseAmount}
              setPurchaseAmount={setPurchaseAmount}
              purchasing={purchasing}
              purchases={purchases}
              onInitiatePurchase={initiatePurchase}
              onCheckPurchaseStatus={checkPurchaseStatus}
              isBlocked={isBlocked}
              blockReason={getBlockReason()}
            />
          )}

          {activeTab === "bonuses" && (
            <BonusesTab tierStats={tierStats} shopData={shopData} />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab
              shopData={shopData}
              tierStats={tierStats}
              purchases={purchases}
            />
          )}

          {activeTab === "redeem" && shopData && (
            <RedeemTabV2
              shopId={shopData.shopId}
              isOperational={isOperational}
              onRedemptionComplete={loadShopData}
              setShowOnboardingModal={setShowOnboardingModal}
              shopData={shopData}
              isBlocked={isBlocked}
              blockReason={getBlockReason()}
              shopRcnBalance={shopData.purchasedRcnBalance || 0}
            />
          )}

          {activeTab === "issue-rewards" && shopData && (
            <IssueRewardsTab
              shopId={shopData.shopId}
              shopData={shopData}
              onRewardIssued={loadShopData}
              isBlocked={isBlocked}
              blockReason={getBlockReason()}
            />
          )}

          {activeTab === "customers" && shopData && (
            <CustomersTab shopId={shopData.shopId} />
          )}

          {activeTab === "lookup" && shopData && (
            <CustomerLookupTab shopId={shopData.shopId} />
          )}

          {activeTab === "promo-codes" && shopData && (
            <PromoCodesTab shopId={shopData.shopId} />
          )}

          {activeTab === "shop-location" && shopData && (
            <ShopLocationTab
              shopId={shopData.shopId}
              shopData={shopData}
              onLocationUpdate={loadShopData}
            />
          )}

          {activeTab === "subscription" && shopData && (
            <SubscriptionManagement shopId={shopData.shopId} />
          )}

          {activeTab === "marketing" && shopData && (
            <MarketingTab shopId={shopData.shopId} shopName={shopData.name} />
          )}

          {activeTab === "settings" && shopData && (
            <SettingsTab
              shopId={shopData.shopId}
              shopData={shopData}
              onSettingsUpdate={loadShopData}
            />
          )}

          {activeTab === "groups" && shopData && (
            <>
              {console.log('🔐 [ShopDashboard] Passing to GroupsTab:', {
                shopId: shopData.shopId,
                subscriptionActive: shopData.subscriptionActive,
                isOperational: isOperational,
                operationalStatus: shopData.operational_status,
                subscriptionActiveType: typeof shopData.subscriptionActive,
                shopDataKeys: Object.keys(shopData)
              })}
              <GroupsTab
                shopId={shopData.shopId}
                subscriptionActive={isOperational || false}
              />
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900 bg-opacity-90 border border-red-700 rounded-lg p-4 mt-6">
              <div className="flex">
                <div className="text-red-400 text-2xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-200">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Modal */}
          {showPayment && currentPurchaseId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="max-w-md w-full">
                <ThirdwebPayment
                  purchaseId={currentPurchaseId}
                  amount={purchaseAmount}
                  totalCost={purchaseAmount * 0.1} // $0.10 per RCN
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={cancelPayment}
                />

                {/* Cancel Button */}
                <div className="mt-4 text-center">
                  <button
                    onClick={cancelPayment}
                    className="text-gray-400 hover:text-gray-300 text-sm"
                  >
                    Cancel Payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal - Using new reusable component */}
          <SuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false);
              // Clear the payment success params from URL
              const url = new URL(window.location.href);
              url.searchParams.delete("payment");
              url.searchParams.delete("purchase_id");
              window.history.replaceState({}, "", url);
            }}
            title={successModalData.title}
            subtitle={successModalData.subtitle}
            amount={successModalData.amount}
            currency="RCN"
            showCoinsAnimation={true}
          />

          {/* Onboarding Modal */}
          {shopData && (
            <>
              <OnboardingModal
                shopData={shopData}
                open={showOnboardingModal}
                onClose={() => setShowOnboardingModal(false)}
              />

              {/* Suspended/Rejected/Unsubscribed/Pending Shop Modal */}
              <SuspendedShopModal
                isOpen={isBlocked && showSuspendedModal}
                onClose={() => {
                  // Allow user to dismiss the modal
                  // They can navigate the dashboard but operational features will be blocked
                  setShowSuspendedModal(false);
                }}
                shopName={shopData?.name || ""}
                suspensionReason={shopData?.suspension_reason || shopData?.suspensionReason}
                suspendedAt={shopData?.suspended_at || shopData?.suspendedAt}
                modalType={
                  isSuspended ? 'suspended' :
                  isRejected ? 'rejected' :
                  // Check if subscription is paused
                  shopData?.operational_status === 'paused' || shopData?.subscriptionStatus === 'paused' ? 'paused' :
                  // For pending shops, check if they have a subscription
                  // If no subscription, show requirements modal instead of pending
                  isPending ? (shopData?.subscriptionActive ? 'pending' : 'unsubscribed') :
                  !isOperational ? 'unsubscribed' :
                  'suspended' // fallback
                }
              />

              {/* Cancelled Subscription Modal */}
              {isCancelledButActive && shopData?.subscriptionEndsAt && (
                <CancelledSubscriptionModal
                  isOpen={showCancelledModal}
                  onClose={() => setShowCancelledModal(false)}
                  shopName={shopData?.name || ""}
                  endsAt={shopData.subscriptionEndsAt}
                  onManageSubscription={() => setActiveTab("settings")}
                />
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
