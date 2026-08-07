/**
 * Subscription Status Hook
 *
 * Provides subscription status information for shops to determine if operations should be blocked.
 */

import { useMemo } from 'react';
import { isQualifiedStatus, type OperationalStatus } from '@/utils/operationalStatus';

interface ShopData {
  operational_status?: OperationalStatus;
  subscriptionActive?: boolean;
  subscriptionEndsAt?: string | null;
  subscriptionCancelledAt?: string | null;
  rcg_balance?: string | number;
  // Suspended shop fields
  active?: boolean;
  verified?: boolean;
  suspendedAt?: string | null;
  suspended_at?: string | null;
}

export interface SubscriptionStatus {
  isOperational: boolean;
  isPaused: boolean;
  isPending: boolean;
  isExpired: boolean;
  isCancelled: boolean;
  isSuspended: boolean;
  isRcgQualified: boolean;
  canPerformOperations: boolean;
  /**
   * True when the shop has no active subscription but is otherwise in good
   * standing (verified, not suspended, not admin-paused). This is the free
   * tier — a normal state, NOT a block. Free shops keep marketplace presence
   * and can manage services; only the token economy (rewards, redemptions, RCN
   * purchase) stays behind `canPerformOperations`.
   */
  isFreeTier: boolean;
  /**
   * True when the shop is allowed to run its storefront — manage services, take
   * bookings, use messaging. Free tier included; only hard blocks (suspended,
   * pending verification, admin-paused) turn this off. Distinct from
   * `canPerformOperations`, which remains the paid-only token-economy gate.
   */
  canManageStorefront: boolean;
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
        isPending: false,
        isExpired: false,
        isCancelled: false,
        isSuspended: false,
        isRcgQualified: false,
        canPerformOperations: false,
        isFreeTier: false,
        canManageStorefront: false,
        statusMessage: 'Loading shop data...',
        operationalStatus: null
      };
    }

    // Check if shop is pending approval (new shops: not verified, no suspension)
    // A pending shop has either operational_status === 'pending' OR is simply unverified without suspension
    const hasSuspension = !!(shopData.suspendedAt || shopData.suspended_at);
    const isPending = shopData.operational_status === 'pending' || (shopData.verified === false && !hasSuspension);

    // Check if shop is suspended (shop-level block)
    // Only suspended if there's an actual suspension record — NOT just active === false (which pending shops also have)
    const isSuspended = !isPending && (hasSuspension || (shopData.active === false && shopData.verified !== false));

    const isPaused = shopData.operational_status === 'paused';
    const isNotQualified = shopData.operational_status === 'not_qualified';

    const isCancelled = !!shopData.subscriptionCancelledAt;
    // Check if subscription period has ended based on the actual end date
    // This catches stale operational_status when Stripe webhook fails after self-cancel
    const subscriptionEndedByDate = shopData.subscriptionEndsAt
      ? new Date(shopData.subscriptionEndsAt) < new Date()
      : false;
    // Expired if period ended — RCG qualified shops bypass, but subscription_qualified
    // must NOT bypass because operational_status can be stale after a missed webhook
    const isExpired = subscriptionEndedByDate &&
      shopData.operational_status !== 'rcg_qualified';

    // Check RCG qualification (10K+ tokens bypass subscription)
    const rcgBalance = typeof shopData.rcg_balance === 'string'
      ? parseFloat(shopData.rcg_balance)
      : (shopData.rcg_balance || 0);
    const isRcgQualified = shopData.operational_status === 'rcg_qualified' || rcgBalance >= 10000;

    const isOperational = isQualifiedStatus(shopData.operational_status);

    // Can perform operations if:
    // 1. NOT suspended (suspended blocks everything, even RCG qualified)
    // 2. NOT pending verification (an unverified shop cannot operate even if it
    //    has subscribed or is RCG qualified — verification gates everything)
    // 3. AND (RCG qualified OR has active subscription and not paused/expired)
    const canPerformOperations = !isSuspended && !isPending && (isRcgQualified || (isOperational && !isExpired && !isPaused));

    // Hard blocks — nothing works in any of these states.
    const isHardBlocked = isSuspended || isPending || isPaused;

    // Free tier: in good standing but with no active paid subscription (and not
    // RCG-qualified, which is its own full-access path). This is a normal state,
    // not a block — it must not trigger the suspended/expired UI.
    const isFreeTier = !isHardBlocked && !isRcgQualified && !isOperational;

    // Storefront (services, bookings, messaging) is available to any shop that
    // isn't hard-blocked — free tier included. Token-economy operations remain
    // behind canPerformOperations.
    const canManageStorefront = !isHardBlocked;

    let statusMessage: string | null = null;
    if (isSuspended) {
      statusMessage = 'Your shop account has been suspended by the administrator. Please contact support or submit an unsuspend request.';
    } else if (isPending) {
      statusMessage = 'Your shop application is awaiting admin approval. You cannot perform operational actions until approved.';
    } else if (isPaused) {
      statusMessage = 'Your subscription is paused by the administrator. Operations are temporarily disabled until the subscription is resumed.';
    } else if (isExpired) {
      statusMessage = 'Your subscription has expired. Please renew your subscription to continue operations.';
    } else if (isNotQualified) {
      statusMessage = 'An active FixFlow subscription is required to perform operations.';
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
      isPending,
      isExpired,
      isCancelled,
      isSuspended,
      isRcgQualified,
      canPerformOperations,
      isFreeTier,
      canManageStorefront,
      statusMessage,
      operationalStatus: shopData.operational_status || null
    };
  }, [shopData]);
}
