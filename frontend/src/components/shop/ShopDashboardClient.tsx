"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ThirdwebPayment from "../ThirdwebPayment";
import "@/styles/animations.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
import { useShopRegistration } from "@/hooks/useShopRegistration";
import { OnboardingModal } from "@/components/shop/OnboardingModal";
import { OperationalRequiredTab } from "@/components/shop/OperationalRequiredTab";
import { SubscriptionManagement } from "@/components/shop/SubscriptionManagement";
import { CoinsIcon } from 'lucide-react';

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
  const account = useActiveAccount();
  const searchParams = useSearchParams();
  const { existingApplication } = useShopRegistration();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [tierStats, setTierStats] = useState<TierBonusStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Purchase form state
  const [purchaseAmount, setPurchaseAmount] = useState<number>(0);
  const [purchasing, setPurchasing] = useState(false);

  // Payment flow state
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(
    null
  );
  const [showPayment, setShowPayment] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Onboarding modal state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

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

    // Handle Stripe payment success redirect (only if modal not already shown)
    if (payment === "success" && purchaseId && !showSuccessModal) {
      setSuccessMessage(
        `✅ Payment successful! Your RCN tokens have been added to your account.`
      );
      setShowSuccessModal(true);
      // Reload shop data to show updated balance
      if (account?.address) {
        loadShopData();
      }
    } else if (payment === "cancelled") {
      setError("Payment was cancelled. Please try again.");
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
        const authToken =
          localStorage.getItem("shopAuthToken") ||
          sessionStorage.getItem("shopAuthToken");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/shops/purchase-sync/pending`,
          {
            headers: {
              Authorization: authToken ? `Bearer ${authToken}` : "",
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // First, authenticate and get JWT token
      const authResponse = await fetch(`${apiUrl}/auth/shop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: account?.address }),
      });

      if (authResponse.ok) {
        const authResult = await authResponse.json();
        // Store token for future requests
        localStorage.setItem("shopAuthToken", authResult.token);
        sessionStorage.setItem("shopAuthToken", authResult.token);
        console.log("Shop authenticated successfully");
      } else if (authResponse.status === 403) {
        const errorData = await authResponse.json();
        setError(errorData.error || "Shop authentication failed");
        setLoading(false);
        return;
      } else {
        console.error("Shop auth failed:", authResponse.status);
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      // Get auth token for authenticated requests
      const authToken =
        localStorage.getItem("shopAuthToken") ||
        sessionStorage.getItem("shopAuthToken");

      // Load shop data with authentication
      const shopResponse = await fetch(
        `${apiUrl}/shops/wallet/${account?.address}`,
        {
          cache: "no-store",
          headers: {
            Authorization: authToken ? `Bearer ${authToken}` : "",
            "Content-Type": "application/json",
          },
        }
      );

      if (shopResponse.ok) {
        const shopResult = await shopResponse.json();
        if (shopResult.success && shopResult.data) {
          setShopData(shopResult.data);

          // Load purchase history
          if (shopResult.data.shopId) {
            const purchaseResponse = await fetch(
              `${apiUrl}/shops/purchase/history/${shopResult.data.shopId}`,
              {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );
            if (purchaseResponse.ok) {
              const purchaseResult = await purchaseResponse.json();
              setPurchases(purchaseResult.data.purchases || []);
            }

            // Load tier bonus stats
            const tierResponse = await fetch(
              `${apiUrl}/shops/tier-bonus/stats/${shopResult.data.shopId}`,
              {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );
            if (tierResponse.ok) {
              const tierResult = await tierResponse.json();
              setTierStats(tierResult.data);
            }
          }
        } else {
          setError("Invalid shop data received");
        }
      } else {
        const errorText = await shopResponse.text();
        console.error("Shop API error:", shopResponse.status, errorText);

        if (shopResponse.status === 404) {
          setError(
            `Shop not found for wallet ${account?.address}. ` +
              "Please check if your wallet is registered as a shop."
          );
        } else if (shopResponse.status === 401) {
          setError("Authentication failed. Please try refreshing the page.");
        } else {
          setError(
            `API Error (${shopResponse.status}): ${
              errorText || "Failed to load shop data"
            }`
          );
        }
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

        const authToken =
          localStorage.getItem("shopAuthToken") ||
          sessionStorage.getItem("shopAuthToken");
        console.log("Auth token found:", !!authToken);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/stripe-checkout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authToken ? `Bearer ${authToken}` : "",
            },
            body: JSON.stringify({
              amount: purchaseAmount,
            }),
          }
        );

        const responseData = await response.json();
        console.log("Stripe checkout response:", {
          status: response.status,
          data: responseData,
        });

        if (!response.ok) {
          const errorMessage =
            responseData.error ||
            `HTTP ${response.status}: ${response.statusText}`;
          console.error("Stripe checkout creation failed:", errorMessage);
          throw new Error(errorMessage);
        }

        const checkoutUrl = responseData.data?.checkoutUrl;
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

    // Show success message using custom modal
    setSuccessMessage(
      `✅ Payment successful! ${purchaseAmount} distribution credits have been added to your account.`
    );
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
      const authToken =
        localStorage.getItem("shopAuthToken") ||
        sessionStorage.getItem("shopAuthToken");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/purchase-sync/check-payment/${purchaseId}`,
        {
          method: "POST",
          headers: {
            Authorization: authToken ? `Bearer ${authToken}` : "",
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.success && result.data.status === "completed") {
        setSuccessMessage(
          `✅ Payment verified! ${result.data.amount} RCN has been added to your account.`
        );
        setShowSuccessModal(true);
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
              href="/shop/register"
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

          {/* Success Modal */}
          <Dialog open={true} onOpenChange={setShowSuccessModal}>
            <DialogContent 
              className="sm:max-w-lg md:max-w-xl w-full overflow-hidden"
              style={{
                backgroundImage: `url('/img/success-modal-bg.png')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {/* Animated Coins Background */}
              <div className="absolute inset-0 bottom-96 overflow-hidden pointer-events-none">
                {/* Create multiple coins with different animation delays */}
                {[...Array(22)].map((_, i) => {
                  const leftPosition = 10 + (i * 7) + Math.random() * 10;
                  const animationDelay = i * 0.3 + Math.random() * 0.5;
                  const animationDuration = 4 + Math.random() * 2;
                  
                  return (
                    <div
                      key={i}
                      className="absolute -bottom-12 opacity-0"
                      style={{
                        left: `${leftPosition}%`,
                        animation: `floatUp ${animationDuration}s ${animationDelay}s ease-in-out infinite`,
                      }}
                    >
                      <div 
                        className="w-12 h-12 md:w-16 md:h-16"
                        style={{
                          animation: `spin ${3}s linear infinite`,
                          filter: 'drop-shadow(0 0 10px #FFCC00)',
                        }}
                      >
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-full h-full"
                        >
                          <circle 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="#FFCC00" 
                            strokeWidth="2" 
                            fill="#FFCC00"
                          />
                          <circle 
                            cx="12" 
                            cy="12" 
                            r="8" 
                            stroke="#FFA500" 
                            strokeWidth="1" 
                            fill="none"
                            opacity="0.5"
                          />
                          <text 
                            x="12" 
                            y="16" 
                            textAnchor="middle" 
                            fill="#FFA500" 
                            fontSize="10" 
                            fontWeight="bold"
                          >
                            R
                          </text>
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="relative z-10 min-h-[500px] flex items-center justify-center p-8 md:p-12">
                <div className="w-full max-w-2xl mt-20">
                  <DialogHeader className="space-y-4">
                    <DialogTitle className="text-3xl md:text-2xl lg:text-3xl text-center text-[#FFCC00] font-bold drop-shadow-lg">
                      Payment Successful!
                    </DialogTitle>
                    <DialogDescription className="text-center text-base md:text-base pt-4 text-white drop-shadow-md mx-auto">
                      {successMessage || "Your RCN tokens have been successfully added to your account!"}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="mt-20 flex justify-center">
                    <Button
                      onClick={() => {
                        setShowSuccessModal(false);
                        // Clear the payment success params from URL
                        const url = new URL(window.location.href);
                        url.searchParams.delete("payment");
                        url.searchParams.delete("purchase_id");
                        window.history.replaceState({}, "", url);
                      }}
                      className="bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-gray-900 rounded-full px-12 py-4 text-base font-bold transform transition hover:scale-105 shadow-xl"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
