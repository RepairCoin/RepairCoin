"use client";

import React, { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import apiClient from "@/services/api/client";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

interface StripeConnectGuardProps {
  children: React.ReactNode;
  /** What the shop is being blocked from — used in the prompt copy. */
  feature?: string;
  /**
   * Shop data, so this guard can defer to the subscription overlay. When the shop's
   * subscription is blocking, that overlay already covers the tab — showing this one on
   * top of it double-stacks the two prompts. Subscription is the more fundamental gate,
   * so it wins.
   */
  shopData?: Parameters<typeof useSubscriptionStatus>[0];
}

/**
 * Hard-locks booking-related surfaces (bookings management, service creation) until the
 * shop has completed Stripe payout onboarding. Mirrors SubscriptionGuard's overlay pattern.
 *
 * Self-contained: reads the DB-only /shops/connect/summary (same source as the dashboard
 * PayoutSetupBanner). The backend enforces the same rule server-side (403 STRIPE_NOT_CONNECTED),
 * so this is the UX layer, not the security boundary — on a fetch error we fail open and let
 * the server be the authority.
 */
export const StripeConnectGuard: React.FC<StripeConnectGuardProps> = ({
  children,
  feature = "bookings",
  shopData,
}) => {
  const router = useRouter();
  const subscription = useSubscriptionStatus(shopData);
  const [state, setState] = useState<"loading" | "connected" | "blocked">(
    "loading"
  );

  useEffect(() => {
    let active = true;
    apiClient
      .get("/shops/connect/summary")
      .then((res) => {
        if (!active) return;
        // apiClient unwraps to the response body: { success, data: { chargesEnabled } }.
        setState(
          res?.data?.chargesEnabled === true ? "connected" : "blocked"
        );
      })
      .catch(() => {
        // Fail open — the server still enforces STRIPE_NOT_CONNECTED.
        if (active) setState("connected");
      });
    return () => {
      active = false;
    };
  }, []);

  // Defer to the subscription overlay when it's already blocking — otherwise the two
  // absolute overlays stack and overflow into each other.
  if (state === "blocked" && subscription.canPerformOperations) {
    return (
      <div className="relative min-h-[420px]">
        {children}
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFCC00]/20 sm:mb-4 sm:h-16 sm:w-16">
              <CreditCard className="h-6 w-6 text-[#FFCC00] sm:h-8 sm:w-8" />
            </div>
            <h3 className="mb-2 text-base font-bold text-[#FFCC00] sm:text-lg">
              Connect Stripe to enable {feature}
            </h3>
            <p className="text-xs text-gray-300 sm:text-sm">
              Set up your payouts so customer payments can settle to your shop.
              You can create services and accept bookings once Stripe is
              connected.
            </p>
            <button
              onClick={() => router.push("/register/shop/payouts")}
              className="mt-3 rounded-lg bg-[#FFCC00] px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-[#E5BB00] sm:mt-4 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Set Up Payouts
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default StripeConnectGuard;
