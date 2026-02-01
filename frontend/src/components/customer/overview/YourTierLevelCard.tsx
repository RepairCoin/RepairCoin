"use client";

import React, { useState } from "react";
import { Trophy, Info, X, Star, Crown, Award } from "lucide-react";

interface YourTierLevelCardProps {
  tier: string;
  lifetimeEarned: number;
}

// Tier thresholds and benefits
const tierInfo = {
  BRONZE: {
    min: 0,
    max: 200,
    next: "Silver",
    bonus: 0,
    color: {
      primary: "#CD7F32",
      gradient: "from-amber-600 to-amber-700",
    },
    icon: Award,
    benefits: ["Base RCN rewards", "Access to marketplace"],
  },
  SILVER: {
    min: 200,
    max: 1000,
    next: "Gold",
    bonus: 2,
    color: {
      primary: "#C0C0C0",
      gradient: "from-gray-400 to-gray-500",
    },
    icon: Star,
    benefits: ["+2 RCN bonus per repair", "Priority support", "Early access to promotions"],
  },
  GOLD: {
    min: 1000,
    max: null,
    next: null,
    bonus: 5,
    color: {
      primary: "#FFD700",
      gradient: "from-yellow-500 to-orange-500",
    },
    icon: Crown,
    benefits: ["+5 RCN bonus per repair", "VIP support", "Exclusive offers", "Higher redemption rates"],
  },
};

export const YourTierLevelCard: React.FC<YourTierLevelCardProps> = ({
  tier,
  lifetimeEarned,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const normalizedTier = tier?.toUpperCase() || "BRONZE";
  const currentTierInfo = tierInfo[normalizedTier as keyof typeof tierInfo] || tierInfo.BRONZE;

  // Calculate progress - for Gold, show 100% as they've reached max
  let progress = 100;
  let rcnToNextTier = 0;

  if (currentTierInfo.max) {
    progress = Math.min(
      ((lifetimeEarned - currentTierInfo.min) / (currentTierInfo.max - currentTierInfo.min)) * 100,
      100
    );
    rcnToNextTier = Math.max(currentTierInfo.max - lifetimeEarned, 0);
  }

  const TierIcon = currentTierInfo.icon;

  return (
    <div className="bg-[#212121] rounded-xl overflow-visible relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Your Tier Level</h3>
        </div>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1 hover:bg-[#2A2A2A] rounded-full transition-colors"
          >
            <Info className="w-4 h-4 text-gray-400 hover:text-[#FFCC00]" />
          </button>

          {/* Tier Info Tooltip */}
          {showTooltip && (
            <div className="absolute right-0 top-8 z-[100] w-80 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Tier Benefits</h4>
                <button
                  onClick={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* All Tiers */}
              <div className="space-y-4">
                {Object.entries(tierInfo).map(([tierName, info]) => {
                  const isCurrentTier = tierName === normalizedTier;
                  const IconComponent = info.icon;
                  return (
                    <div
                      key={tierName}
                      className={`p-3 rounded-lg ${
                        isCurrentTier
                          ? "bg-[#FFCC00]/10 border border-[#FFCC00]/30"
                          : "bg-[#2A2A2A]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent
                          className="w-4 h-4"
                          style={{ color: info.color.primary }}
                        />
                        <span
                          className={`font-semibold text-sm ${
                            isCurrentTier ? "text-[#FFCC00]" : "text-white"
                          }`}
                        >
                          {tierName.charAt(0) + tierName.slice(1).toLowerCase()} Tier
                        </span>
                        {isCurrentTier && (
                          <span className="text-[10px] bg-[#FFCC00] text-black px-1.5 py-0.5 rounded font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {info.max ? `${info.min} - ${info.max} RCN earned` : `${info.min}+ RCN earned`}
                      </p>
                      <ul className="space-y-1">
                        {info.benefits.map((benefit, idx) => (
                          <li key={idx} className="text-xs text-gray-300 flex items-center gap-1">
                            <span className="text-[#FFCC00]">+</span> {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tier Display with Icon */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TierIcon
              className="w-8 h-8"
              style={{ color: currentTierInfo.color.primary }}
            />
          </div>
          <div
            className={`text-3xl font-bold bg-gradient-to-r ${currentTierInfo.color.gradient} bg-clip-text text-transparent`}
          >
            {tier || "Bronze"} Tier
          </div>
        </div>

        {/* Progress Bar - Always visible */}
        <div className="mb-3">
          <div className="w-full h-2.5 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${currentTierInfo.color.gradient} rounded-full transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Progress Text */}
        {currentTierInfo.next ? (
          <p className="text-sm text-gray-400 text-center">
            Earn <span className="text-[#FFCC00] font-semibold">{rcnToNextTier} RCN</span> to proceed to{" "}
            <span className="text-white font-semibold">{currentTierInfo.next} Tier</span>
          </p>
        ) : (
          <p className="text-sm text-[#FFCC00] text-center font-medium">
            You&apos;ve reached the highest tier!
          </p>
        )}

        {/* Current Bonus Info */}
        {currentTierInfo.bonus > 0 && (
          <div className="mt-3 text-center">
            <span className="text-xs bg-[#FFCC00]/20 text-[#FFCC00] px-2 py-1 rounded-full">
              +{currentTierInfo.bonus} RCN bonus per repair
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
