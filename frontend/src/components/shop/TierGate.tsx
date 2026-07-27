"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TIER_LABELS, getRequiredTier } from "@/config/featureTiers";

interface TierGateProps {
  feature: string;
  children: React.ReactNode;
  /** Render instead of the default overlay when access is denied. */
  fallback?: React.ReactNode;
  minHeight?: string;
}

// Replaces the feature with an upgrade panel when the shop's tier is too low.
// The locked child is not mounted, so it never fires its (server-gated) requests.
export function TierGate({ feature, children, fallback, minHeight = "600px" }: TierGateProps) {
  const { can, loading } = useFeatureAccess();
  const router = useRouter();

  if (can(feature)) return <>{children}</>;
  if (loading) return <div style={{ minHeight }} />;
  if (fallback !== undefined) return <>{fallback}</>;

  const requiredTier = getRequiredTier(feature);
  const planLabel = requiredTier ? TIER_LABELS[requiredTier] : "a higher";

  return (
    <div className="relative" style={{ minHeight }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 rounded-lg">
        <div className="sticky top-1/2 -translate-y-1/2 flex items-center justify-center px-3 sm:px-0">
          <div className="text-center p-4 sm:p-6 max-w-md w-full">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center bg-[#FFCC00]/20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-[#FFCC00]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold mb-2 text-[#FFCC00]">
              Available on the {planLabel} plan
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm">
              Upgrade your plan to unlock this feature.
            </p>
            <button
              onClick={() => router.push("/shop?tab=settings&section=subscription")}
              className="mt-3 sm:mt-4 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm bg-[#FFCC00] hover:bg-[#E6B800] text-black transition-all duration-200"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
