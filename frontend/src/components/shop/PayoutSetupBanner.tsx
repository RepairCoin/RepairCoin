"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, X } from "lucide-react";
import apiClient from "@/services/api/client";

const DISMISS_KEY = "payoutBannerDismissed";

/**
 * Dashboard nudge to finish Stripe payout onboarding. Self-contained like TrialBanner:
 * fetches its own DB-only status (/shops/connect/summary — no Stripe call) and renders
 * nothing once charges are enabled. The button links to the payout onboarding pages.
 */
export function PayoutSetupBanner() {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");

    let active = true;
    apiClient
      .get("/shops/connect/summary")
      .then((res) => {
        if (!active) return;
        // Show until charges are enabled — covers both "never started" and "mid-onboarding".
        // apiClient unwraps to the response body: { success, data: { chargesEnabled } }.
        setNeedsSetup(res?.data?.chargesEnabled !== true);
      })
      .catch(() => {
        /* non-blocking — banner just stays hidden */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!needsSetup || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-xl border-2 border-[#FFCC00]/50 bg-[#FFCC00]/10 p-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 shrink-0 text-[#FFCC00]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#FFCC00]">
            Set up payouts to start receiving payments
          </p>
          <p className="text-sm text-gray-300">
            Connect your Stripe account so customer payments can settle to your
            shop.
          </p>
        </div>
        <Link href="/register/shop/payouts">
          <button className="whitespace-nowrap rounded-lg bg-[#FFCC00] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#FFD700]">
            Set Up Payouts
          </button>
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 text-gray-400 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default PayoutSetupBanner;
