"use client";

import { useState } from "react";
import Image from "next/image";
import { Gift, Users, Store } from "lucide-react";
import CustomerTierCards from "@/components/rewards/CustomerTierCards";
import ShopTierCards from "@/components/rewards/ShopTierCards";
import TierInfoSection from "@/components/rewards/TierInfoSection";
import RewardsCTA from "@/components/rewards/RewardsCTA";

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<"customers" | "shops">("customers");

  return (
    <div className="min-h-screen bg-[#191919] text-white">
      {/* Hero Section with Background Image - extends behind tier cards */}
      <div className="relative">
        {/* Background image - wave pattern - extends to cover cards area */}
        <div className="absolute inset-0 h-[700px] md:h-[700px]">
          <Image
            src="/img/rewards/hero-bg.png"
            alt="Hero background"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Subtle overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 pt-44">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-1.5 bg-[#FFCC00] px-3 py-1.5 rounded-full">
              <Gift className="w-5 h-5 text-[#101010]" />
              <span className="text-[#101010] text-sm md:text-base font-medium tracking-wide">
                RepairCoin Rewards
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-6">
            Loyalty that levels up with every tier
          </h1>

          {/* Subtitle */}
          <p className="text-white/80 text-base md:text-lg text-center max-w-3xl mx-auto mb-10">
            See how RepairCoin rewards both customers and shops. Earn RCN with every repair and purchase,
            and unlock better benefits as you move up each tier.
          </p>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 flex gap-1 shadow-lg">
              <button
                onClick={() => setActiveTab("customers")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm font-medium ${
                  activeTab === "customers"
                    ? "bg-[#FFCC00] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Customers</span>
              </button>
              <button
                onClick={() => setActiveTab("shops")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm font-medium ${
                  activeTab === "shops"
                    ? "bg-[#FFCC00] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <Store className="w-5 h-5" />
                <span>Shops</span>
              </button>
            </div>
          </div>

          {/* Description based on tab */}
          <p className="text-white/70 text-base text-center max-w-3xl mx-auto mb-12">
            {activeTab === "customers" ? (
              <>The more you repair and purchase at partner shops, the more your tier – and your RCN rewards – can grow. Each tier unlocks better earning potential and access to special perks.</>
            ) : (
              <>Choose the tier that matches your growth stage. Each level gives you better RCN pricing, higher redemption caps, and a stronger loyalty engine for your shop.</>
            )}
          </p>
        </div>

        {/* Tier Cards - positioned within hero background */}
        <div className="relative max-w-7xl mx-auto px-4 pb-16">
          {activeTab === "customers" ? (
            <CustomerTierCards />
          ) : (
            <ShopTierCards />
          )}
        </div>
      </div>

      <TierInfoSection activeTab={activeTab} />

      <RewardsCTA />
    </div>
  );
}
