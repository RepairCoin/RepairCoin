"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Store, Users } from "lucide-react";
import SectionBadge from "@/components/about/SectionBadge";
import type { TabType } from "./data";

interface FeaturesHeroProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function FeaturesHero({ activeTab, onTabChange }: FeaturesHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative min-h-[75vh] overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[75vh] max-w-7xl mx-auto px-4 pt-24 md:pt-0">
        {/* Badge */}
        <m.div {...fadeUp(0.1)} className="flex justify-center mb-6 md:mb-10">
          <SectionBadge label="Two Experiences, One Loyalty Network" />
        </m.div>

        {/* Title */}
        <m.h1
          {...fadeUp(0.2)}
          className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-center leading-tight mb-4 md:mb-6"
        >
          Features that connect
          <br />
          service,{" "}
          <span className="relative inline-block">
            <span className="text-gold-gradient">rewards,</span>
            {/* Yellow underline curve - animated draw */}
            <svg
              className="absolute -bottom-3 md:-bottom-5 -left-[3%] w-[106%] h-[14px] md:h-[20px]"
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
          </span>{" "}
          and loyalty
        </m.h1>

        {/* Subtitle */}
        <m.p
          {...fadeUp(0.35)}
          className="text-sm md:text-lg text-center text-gray-400 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2"
        >
          Rewards for customers. Growth for shops.
          <br />
          Every service creates value on both sides of the counter.
        </m.p>

        {/* Tab Navigation */}
        <m.div {...fadeUp(0.5)} className="flex justify-center mb-10 md:mb-16">
          <div className="flex items-center gap-1 bg-[#181818] border border-[#2a2a2a] rounded-full p-1">
            <button
              onClick={() => onTabChange("shop")}
              className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                activeTab === "shop"
                  ? "bg-[#FFCC00] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Shop Owner
            </button>
            <button
              onClick={() => onTabChange("customer")}
              className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                activeTab === "customer"
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
