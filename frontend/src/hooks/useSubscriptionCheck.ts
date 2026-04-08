"use client";

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/api/client";

/**
 * Shop data returned from the subscription check
 */
export interface ShopSubscriptionData {
  shopId: string;
  subscriptionActive: boolean;
  operational_status?: string;
  purchasedRcnBalance?: number;
  subscriptionCancelledAt?: string | null;
  subscriptionEndsAt?: string | null;
}

/**
 * Return type for the useSubscriptionCheck hook
 */
export interface UseSubscriptionCheckReturn {
  /** Whether the subscription is active (or RCG qualified) */
  subscriptionActive: boolean;
  /** Whether the check is in progress */
  checking: boolean;
  /** Shop ID */
  shopId: string;
  /** Full shop data */
  shopData: ShopSubscriptionData | null;
  /** Shop's purchased RCN balance */
  shopRcnBalance: number;
  /** Refresh the subscription status */
  refresh: () => Promise<void>;
}

/**
 * Hook to check and manage shop subscription status
 * Extracts common subscription checking logic used across group components
 *
 * @param walletAddress - The wallet address to check subscription for
 * @param enabled - Whether the check should run (default: true)
 * @returns Subscription status and shop data
 */
export function useSubscriptionCheck(
  walletAddress: string | undefined,
  enabled = true,
  shopIdOverride?: string | undefined
): UseSubscriptionCheckReturn {
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [checking, setChecking] = useState(true);
  const [shopId, setShopId] = useState("");
  const [shopData, setShopData] = useState<ShopSubscriptionData | null>(null);
  const [shopRcnBalance, setShopRcnBalance] = useState(0);

  const checkSubscription = useCallback(async () => {
    if ((!walletAddress && !shopIdOverride) || !enabled) {
      setChecking(false);
      return;
    }

    try {
      setChecking(true);

      // Get shop data — prefer shopId (works for Google login), fallback to wallet address
      let result: {
        success: boolean;
        data?: {
          subscriptionActive?: boolean;
          shopId?: string;
          operational_status?: string;
          purchasedRcnBalance?: number;
        };
      } = { success: false };

      // Try shopId first (works for all login methods including Google)
      if (shopIdOverride) {
        try {
          result = await apiClient.get(`/shops/${shopIdOverride}`) as any;
        } catch {
          // shopId lookup failed, will try wallet below
        }
      }

      // Fallback to wallet address lookup
      if (!result.success && walletAddress) {
        try {
          result = await apiClient.get(`/shops/wallet/${walletAddress}`) as any;
        } catch {
          // Wallet lookup also failed
        }
      }

      // Last resort: subscription status endpoint (uses JWT shopId)
      if (!result.success) {
        try {
          const subResult = await apiClient.get("/shops/subscription/status") as any;
          if (subResult.success && subResult.data) {
            result = {
              success: true,
              data: {
                subscriptionActive: subResult.data.currentSubscription?.status === 'active',
                shopId: subResult.data.shopId,
                operational_status: subResult.data.currentSubscription ? 'subscription_qualified' : undefined,
              }
            };
          }
        } catch {
          // All lookups failed
        }
      }

      if (result.success && result.data) {
        // Check both subscriptionActive flag AND operational_status
        // operational_status can be 'subscription_qualified' or 'rcg_qualified'
        const isActive =
          result.data.subscriptionActive ||
          result.data.operational_status === "subscription_qualified" ||
          result.data.operational_status === "rcg_qualified";

        setSubscriptionActive(isActive);
        setShopId(result.data.shopId || "");
        setShopRcnBalance(result.data.purchasedRcnBalance || 0);

        // Enhance shopData with subscription details for accurate messaging
        let enhancedShopData: ShopSubscriptionData = {
          shopId: result.data.shopId || "",
          subscriptionActive: isActive,
          operational_status: result.data.operational_status,
          purchasedRcnBalance: result.data.purchasedRcnBalance,
        };

        try {
          const subResult = await apiClient.get("/shops/subscription/status") as {
            success: boolean;
            data?: {
              currentSubscription?: {
                cancelledAt?: string;
                cancelAtPeriodEnd?: boolean;
                currentPeriodEnd?: string;
                nextPaymentDate?: string;
                activatedAt?: string;
              };
            };
          };

          if (subResult.success && subResult.data?.currentSubscription) {
            const sub = subResult.data.currentSubscription;
            enhancedShopData = {
              ...enhancedShopData,
              subscriptionCancelledAt:
                sub.cancelledAt ||
                (sub.cancelAtPeriodEnd ? new Date().toISOString() : null),
              subscriptionEndsAt:
                sub.currentPeriodEnd || sub.nextPaymentDate || sub.activatedAt,
            };
          }
        } catch (subErr) {
          console.error("Error loading subscription details:", subErr);
        }

        setShopData(enhancedShopData);
      } else {
        setSubscriptionActive(false);
      }
    } catch (error: unknown) {
      // Silently handle errors - expected when shop doesn't exist or auth fails
      console.log(
        "Could not check subscription status:",
        error instanceof Error ? error.message : "Unknown error"
      );
      setSubscriptionActive(false);
    } finally {
      setChecking(false);
    }
  }, [walletAddress, enabled, shopIdOverride]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    subscriptionActive,
    checking,
    shopId,
    shopData,
    shopRcnBalance,
    refresh: checkSubscription,
  };
}
