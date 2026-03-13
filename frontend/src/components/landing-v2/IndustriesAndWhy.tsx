"use client";

import React from "react";
import {
  Wrench,
  Scissors,
  Dumbbell,
  Car,
  HeartPulse,
  Store,
  CheckCircle2,
} from "lucide-react";
import SectionBadge from "@/components/about/SectionBadge";

const industries = [
  { icon: <Wrench className="w-5 h-5" />, name: "Repair Shops" },
  { icon: <Scissors className="w-5 h-5" />, name: "Barbers & Salons" },
  { icon: <Dumbbell className="w-5 h-5" />, name: "Gyms & Fitness" },
  { icon: <Car className="w-5 h-5" />, name: "Auto Shops" },
  { icon: <HeartPulse className="w-5 h-5" />, name: "Clinics & Wellness" },
  { icon: <Store className="w-5 h-5" />, name: "Local Service Businesses" },
];

const comparisonRows = [
  {
    feature: "How Rewards Are Earned",
    repaircoin: "Earn automatically after every completed service",
    traditional: "Often manual or purchase-threshold based",
  },
  {
    feature: "Redemption Options",
    repaircoin: "Redeem across participating shops",
    traditional: "Usually limited to one business",
  },
  {
    feature: "Ease of Use",
    repaircoin: "Automatic, digital, no cards to manage",
    traditional: "Punch cards, points systems, or apps",
  },
  {
    feature: "Tracking & Visibility",
    repaircoin: "Real-time balances and activity",
    traditional: "Limited or unclear tracking",
  },
  {
    feature: "Security",
    repaircoin: "Blockchain-backed, verifiable transactions",
    traditional: "Centralized and editable",
  },
  {
    feature: "Customer Experience",
    repaircoin: "Seamless and rewarding",
    traditional: "Often forgettable",
  },
  {
    feature: "Business Value",
    repaircoin: "Builds long-term loyalty and repeat visits",
    traditional: "Short-term promotions and discounts",
  },
  {
    feature: "Designed For",
    repaircoin: "Modern service businesses and customers",
    traditional: "Legacy loyalty systems",
  },
];

export default function IndustriesAndWhy() {
  return (
    <>
      {/* Industries Section */}
      <section className="relative bg-[#191919] py-12 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
            <div className="flex justify-center">
              <SectionBadge label="Industries" />
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
              Built for the services people come back to
            </h2>

            <p className="text-gray-400 italic max-w-xl mx-auto">
              If you sell services, RepairCoin helps you turn visits into
              loyalty.
            </p>
          </div>

          {/* Industry Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {industries.map((industry) => (
              <div
                key={industry.name}
                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e] rounded-xl border border-gray-700/50 hover:border-[#F7CC00]/30 transition-colors"
              >
                <span className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#F7CC00] rounded-full text-black flex-shrink-0">
                  {industry.icon}
                </span>
                <span className="text-white font-medium text-xs sm:text-sm">
                  {industry.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why RepairCoin Section */}
      <section className="relative bg-[#191919] py-12 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
            <div className="flex justify-center">
              <SectionBadge label="A Better Way to Reward Loyalty" />
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
              Why RepairCoin?
            </h2>

            <p className="text-[#F7CC00] italic max-w-2xl mx-auto">
              See how RepairCoin improves on traditional loyalty programs without
              adding complexity.
            </p>
          </div>

          {/* Comparison Table - Desktop */}
          <div className="max-w-5xl mx-auto bg-gradient-to-b from-[#1a1a1a] to-[#111111] rounded-2xl border border-gray-700/40 overflow-hidden hidden sm:block">
            {/* Table Header */}
            <div className="grid grid-cols-[1.2fr_1.5fr_1.5fr] gap-4 sm:gap-6 px-5 sm:px-10 py-5 sm:py-6 border-b border-gray-700/40">
              <span className="text-[#F7CC00] font-semibold text-sm sm:text-base">
                Feature
              </span>
              <span className="text-white font-semibold text-sm sm:text-base">
                RepairCoin Rewards
              </span>
              <span className="text-gray-400 font-semibold text-sm sm:text-base">
                Traditional Rewards
              </span>
            </div>

            {/* Table Rows */}
            {comparisonRows.map((row, index) => (
              <div
                key={index}
                className={`grid grid-cols-[1.2fr_1.5fr_1.5fr] gap-4 sm:gap-6 px-5 sm:px-10 py-4 sm:py-5 items-center ${
                  index < comparisonRows.length - 1
                    ? "border-b border-gray-800/30"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#F7CC00] flex-shrink-0" />
                  <span className="text-white font-medium text-sm sm:text-base">
                    {row.feature}
                  </span>
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  {row.repaircoin}
                </span>
                <span className="text-gray-500 text-sm sm:text-base italic">
                  {row.traditional}
                </span>
              </div>
            ))}
          </div>

          {/* Comparison Table - Mobile (stacked cards) */}
          <div className="sm:hidden space-y-4">
            {comparisonRows.map((row, index) => (
              <div
                key={index}
                className="bg-gradient-to-b from-[#1a1a1a] to-[#111111] rounded-xl border border-gray-700/40 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#F7CC00] flex-shrink-0" />
                  <span className="text-white font-semibold text-sm">
                    {row.feature}
                  </span>
                </div>
                <div className="pl-7 space-y-2">
                  <div>
                    <span className="text-[#F7CC00] text-xs font-medium">RepairCoin</span>
                    <p className="text-gray-300 text-sm">{row.repaircoin}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs font-medium">Traditional</span>
                    <p className="text-gray-500 text-sm italic">{row.traditional}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
