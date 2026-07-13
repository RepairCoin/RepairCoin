"use client";

import React from "react";
import { Check } from "lucide-react";
import { SUBSCRIPTION_PLANS, SubscriptionTier } from "@/config/subscriptionPlans";

interface PlanComparisonProps {
  selectedTier: SubscriptionTier;
  onSelect: (tier: SubscriptionTier) => void;
  /** Tier to badge as "Most Popular". Defaults to the middle plan. */
  recommendedTier?: SubscriptionTier;
}

/**
 * Side-by-side comparison of every subscription tier with its per-tier
 * inclusions, so shops can compare plans before choosing one. Drives the
 * shared `selectedTier` state used by the billing/checkout flow.
 */
export function PlanComparison({ selectedTier, onSelect, recommendedTier }: PlanComparisonProps) {
  const recommended =
    recommendedTier ?? SUBSCRIPTION_PLANS[Math.floor(SUBSCRIPTION_PLANS.length / 2)]?.tier;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {SUBSCRIPTION_PLANS.map((plan) => {
        const isSelected = selectedTier === plan.tier;
        const isRecommended = plan.tier === recommended;

        return (
          <button
            key={plan.tier}
            type="button"
            onClick={() => onSelect(plan.tier)}
            className={`relative text-left rounded-2xl border p-5 transition-all flex flex-col ${
              isSelected
                ? "border-[#FFCC00] bg-[#FFCC00]/[0.06] ring-1 ring-[#FFCC00]"
                : "border-gray-700 bg-gray-900/40 hover:border-gray-500"
            }`}
          >
            {isRecommended && (
              <span className="absolute -top-2.5 left-5 text-[10px] font-bold uppercase tracking-wide bg-[#FFCC00] text-black px-2 py-0.5 rounded-full">
                Most Popular
              </span>
            )}

            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-semibold">{plan.label}</h3>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  isSelected ? "bg-[#FFCC00] border-[#FFCC00]" : "border-gray-600"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-black" />}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold text-white">${plan.price}</span>
              <span className="text-gray-500 text-sm">/mo</span>
            </div>

            <p className="text-xs text-gray-400 mb-3">{plan.includesLabel}</p>

            <ul className="space-y-2 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <div
              className={`mt-4 text-center text-sm font-semibold py-2 rounded-lg ${
                isSelected ? "bg-[#FFCC00] text-black" : "bg-gray-800 text-gray-300"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default PlanComparison;
