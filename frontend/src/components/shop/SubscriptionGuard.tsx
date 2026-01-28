"use client";

/**
 * SubscriptionGuard Component
 *
 * A reusable component that blocks UI interactions when subscription is paused/expired/cancelled.
 * Can be used in two ways:
 *
 * 1. As a wrapper with overlay:
 *    <SubscriptionGuard shopData={shopData}>
 *      <YourContent />
 *    </SubscriptionGuard>
 *
 * 2. Using the hook directly for custom logic:
 *    const { canPerformOperations, showBlockedToast } = useSubscriptionGuard(shopData);
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { useSubscriptionStatus, SubscriptionStatus } from "@/hooks/useSubscriptionStatus";

// Re-export the hook for convenience
export { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
export type { SubscriptionStatus } from "@/hooks/useSubscriptionStatus";

interface ShopData {
  operational_status?: 'pending' | 'rcg_qualified' | 'subscription_qualified' | 'not_qualified' | 'paused';
  subscriptionActive?: boolean;
  subscriptionEndsAt?: string | null;
  subscriptionCancelledAt?: string | null;
  rcg_balance?: string | number;
}

interface SubscriptionGuardProps {
  shopData?: ShopData | null;
  children: React.ReactNode;
  /** Show overlay when blocked (default: true) */
  showOverlay?: boolean;
  /** Custom message to show when blocked */
  customMessage?: string;
  /** Render function for custom blocked UI */
  renderBlocked?: (status: SubscriptionStatus) => React.ReactNode;
}

/**
 * Hook to get subscription guard utilities
 */
export function useSubscriptionGuard(shopData?: ShopData | null) {
  const status = useSubscriptionStatus(shopData);

  const showBlockedToast = (customMessage?: string) => {
    const message = customMessage || status.statusMessage || "Operations are blocked due to subscription status";
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      icon: '🚫',
    });
  };

  const guardAction = <T extends (...args: any[]) => any>(
    action: T,
    customMessage?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      if (!status.canPerformOperations) {
        showBlockedToast(customMessage);
        return;
      }
      return action(...args);
    }) as T;
  };

  return {
    ...status,
    showBlockedToast,
    guardAction,
  };
}

/**
 * Blocked Overlay Component
 */
const BlockedOverlay: React.FC<{
  status: SubscriptionStatus;
  customMessage?: string;
}> = ({ status, customMessage }) => {
  const getTitle = () => {
    if (status.isPaused) return "Subscription Paused";
    if (status.isExpired) return "Subscription Expired";
    if (status.isCancelled) return "Subscription Cancelled";
    return "Subscription Required";
  };

  const getMessage = () => {
    if (customMessage) return customMessage;
    return status.statusMessage || "You cannot perform this operation with your current subscription status.";
  };

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
      <div className="text-center p-6 max-w-md">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          status.isPaused ? 'bg-orange-500/20' : 'bg-red-500/20'
        }`}>
          <AlertTriangle className={`w-8 h-8 ${
            status.isPaused ? 'text-orange-400' : 'text-red-400'
          }`} />
        </div>
        <h3 className={`text-lg font-bold mb-2 ${
          status.isPaused ? 'text-orange-400' : 'text-red-400'
        }`}>
          {getTitle()}
        </h3>
        <p className="text-gray-300 text-sm">
          {getMessage()}
        </p>
      </div>
    </div>
  );
};

/**
 * Warning Banner Component (can be used standalone)
 */
export const SubscriptionWarningBanner: React.FC<{
  status: SubscriptionStatus;
  className?: string;
}> = ({ status, className = "" }) => {
  if (status.canPerformOperations || !status.statusMessage) {
    return null;
  }

  return (
    <div className={`border-2 rounded-xl p-4 ${
      status.isPaused
        ? 'bg-orange-900/20 border-orange-500/50'
        : 'bg-red-900/20 border-red-500/50'
    } ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          status.isPaused ? 'text-orange-400' : 'text-red-400'
        }`} />
        <div className="flex-1">
          <h4 className={`font-semibold ${
            status.isPaused ? 'text-orange-400' : 'text-red-400'
          }`}>
            {status.isPaused ? 'Subscription Paused' :
             status.isExpired ? 'Subscription Expired' :
             'Subscription Required'}
          </h4>
          <p className="text-gray-300 text-sm mt-1">
            {status.statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Main SubscriptionGuard Component
 *
 * Wraps content and shows an overlay when subscription is blocked
 */
export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  shopData,
  children,
  showOverlay = true,
  customMessage,
  renderBlocked,
}) => {
  const status = useSubscriptionStatus(shopData);

  if (!status.canPerformOperations && showOverlay) {
    return (
      <div className="relative">
        {children}
        {renderBlocked ? (
          renderBlocked(status)
        ) : (
          <BlockedOverlay status={status} customMessage={customMessage} />
        )}
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Disabled Input Wrapper
 *
 * Wraps form inputs to disable them when subscription is blocked
 */
export const GuardedInput: React.FC<{
  shopData?: ShopData | null;
  children: React.ReactElement;
  showToastOnClick?: boolean;
}> = ({ shopData, children, showToastOnClick = true }) => {
  const { canPerformOperations, showBlockedToast } = useSubscriptionGuard(shopData);

  if (canPerformOperations) {
    return children;
  }

  // Clone the child element and add disabled prop
  return React.cloneElement(children, {
    disabled: true,
    className: `${children.props.className || ''} opacity-50 cursor-not-allowed`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (showToastOnClick) {
        showBlockedToast();
      }
    },
  });
};

/**
 * Guarded Button Component
 *
 * A button that automatically disables when subscription is blocked
 */
export const GuardedButton: React.FC<{
  shopData?: ShopData | null;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  disabledClassName?: string;
  type?: "button" | "submit" | "reset";
}> = ({
  shopData,
  onClick,
  children,
  className = "",
  activeClassName = "bg-[#FFCC00] text-black hover:bg-[#FFD700]",
  disabledClassName = "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50",
  type = "button",
}) => {
  const { canPerformOperations, showBlockedToast } = useSubscriptionGuard(shopData);

  const handleClick = () => {
    if (!canPerformOperations) {
      showBlockedToast();
      return;
    }
    onClick?.();
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={!canPerformOperations}
      className={`${className} ${canPerformOperations ? activeClassName : disabledClassName}`}
    >
      {children}
    </button>
  );
};

export default SubscriptionGuard;
