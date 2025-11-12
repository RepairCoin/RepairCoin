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
import { GroupsTab } from "@/components/shop/tabs/GroupsTab";
import { useShopRegistration } from "@/hooks/useShopRegistration";
import { OnboardingModal } from "@/components/shop/OnboardingModal";
import { OperationalRequiredTab } from "@/components/shop/OperationalRequiredTab";
import { SubscriptionManagement } from "@/components/shop/SubscriptionManagement";
import { CoinsIcon } from 'lucide-react';
import SuccessModal from "@/components/modals/SuccessModal";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
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
    | "not_qualified";
  rcg_tier?: string;
  rcg_balance?: number;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  website?: string;
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
  const { isAuthenticated, userType } = useAuthStore();
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

  // Client-side auth protection (since middleware is disabled for cross-domain)
  useEffect(() => {
    // If not authenticated or not a shop, redirect to landing page
    if (!isAuthenticated || (userType && userType !== 'shop')) {
      console.log('[ShopDashboard] Unauthorized access, redirecting to home');
      router.push('/');
    }
  }, [isAuthenticated, userType, router]);

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
    }
  }, [searchParams, account?.address]);

  useEffect(() => {
    if (account?.address) {
      loadShopData();
    }
  }, [account?.address]);

  // Check if shop is operational
  // If operational_status is not available (legacy), assume operational if shop is active and verified
  const isOperational =
    shopData &&
    (shopData.operational_status === "rcg_qualified" ||
      shopData.operational_status === "subscription_qualified" ||
      // Fallback: If operational_status is missing but shop is active and verified, assume operational
      (!shopData.operational_status && shopData.active && shopData.verified));

  // Show onboarding modal when shop data loads and shop is not operational
  // Don't show if we're on the settings tab
  useEffect(() => {
    if (shopData && !isOperational && activeTab !== "settings") {
      setShowOnboardingModal(true);
    } else {
      setShowOnboardingModal(false);
    }
  }, [shopData, isOperational]);

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
        console.log("shopResultshopResultshopResult: ", shopResult)
        console.log("=".repeat(60));
        console.log("🏪 SHOP DATA (Shop POV):");
        console.log("=".repeat(60));
        console.log("Shop ID:", shopResult.data.shopId);
        console.log("Shop Name:", shopResult.data.name);
        console.log("Category:", shopResult.data.category || "Not set");
        console.log("Verified:", shopResult.data.verified);
        console.log("Active:", shopResult.data.active);
        console.log("RCG Balance:", shopResult.data.rcg_balance);
        console.log("RCG Tier:", shopResult.data.rcg_tier);
        console.log("Operational Status:", shopResult.data.operational_status);
        console.log("=".repeat(60));
        console.log("Full Shop Object:", shopResult.data);
        console.log("=".repeat(60));
        setShopData(shopResult.data);

        // Load purchase history
        if (shopResult.data.shopId) {
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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
      <div
        className="min-h-screen py-8 bg-[#0D0D0D]"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-screen-2xl w-[96%] mx-auto">
          {/* Onboarding Modal is rendered at the bottom of the component */}

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              shopData={shopData}
              purchases={purchases}
              onRefreshData={loadShopData}
              authToken={authToken ?? undefined}
            />
          )}

          {activeTab === "purchase" && (
            <PurchaseTab
              purchaseAmount={purchaseAmount}
              setPurchaseAmount={setPurchaseAmount}
              purchasing={purchasing}
              purchases={purchases}
              onInitiatePurchase={initiatePurchase}
              onCheckPurchaseStatus={checkPurchaseStatus}
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
            />
          )}

          {activeTab === "issue-rewards" && shopData && (
            <IssueRewardsTab
              shopId={shopData.shopId}
              shopData={shopData}
              onRewardIssued={loadShopData}
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

          {activeTab === "settings" && shopData && (
            <SettingsTab
              shopId={shopData.shopId}
              shopData={shopData}
              onSettingsUpdate={loadShopData}
            />
          )}

          {activeTab === "groups" && shopData && (
            <GroupsTab shopId={shopData.shopId} />
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
            <OnboardingModal
              shopData={shopData}
              open={showOnboardingModal}
              onClose={() => setShowOnboardingModal(false)}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
