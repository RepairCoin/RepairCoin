"use client";

import { useState, useEffect, useRef } from "react";
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
import { ToolsTab } from "@/components/shop/tabs/ToolsTab";
import { SettingsTab } from "@/components/shop/tabs/SettingsTab";
import { SupportTab } from "@/components/shop/tabs/SupportTab";
import { CustomersTab } from "@/components/shop/tabs/CustomersTab";
import { ShopLocationTab } from "@/components/shop/tabs/ShopLocationTab";
import { ShopBreadcrumb } from "@/components/shop/ShopBreadcrumb";
import { GroupsTab } from "@/components/shop/tabs/GroupsTab";
import { ServicesTab } from "@/components/shop/tabs/ServicesTab";
import { ShopServiceOrdersTab } from "@/components/shop/tabs/ShopServiceOrdersTab";
import { BookingsTabV2 } from "@/components/shop/bookings";
import { MarketingTab } from "@/components/shop/tabs/MarketingTab";
import { ServiceAnalyticsTab } from "@/components/shop/tabs/ServiceAnalyticsTab";
import { AppointmentsTab } from "@/components/shop/tabs/AppointmentsTab";
import { MessagesTab } from "@/components/shop/tabs/MessagesTab";
import { RescheduleRequestsTab } from "@/components/shop/tabs/RescheduleRequestsTab";
import { ProfileTab } from "@/components/shop/tabs/ProfileTab";
import ShopDisputePanel from "@/components/shop/ShopDisputePanel";
import { StakingTab } from "@/components/shop/tabs/StakingTab";
import { useShopRegistration } from "@/hooks/useShopRegistration";
import { OnboardingModal } from "@/components/shop/OnboardingModal";
import { SuspendedShopModal } from "@/components/shop/SuspendedShopModal";
import { CancelledSubscriptionModal } from "@/components/shop/CancelledSubscriptionModal";
import { SubscriptionGuard } from "@/components/shop/SubscriptionGuard";
import { OperationalRequiredTab } from "@/components/shop/OperationalRequiredTab";
import { SubscriptionManagement } from "@/components/shop/SubscriptionManagement";
import { CoinsIcon } from 'lucide-react';
import SuccessModal from "@/components/modals/SuccessModal";
import { PaymentWaitingModal } from "@/components/shop/modals/PaymentWaitingModal";
import { useNotificationStore } from "@/stores/notificationStore";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

// SessionStorage cache for shop data (survives page refresh)
const SHOP_DATA_CACHE_KEY = 'rc_shop_data_cache';
const SHOP_ID_CACHE_KEY = 'rc_shop_id';
const SHOP_DATA_CACHE_TTL_MS = 60000; // 1 minute cache TTL

interface CachedShopData {
  timestamp: number;
  shopId: string;
  data: ShopData;
}

// Shop ID cache - persists across page refreshes
function getShopIdFromCache(): string | null {
  try {
    return sessionStorage.getItem(SHOP_ID_CACHE_KEY);
  } catch { return null; }
}

function setShopIdCache(shopId: string): void {
  try {
    sessionStorage.setItem(SHOP_ID_CACHE_KEY, shopId);
    console.log('[ShopDashboard] 📦 Shop ID cached:', shopId);
  } catch {}
}

// Get cached shop data - now can work without shopId parameter
function getCachedShopData(shopId?: string): ShopData | null {
  try {
    const cached = sessionStorage.getItem(SHOP_DATA_CACHE_KEY);
    if (!cached) return null;

    const data: CachedShopData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    // Check if cache is not expired
    if (age > SHOP_DATA_CACHE_TTL_MS) {
      console.log('[ShopDashboard] 📦 Shop data cache expired (age: ' + age + 'ms)');
      sessionStorage.removeItem(SHOP_DATA_CACHE_KEY);
      return null;
    }

    // If shopId provided, verify it matches
    if (shopId && data.shopId !== shopId) {
      console.log('[ShopDashboard] 📦 Shop data cache mismatch');
      return null;
    }

    console.log('[ShopDashboard] 📦 Using cached shop data (age: ' + age + 'ms)');
    return data.data;
  } catch (e) {
    return null;
  }
}

function setCachedShopData(shopId: string, data: ShopData): void {
  try {
    const cacheData: CachedShopData = {
      timestamp: Date.now(),
      shopId,
      data
    };
    sessionStorage.setItem(SHOP_DATA_CACHE_KEY, JSON.stringify(cacheData));
    setShopIdCache(shopId); // Also cache the shopId separately
    console.log('[ShopDashboard] 📦 Shop data cached');
  } catch (e) {
    // Ignore errors
  }
}

function clearCachedShopData(): void {
  try {
    sessionStorage.removeItem(SHOP_DATA_CACHE_KEY);
    sessionStorage.removeItem(SHOP_ID_CACHE_KEY);
  } catch (e) {
    // Ignore errors
  }
}

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
  const { isAuthenticated, userType, isLoading: authLoading, authInitialized, userProfile } = useAuthStore();
  const { existingApplication } = useShopRegistration();

  // shopData starts null - loaded via useEffect to avoid SSR hydration mismatch
  const [shopData, setShopData] = useState<ShopData | null>(null);

  // Track if we've attempted to load from cache (client-side only)
  const [cacheChecked, setCacheChecked] = useState(false);

  // Prevent multiple concurrent background refreshes (thundering herd prevention)
  const backgroundRefreshInProgressRef = useRef(false);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [tierStats, setTierStats] = useState<TierBonusStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");
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

  // Delayed loading state - prevents flash when cache loads quickly
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  useEffect(() => {
    // Only show loading modal after 150ms delay if still not initialized
    // This gives cache check time to complete without showing the modal
    if (!authInitialized || authLoading) {
      const timer = setTimeout(() => {
        setShowLoadingModal(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setShowLoadingModal(false);
    }
  }, [authInitialized, authLoading]);

  // Cancelled subscription modal state
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    amount?: number;
    title?: string;
    subtitle?: string;
  }>({});

  // Payment waiting modal state
  const [showPaymentWaitingModal, setShowPaymentWaitingModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{
    purchaseId: string;
    amount: number;
    totalCost: number;
    checkoutUrl: string;
  } | null>(null);

  // Auth token managed via httpOnly cookies - no longer needed in state
  // Keeping state for backward compatibility during migration
  useEffect(() => {
    // Token now managed by cookies - this is deprecated
    setAuthToken(null);
  }, []);

  // Load from cache IMMEDIATELY on mount - runs only on client
  // This is useLayoutEffect to ensure it runs synchronously before paint
  useEffect(() => {
    if (cacheChecked) return;
    setCacheChecked(true);

    const cachedShopId = getShopIdFromCache();
    if (cachedShopId) {
      const cached = getCachedShopData(cachedShopId);
      if (cached) {
        console.log('[ShopDashboard] ⚡ Cache hit on mount');
        setShopData(cached);
      }
    }
  }, [cacheChecked]);

  // authInitialized is managed by useAuthInitializer hook in the auth store

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
    } else {
      // If no tab specified, set URL to default tab (profile)
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "profile");
      window.history.replaceState({}, "", url);
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
    // Load shop data when we have any identifier available
    // Priority: shopId from session > shopId from cache > wallet address
    const walletAddress = account?.address || userProfile?.address;
    const shopIdFromSession = userProfile?.shopId;
    const shopIdFromCache = getShopIdFromCache();
    const hasIdentifier = walletAddress || shopIdFromSession || shopIdFromCache;

    // Only load if we don't already have shop data (cache might have set it)
    if (hasIdentifier && !shopData) {
      console.log('[ShopDashboard] Triggering loadShopData:', {
        walletAddress,
        shopIdFromSession,
        shopIdFromCache,
        hasAccount: !!account,
        hasProfile: !!userProfile,
        hasShopData: !!shopData
      });
      loadShopData();
    }
  }, [account?.address, userProfile?.address, userProfile?.shopId, shopData]);

  // Listen for subscription-related notifications and refresh data
  const { notifications } = useNotificationStore();
  const lastProcessedNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if the latest notification is subscription-related
    const latestNotification = notifications[0];
    if (!latestNotification) return;

    // Skip if we've already processed this notification
    if (latestNotification.id === lastProcessedNotificationRef.current) return;

    const subscriptionNotificationTypes = [
      'subscription_cancelled',
      'subscription_self_cancelled',
      'subscription_paused',
      'subscription_resumed',
      'subscription_reactivated',
      'shop_suspended',
      'shop_unsuspended'
    ];

    if (subscriptionNotificationTypes.includes(latestNotification.notificationType)) {
      console.log('📋 Shop/Subscription notification received, refreshing shop data...', {
        type: latestNotification.notificationType,
        id: latestNotification.id
      });
      lastProcessedNotificationRef.current = latestNotification.id;
      // Add small delay to let modal animations complete and prevent flicker
      setTimeout(() => {
        // Refresh shop data to update the warning banner
        const walletAddress = account?.address || userProfile?.address;
        if (walletAddress) {
          loadShopData();
        }
      }, 500);
    }
  }, [notifications, account?.address, userProfile?.address]);

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
  // However, if subscription is cancelled but still within the billing period, shop should NOT be blocked
  const isBlocked = !!(isSuspended || isRejected || isPending || isPaused || (!isOperational && !isCancelledButActive));

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

  const loadShopData = async (forceRefresh = false) => {
    // Get shopId from multiple sources (priority order)
    const shopIdFromSession = userProfile?.shopId;
    const shopIdFromCache = getShopIdFromCache();
    const shopId = shopIdFromSession || shopIdFromCache;
    const walletAddress = account?.address || userProfile?.address;

    console.log('[ShopDashboard] loadShopData called:', { shopId, shopIdFromSession, shopIdFromCache, walletAddress, forceRefresh });

    // Try to use cached data first (instant load)
    if (!forceRefresh && shopId) {
      const cached = getCachedShopData(shopId);
      if (cached) {
        console.log('[ShopDashboard] ⚡ Cache hit in loadShopData');
        setShopData(cached);
        // Delay background refresh by 5 seconds to avoid thundering herd
        // when multiple tabs refresh simultaneously
        setTimeout(() => {
          refreshShopDataInBackground(shopId, walletAddress);
        }, 5000);
        return;
      }
    }

    // If we don't have any identifier yet, wait for auth to provide it
    if (!shopId && !walletAddress) {
      console.log('[ShopDashboard] No identifier available yet, waiting...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // NOTE: Authentication is now handled globally by useAuthInitializer
      // No need to call /auth/shop here - cookies are already set

      // Load shop data - prefer shopId (from session or cache) for faster lookup
      // Fall back to wallet address for backwards compatibility
      const shopEndpoint = shopId
        ? `/shops/${shopId}`
        : `/shops/wallet/${walletAddress}`;

      console.log('[ShopDashboard] Loading shop data from:', shopEndpoint, { shopIdFromSession, walletAddress });
      const shopResult = await apiClient.get(shopEndpoint);

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
        // Cache the shop data for rapid refresh resilience
        if (enhancedShopData.shopId) {
          setCachedShopData(enhancedShopData.shopId, enhancedShopData);
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

  // Background refresh - doesn't show loading spinner
  // Uses ref to prevent multiple concurrent refreshes (thundering herd prevention)
  const refreshShopDataInBackground = async (shopId: string, walletAddress?: string) => {
    // Prevent concurrent background refreshes
    if (backgroundRefreshInProgressRef.current) {
      console.log('[ShopDashboard] ⏭️ Background refresh already in progress, skipping');
      return;
    }

    backgroundRefreshInProgressRef.current = true;

    try {
      const shopEndpoint = shopId ? `/shops/${shopId}` : `/shops/wallet/${walletAddress}`;
      console.log('[ShopDashboard] 🔄 Background refresh from:', shopEndpoint);
      const shopResult = await apiClient.get(shopEndpoint);

      if (shopResult.success && shopResult.data) {
        let enhancedShopData = shopResult.data;

        // Load subscription details
        if (shopResult.data.shopId) {
          try {
            const subResult = await apiClient.get(`/shops/subscription/status`);
            if (subResult.success && subResult.data?.currentSubscription) {
              const sub = subResult.data.currentSubscription;
              const actualStatus = sub.cancelAtPeriodEnd ? 'cancelled' : sub.status;
              enhancedShopData = {
                ...enhancedShopData,
                subscriptionStatus: actualStatus,
                subscriptionCancelledAt: sub.cancelledAt || (sub.cancelAtPeriodEnd ? new Date().toISOString() : null),
                subscriptionEndsAt: sub.currentPeriodEnd || sub.nextPaymentDate || sub.activatedAt,
              };
            }
          } catch (subErr) {
            console.error("Error loading subscription details:", subErr);
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
        if (enhancedShopData.shopId) {
          setCachedShopData(enhancedShopData.shopId, enhancedShopData);
        }
      }
    } catch (err) {
      console.error("[ShopDashboard] Background refresh failed:", err);
      // Don't set error - we already have cached data showing
    } finally {
      backgroundRefreshInProgressRef.current = false;
    }
  };

  const initiatePurchase = async () => {
    // For suspended/rejected/paused shops, show the suspended modal instead of onboarding
    if (isSuspended || isRejected || isPaused) {
      setShowSuspendedModal(true);
      return;
    }

    if (!isOperational) {
      setShowOnboardingModal(true);
    } else {
      if (!shopData || !account?.address) {
        toast.error("Shop data not loaded or wallet not connected");
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

        const { checkoutUrl, purchaseId, amount, totalCost } = response.data || {};
        if (!checkoutUrl || !purchaseId) {
          throw new Error("Invalid response from server - missing checkout URL or purchase ID");
        }

        console.log("Showing payment waiting modal...");

        // Store pending purchase data and show waiting modal
        setPendingPurchase({
          purchaseId,
          amount: amount || purchaseAmount,
          totalCost: totalCost || (purchaseAmount * 0.10),
          checkoutUrl,
        });
        setShowPaymentWaitingModal(true);
      } catch (err) {
        console.error("Error initiating purchase:", err);
        toast.error(
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
    toast.error(`Payment failed: ${error}`);
  };

  const cancelPayment = () => {
    setShowPayment(false);
    setCurrentPurchaseId(null);
  };

  // Payment waiting modal handlers
  const handlePaymentWaitingSuccess = async (purchaseId: string, amount: number) => {
    setShowPaymentWaitingModal(false);
    setPendingPurchase(null);

    // Show success modal with celebration
    setSuccessModalData({
      title: "Payment Successful!",
      subtitle: `${amount.toLocaleString()} RCN tokens have been added to your account.`,
      amount: amount,
    });
    setShowSuccessModal(true);

    // Reload shop data to update balance
    await loadShopData();
  };

  const handlePaymentWaitingError = (error: string) => {
    setShowPaymentWaitingModal(false);
    setPendingPurchase(null);
    toast.error(error, { duration: 5000 });
  };

  const handlePaymentWaitingClose = () => {
    setShowPaymentWaitingModal(false);
    setPendingPurchase(null);
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
        toast.error(
          `Payment status: ${result.data.stripeStatus}. Please wait a moment and try again.`
        );
      } else {
        toast.error(result.message || "Could not verify payment status");
      }
    } catch (error) {
      console.error("Error checking purchase status:", error);
      toast.error("Failed to check payment status");
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

  // NEVER return null or blank screen - always render something visible
  const isInitializing = !authInitialized || authLoading;

  // During initialization with no cached data, show a loading state
  // This prevents white screen while auth is being verified
  if (isInitializing && !shopData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22]">
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
                      {Math.floor((new Date(shopData?.subscriptionEndsAt!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Breadcrumb Navigation */}
          <ShopBreadcrumb activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Loading state for tabs that require shopData */}
          {!shopData && activeTab !== "overview" && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
                <p className="text-gray-400">Loading dashboard data...</p>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              shopData={shopData}
              purchases={purchases}
              onRefreshData={loadShopData}
              authToken={authToken ?? undefined}
              loading={loading}
              error={error}
            />
          )}

          {activeTab === "services" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <ServicesTab shopId={shopData.shopId} shopData={shopData} />
            </SubscriptionGuard>
          )}

          {activeTab === "bookings" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <BookingsTabV2
                shopId={shopData.shopId}
                isBlocked={isBlocked}
                blockReason={getBlockReason()}
              />
            </SubscriptionGuard>
          )}

          {activeTab === "service-analytics" && shopData && (
            <ServiceAnalyticsTab />
          )}

          {activeTab === "appointments" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <AppointmentsTab />
            </SubscriptionGuard>
          )}

          {activeTab === "disputes" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <ShopDisputePanel shopId={shopData.shopId} />
            </SubscriptionGuard>
          )}
          {activeTab === "messages" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <MessagesTab shopId={shopData.shopId} />
            </SubscriptionGuard>
          )}

          {/* Reschedules tab is now a sub-tab inside Appointments */}
          {activeTab === "reschedules" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <AppointmentsTab defaultSubTab="reschedules" />
            </SubscriptionGuard>
          )}

          {activeTab === "purchase" && shopData && (
            <SubscriptionGuard shopData={shopData}>
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
            </SubscriptionGuard>
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

          {activeTab === "tools" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <ToolsTab
                shopId={shopData.shopId}
                shopData={shopData}
                onRewardIssued={loadShopData}
                onRedemptionComplete={loadShopData}
                isOperational={isOperational}
                isBlocked={isBlocked}
                blockReason={getBlockReason()}
                setShowOnboardingModal={setShowOnboardingModal}
              />
            </SubscriptionGuard>
          )}

          {activeTab === "customers" && shopData && (
            <CustomersTab shopId={shopData.shopId} />
          )}

          {activeTab === "shop-location" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <ShopLocationTab
                shopId={shopData.shopId}
                shopData={shopData}
                onLocationUpdate={loadShopData}
              />
            </SubscriptionGuard>
          )}

          {activeTab === "subscription" && shopData && (
            <SubscriptionManagement
              shopId={shopData.shopId}
              isSuspended={!!isSuspended}
              isPaused={!!isPaused}
            />
          )}

          {activeTab === "marketing" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <MarketingTab shopId={shopData.shopId} shopName={shopData.name} />
            </SubscriptionGuard>
          )}

          {activeTab === "profile" && shopData && (
            <ProfileTab
              shopId={shopData.shopId}
              shopData={shopData}
              onUpdate={loadShopData}
            />
          )}

          {activeTab === "settings" && shopData && (
            <SettingsTab
              shopId={shopData.shopId}
              shopData={shopData}
              onSettingsUpdate={loadShopData}
              isSuspended={!!isSuspended}
              isPaused={!!isPaused}
            />
          )}

          {/* Support Tab */}
          {activeTab === "support" && shopData && (
            <SupportTab />
          )}

          {activeTab === "staking" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <StakingTab />
            </SubscriptionGuard>
          )}

          {activeTab === "groups" && shopData && (
            <SubscriptionGuard shopData={shopData}>
              <GroupsTab
                shopId={shopData.shopId}
                subscriptionActive={isOperational || isCancelledButActive || false}
              />
            </SubscriptionGuard>
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
            onClose={async () => {
              setShowSuccessModal(false);
              // Clear the payment success params from URL
              const url = new URL(window.location.href);
              url.searchParams.delete("payment");
              url.searchParams.delete("purchase_id");
              window.history.replaceState({}, "", url);
              // Refresh purchases list to show the new purchase
              await loadShopData();
            }}
            title={successModalData.title}
            subtitle={successModalData.subtitle}
            amount={successModalData.amount}
            currency="RCN"
            showCoinsAnimation={true}
          />

          {/* Payment Waiting Modal - For RCN purchases */}
          {showPaymentWaitingModal && pendingPurchase && (
            <PaymentWaitingModal
              isOpen={showPaymentWaitingModal}
              onClose={handlePaymentWaitingClose}
              purchaseId={pendingPurchase.purchaseId}
              amount={pendingPurchase.amount}
              totalCost={pendingPurchase.totalCost}
              checkoutUrl={pendingPurchase.checkoutUrl}
              onSuccess={handlePaymentWaitingSuccess}
              onError={handlePaymentWaitingError}
            />
          )}

          {/* Onboarding Modal */}
          {shopData && (
            <>
              <OnboardingModal
                shopData={shopData}
                open={showOnboardingModal && !isSuspended && !isRejected && !isPaused}
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

              {/* Cancelled Subscription Modal - Don't show for suspended/paused shops */}
              {isCancelledButActive && shopData?.subscriptionEndsAt && !isSuspended && !isPaused && (
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
