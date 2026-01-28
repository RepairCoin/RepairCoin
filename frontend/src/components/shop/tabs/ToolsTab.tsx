"use client";

import React, { useState } from "react";
import { Wrench } from "lucide-react";
import { IssueRewardsTab } from "./IssueRewardsTab";
import { RedeemTabV2 } from "./RedeemTabV2";
import PromoCodesTab from "./PromoCodesTab";
import { ShopData } from "../ShopDashboardClient";

interface ToolsTabProps {
  shopId: string;
  shopData: ShopData;
  onRewardIssued: () => void;
  onRedemptionComplete: () => void;
  isOperational: boolean;
  isBlocked: boolean;
  blockReason: string | null | undefined;
  setShowOnboardingModal: (show: boolean) => void;
}

export function ToolsTab({
  shopId,
  shopData,
  onRewardIssued,
  onRedemptionComplete,
  isOperational,
  isBlocked,
  blockReason,
  setShowOnboardingModal,
}: ToolsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"issue-rewards" | "redeem" | "promo-codes">("issue-rewards");

  const tabs = [
    { id: "issue-rewards" as const, label: "Issue Rewards", icon: "🎁" },
    { id: "redeem" as const, label: "Redeem", icon: "💳" },
    { id: "promo-codes" as const, label: "Promo Codes", icon: "🏷️" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
          <Wrench className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Shop Tools</h2>
          <p className="text-gray-400 text-sm">
            Manage rewards, redemptions, and promotional codes
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${
                  activeSubTab === tab.id
                    ? "border-[#FFCC00] text-[#FFCC00]"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-900/50 rounded-lg">
        {activeSubTab === "issue-rewards" && (
          <IssueRewardsTab
            shopId={shopId}
            shopData={shopData}
            onRewardIssued={onRewardIssued}
            isBlocked={isBlocked}
            blockReason={blockReason ?? undefined}
          />
        )}

        {activeSubTab === "redeem" && (
          <RedeemTabV2
            shopId={shopId}
            isOperational={isOperational}
            onRedemptionComplete={onRedemptionComplete}
            setShowOnboardingModal={setShowOnboardingModal}
            shopData={shopData}
            isBlocked={isBlocked}
            blockReason={blockReason ?? undefined}
            shopRcnBalance={shopData.purchasedRcnBalance || 0}
          />
        )}

        {activeSubTab === "promo-codes" && (
          <PromoCodesTab shopId={shopId} />
        )}
      </div>
    </div>
  );
}
