"use client";

import React from "react";
import { m, useReducedMotion } from "framer-motion";
import { Store, Users } from "lucide-react";
import SectionBadge from "@/components/about/SectionBadge";

export type RewardsTabType = "shopowner" | "customers";

interface RewardsHeroProps {
  activeTab: RewardsTabType;
  onTabChange: (tab: RewardsTabType) => void;
}

export default function RewardsHero({ activeTab, onTabChange }: RewardsHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
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
        <m.div {...fadeUp(0.1)} className="mb-6 md:mb-8">
          <SectionBadge label="Progressive Rewards" />
        </m.div>

        {/* Heading */}
        <m.h1
          {...fadeUp(0.2)}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-4"
        >
          Earn more. Level up.
          <br />
          <span className="relative inline-block">
            Unlock{" "}
            <span className="relative inline-block">
              <span className="text-gold-gradient">better rewards.</span>
              <svg
                className="absolute -bottom-2 md:-bottom-4 -left-[3%] w-[106%] h-[14px] md:h-[20px]"
                viewBox="0 0 200 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <m.path
                  d="M2 9C50 2 150 2 198 9"
                  stroke="#ffcc00"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                />
              </svg>
            </span>
          </span>
        </m.h1>

        {/* Subtitle */}
        <m.p
          {...fadeUp(0.35)}
          className="text-white/55 text-sm md:text-lg max-w-xl mb-10 md:mb-20 leading-relaxed px-2"
        >
          Simple progression. Real benefits.
          <br />
          Earn tokens with every service and unlock higher tiers with bigger rewards.
        </m.p>

        {/* Tab Toggle */}
        <m.div {...fadeUp(0.5)}>
          <div className="flex items-center gap-1 bg-[#181818] border border-[#2a2a2a] rounded-full p-1">
            <button
              onClick={() => onTabChange("shopowner")}
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
              onClick={() => onTabChange("customers")}
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
        </m.div>
      </div>
    </section>
  );
}
