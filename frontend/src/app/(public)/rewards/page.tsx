"use client";

import { useState } from "react";
import { Store, Users, SparklesIcon } from "lucide-react";
import ShopTierCards from "@/components/rewards/ShopTierCards";
import ShopHowItWorks from "@/components/rewards/ShopHowItWorks";
import CustomerTierCards from "@/components/rewards/CustomerTierCards";
import CustomerHowTiersWork from "@/components/rewards/CustomerHowTiersWork";
import RewardsCTA from "@/components/rewards/RewardsCTA";

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<"shopowner" | "customers">(
    "shopowner",
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[84vh] flex items-center">
        {/* Background wave pattern */}
        <div
          className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
          style={{
            backgroundImage: "url(/img/about/bg-design.png)",
            backgroundSize: "contain",
          }}
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-24 md:py-36 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ffcc00] bg-gradient-to-r from-[#ffcc00]/10 to-transparent text-[#ffcc00] mb-6 md:mb-8">
            <SparklesIcon size={14} className="text-[#ffcc00]" />
            <span className="text-xs md:text-sm font-medium">Progressive Rewards</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-4">
            Earn more. Level up.
            <br />
            <span className="relative inline-block">Unlock better rewards.</span>
            <span className="relative inline-block w-[40%]">
              <svg
                className="absolute bottom-5 md:bottom-10 -left-[3%] w-[106%] h-[14px] md:h-[18px]"
                viewBox="0 0 311 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 5.5C80 1.5 230 1.5 309 5.5"
                  stroke="#ffcc00"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/55 text-sm md:text-lg max-w-xl mb-10 md:mb-20 leading-relaxed px-2">
            Simple progression. Real benefits.
            <br />
            Earn tokens with every service and unlock higher tiers with bigger rewards.
          </p>

          {/* Tab Toggle */}
          <div className="flex items-center gap-1 bg-[#181818] border border-[#2a2a2a] rounded-full p-1">
            <button
              onClick={() => setActiveTab("shopowner")}
              className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                activeTab === "shopowner"
                  ? "bg-[#FFCC00] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Shop Owner
            </button>
            <button
              onClick={() => setActiveTab("customers")}
              className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                activeTab === "customers"
                  ? "bg-[#FFCC00] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Customers
            </button>
          </div>
        </div>
      </section>

      {/* Tab Content */}
      {activeTab === "shopowner" ? (
        <>
          <section className="max-w-7xl mx-auto px-4 pt-4 pb-12 min-h-screen h-full">
            <ShopTierCards />
          </section>
          <ShopHowItWorks />
        </>
      ) : (
        <>
          <section className="max-w-7xl mx-auto px-4 pt-4 pb-12">
            <CustomerTierCards />
          </section>
          <CustomerHowTiersWork />
        </>
      )}

      {/* Footer CTA — shown for both tabs */}
      <RewardsCTA activeTab={activeTab} />
    </div>
  );
}
