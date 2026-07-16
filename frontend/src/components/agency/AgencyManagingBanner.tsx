"use client";

import React, { useEffect, useState } from "react";
import { Building2, LogOut, Loader2 } from "lucide-react";
import { agencyApi } from "@/services/api/agency";
import { clearAllAuthCaches } from "@/hooks/useAuthInitializer";

/**
 * Shown at the top of the shop dashboard when an agency is acting as one of its client shops
 * (the session is a shop token carrying a managing agencyId). Lets them return to the agency.
 * Renders nothing for normal shop sessions.
 */
export function AgencyManagingBanner() {
  const [acting, setActing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let active = true;
    agencyApi
      .getContext()
      .then((res: any) => {
        if (!active) return;
        const data = res?.data;
        if (data?.actingAsAgencyClient) {
          setActing(true);
          setShopId(data.shopId ?? null);
        }
      })
      .catch(() => {
        /* not an agency session — ignore */
      });
    return () => {
      active = false;
    };
  }, []);

  const exit = async () => {
    setExiting(true);
    try {
      await agencyApi.resume();
      // Session cookie now points back at the owner shop — clear caches and fully navigate so auth
      // re-hydrates as the owner and the agency tab loads.
      clearAllAuthCaches();
      window.location.href = "/shop?tab=agency";
    } catch {
      setExiting(false);
    }
  };

  if (!acting) return null;

  return (
    <div className="w-full bg-[#FFCC00] text-black px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="w-4 h-4" />
        <span>You're managing a client shop{shopId ? ` (${shopId})` : ""} as its agency.</span>
      </div>
      <button
        onClick={exit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 text-white text-sm font-medium hover:bg-black transition-colors disabled:opacity-50"
      >
        {exiting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Exit to agency
      </button>
    </div>
  );
}

export default AgencyManagingBanner;
