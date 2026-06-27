"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Store, Users } from "lucide-react";
import Badge from "@/components/landing-v4/Badge";
import type { TabType } from "./data";

interface FeaturesHeroProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface HeadingLine {
  text: string;
  underline?: boolean;
  underlineClass?: string;
}

interface HeroContent {
  lines: HeadingLine[];
  subtitle: string;
  mascot: string;
}

const HERO_CONTENT: Record<TabType, HeroContent> = {
  shop: {
    lines: [
      { text: "Everything You Need" },
      { text: "to Run and Grow", underline: true, underlineClass: "left-[20%] w-[80%]" },
      { text: "Your Business" },
    ],
    subtitle:
      "FixFlow AI brings all the tools you need to manage operations, engage customers, automate workflows and unlock growth - Powered by AI.",
    mascot: "/img/features/hero-mascot-shop.png",
  },
  customer: {
    lines: [
      { text: "Discover, Book, and" },
      { text: "Get Rewarded", underline: true, underlineClass: "left-[12%] w-[88%]" },
    ],
    subtitle:
      "Find trusted local businesses, book services in seconds, earn rewards, and enjoy a smarter customer experience with FixFlow.",
    mascot: "/img/features/hero-mascot-customer.png",
  },
};

export default function FeaturesHero({ activeTab, onTabChange }: FeaturesHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const content = HERO_CONTENT[activeTab];

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <m.div {...fadeUp(0.1)} className="flex justify-center lg:justify-start mb-6 md:mb-8">
              <Badge label="Powerful Features" />
            </m.div>

            {/* Heading + subtitle share a reserved height on desktop so the
                tab buttons below don't shift when the copy changes per tab.
                The subtitle still hugs the heading; spare height sits below it. */}
            <div className="lg:min-h-[440px]">
            {/* Title */}
            <m.h1
              key={activeTab}
              {...fadeUp(0.2)}
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.5] mb-5 md:mb-6"
            >
              {content.lines.map((line) =>
                line.underline ? (
                  <span key={line.text} className="relative inline-block lg:whitespace-nowrap">
                    {line.text}
                    {/* Yellow underline curve - animated draw */}
                    <svg
                      className={`absolute -bottom-2 md:-bottom-3 h-[12px] md:h-[16px] ${line.underlineClass ?? "left-0 w-full"}`}
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
                        initial={prefersReducedMotion ? undefined : { pathLength: 0 }}
                        animate={prefersReducedMotion ? undefined : { pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                      />
                    </svg>
                  </span>
                ) : (
                  <span key={line.text} className="block lg:whitespace-nowrap">
                    {line.text}
                  </span>
                )
              )}
            </m.h1>

            {/* Subtitle */}
            <m.p
              key={`sub-${activeTab}`}
              {...fadeUp(0.35)}
              className="text-base md:text-[22px] text-gray-300 max-w-2xl mx-auto lg:mx-0 mb-8 md:mb-10 leading-relaxed"
            >
              {content.subtitle}
            </m.p>
            </div>

            {/* Tab Navigation */}
            <m.div {...fadeUp(0.5)} className="flex justify-center lg:justify-start">
              <div className="flex items-center gap-1 bg-[#181818] border border-[#2a2a2a] rounded-lg p-1">
                <button
                  onClick={() => onTabChange("shop")}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all duration-200 ${
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
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all duration-200 ${
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

          {/* Right: mascot */}
          <m.div
            key={`mascot-${activeTab}`}
            {...fadeUp(0.3)}
            className="flex justify-center lg:justify-start lg:self-stretch lg:items-end lg:-ml-16"
          >
            <Image
              src={content.mascot}
              alt="RepairCoin AI mascot"
              width={520}
              height={520}
              priority
              className="w-[260px] sm:w-[340px] h-auto lg:w-auto lg:h-full object-contain"
            />
          </m.div>
        </div>
      </div>
    </section>
  );
}
