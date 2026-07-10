"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import apiClient from "@/services/api/client";

const DISMISS_KEY = "trialBannerDismissed";

/**
 * Persistent free-trial countdown shown across the shop dashboard (all tabs except
 * the subscription tab, where the full trial card already lives). Self-contained: it
 * fetches its own trial status so it doesn't depend on the shell's ShopData plumbing.
 * Renders nothing unless the shop is on an active DB-only trial.
 */
export function TrialBanner() {
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");

    let active = true;
    apiClient
      .get("/shops/subscription/status")
      .then((res) => {
        if (!active) return;
        const sub = res?.data?.currentSubscription;
        if (
          sub &&
          sub.subscriptionType === "trial" &&
          sub.status === "active"
        ) {
          setTrialEndsAt(sub.currentPeriodEnd || sub.nextPaymentDate || null);
        }
      })
      .catch(() => {
        /* non-blocking — banner just stays hidden */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!trialEndsAt) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Expired trials are handled server-side (shop reverts to unsubscribed); nothing to nudge.
  if (daysLeft <= 0) return null;

  const urgent = daysLeft <= 3;

  // Urgent (last 3 days) can't be dismissed — the shop is about to lose access.
  if (dismissed && !urgent) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div
      className={`mb-6 rounded-xl p-4 border-2 ${
        urgent
          ? "bg-red-900/20 border-red-500/50"
          : "bg-amber-900/20 border-amber-500/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <Clock
          className={`w-6 h-6 shrink-0 ${urgent ? "text-red-400" : "text-amber-400"}`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold ${urgent ? "text-red-300" : "text-amber-300"}`}
          >
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left in your free trial
          </p>
          <p className="text-gray-300 text-sm">
            Subscribe before {new Date(trialEndsAt).toLocaleDateString()} to keep
            issuing rewards without interruption.
          </p>
        </div>
        <Link href="/shop/subscription-form">
          <button className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold text-sm px-4 py-2 rounded-lg whitespace-nowrap transition-colors">
            Subscribe
          </button>
        </Link>
        {!urgent && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-white p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default TrialBanner;
