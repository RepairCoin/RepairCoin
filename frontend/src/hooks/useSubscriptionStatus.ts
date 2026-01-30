/**
 * Subscription Status Hook
 *
 * Provides subscription status information for shops to determine if operations should be blocked.
 */

import { useMemo } from 'react';

interface ShopData {
  operational_status?: 'pending' | 'rcg_qualified' | 'subscription_qualified' | 'not_qualified' | 'paused';
  subscriptionActive?: boolean;
  subscriptionEndsAt?: string | null;
  subscriptionCancelledAt?: string | null;
  rcg_balance?: string | number;
  // Suspended shop fields
  active?: boolean;
  suspendedAt?: string | null;
  suspended_at?: string | null;
}

export interface SubscriptionStatus {
  isOperational: boolean;
  isPaused: boolean;
  isExpired: boolean;
  isCancelled: boolean;
  isSuspended: boolean;
  isRcgQualified: boolean;
  canPerformOperations: boolean;
  statusMessage: string | null;
  operationalStatus: string | null;
}

/**
 * Hook to determine subscription status and whether operations should be allowed
 *
 * @param shopData - Shop data object containing subscription and operational status
 * @returns SubscriptionStatus object with boolean flags and status message
 */
export function useSubscriptionStatus(shopData?: ShopData | null): SubscriptionStatus {
  return useMemo(() => {
    if (!shopData) {
      return {
        isOperational: false,
        isPaused: false,
        isExpired: false,
        isCancelled: false,
        isSuspended: false,
        isRcgQualified: false,
        canPerformOperations: false,
        statusMessage: 'Loading shop data...',
        operationalStatus: null
      };
    }

    // Check if shop is suspended (shop-level block)
    const isSuspended = shopData.active === false || !!(shopData.suspendedAt || shopData.suspended_at);

    const isPaused = shopData.operational_status === 'paused';
    const isNotQualified = shopData.operational_status === 'not_qualified';
    const isPending = shopData.operational_status === 'pending';

    const isCancelled = !!shopData.subscriptionCancelledAt;
    // Only consider expired if operational_status is NOT already qualified
    // The backend validates operational_status on every fetch, so it's the source of truth
    const subscriptionEndedByDate = shopData.subscriptionEndsAt
      ? new Date(shopData.subscriptionEndsAt) < new Date()
      : false;
    const isExpired = subscriptionEndedByDate &&
      shopData.operational_status !== 'subscription_qualified' &&
      shopData.operational_status !== 'rcg_qualified';

    // Check RCG qualification (10K+ tokens bypass subscription)
    const rcgBalance = typeof shopData.rcg_balance === 'string'
      ? parseFloat(shopData.rcg_balance)
      : (shopData.rcg_balance || 0);
    const isRcgQualified = shopData.operational_status === 'rcg_qualified' || rcgBalance >= 10000;

    const isOperational =
      shopData.operational_status === 'rcg_qualified' ||
      shopData.operational_status === 'subscription_qualified';

    // Can perform operations if:
    // 1. NOT suspended (suspended blocks everything, even RCG qualified)
    // 2. AND (RCG qualified OR has active subscription and not paused/expired)
    const canPerformOperations = !isSuspended && (isRcgQualified || (isOperational && !isExpired && !isPaused));

    let statusMessage: string | null = null;
    if (isSuspended) {
      statusMessage = 'Your shop account has been suspended by the administrator. Please contact support or submit an unsuspend request.';
    } else if (isPaused) {
      statusMessage = 'Your subscription is paused by the administrator. Operations are temporarily disabled until the subscription is resumed.';
    } else if (isExpired) {
      statusMessage = 'Your subscription has expired. Please renew your subscription to continue operations.';
    } else if (isNotQualified) {
      statusMessage = 'An active RepairCoin subscription or RCG qualification (10K+ tokens) is required to perform operations.';
    } else if (isPending) {
      statusMessage = 'Please complete your subscription setup to access this feature.';
    } else if (isCancelled && !isExpired) {
      // Cancelled but still in billing period - allow operations with warning
      const endsAt = shopData.subscriptionEndsAt ? new Date(shopData.subscriptionEndsAt) : null;
      if (endsAt) {
        const daysRemaining = Math.floor((endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        statusMessage = `Your subscription is cancelled and will expire in ${daysRemaining} days. You can still perform operations until then.`;
      }
    }

    return {
      isOperational,
      isPaused,
      isExpired,
      isCancelled,
      isSuspended,
      isRcgQualified,
      canPerformOperations,
      statusMessage,
      operationalStatus: shopData.operational_status || null
    };
  }, [shopData]);
}
