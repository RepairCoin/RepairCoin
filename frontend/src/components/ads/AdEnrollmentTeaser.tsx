"use client";

// Ads System — proactive opt-in teaser on the shop's MAIN dashboard (overview), so
// owners actually discover the ad program (the offer inside the Ads tab is too easy
// to miss). Matches narrative Chapter 2: "FixFlow shows Sarah an offer in her
// dashboard." Self-contained + dismissible. Only shows to shops that aren't already
// advertising and haven't requested yet. Gated by NEXT_PUBLIC_ADS_DASHBOARD_ENABLED.

import React, { useEffect, useState } from "react";
import { Megaphone, X, ArrowRight } from "lucide-react";
import { getMyEnrollment, listShopCampaigns } from "@/services/api/ads";

const dismissKey = (shopId: string) => `ads_teaser_dismissed_${shopId}`;

export const AdEnrollmentTeaser: React.FC<{ shopId: string; onGoToAds: () => void }> = ({ shopId, onGoToAds }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ADS_DASHBOARD_ENABLED !== "true") return;
    let cancelled = false;

    (async () => {
      // Respect a prior dismissal.
      try { if (localStorage.getItem(dismissKey(shopId)) === "1") return; } catch { /* no-op */ }

      // Only nudge shops that aren't already advertising and haven't requested yet.
      const [enrollment, campaigns] = await Promise.all([
        getMyEnrollment().catch(() => null),
        listShopCampaigns().catch(() => ({ items: [] as any[], total: 0 })),
      ]);
      if (cancelled) return;

      const alreadyEngaged = enrollment?.status === "pending" || enrollment?.status === "approved";
      const alreadyRunning = (campaigns.items?.length ?? 0) > 0;
      if (!alreadyEngaged && !alreadyRunning) setShow(true);
    })();

    return () => { cancelled = true; };
  }, [shopId]);

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(shopId), "1"); } catch { /* no-op */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#FFCC00]/40 bg-gradient-to-r from-[#FFCC00]/15 to-[#1A1A1A] p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-gray-400 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <div className="shrink-0 rounded-lg bg-[#FFCC00]/20 p-2.5">
          <Megaphone className="w-6 h-6 text-[#FFCC00]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">Want more customers? Let FixFlow run your ads.</h3>
          <p className="text-sm text-gray-300 mt-1 leading-relaxed">
            We handle Facebook &amp; Google, capture every customer who responds, and show you exactly what you got
            back — you just take the bookings.
          </p>
          <button
            onClick={onGoToAds}
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]"
          >
            Explore ads <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdEnrollmentTeaser;
