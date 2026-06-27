"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { LazyMotion, domAnimation } from "framer-motion";
import ScrollProgress from "@/components/motion/ScrollProgress";
import type { TabType } from "@/components/features/data";

// Critical above-the-fold - imported directly
import FeaturesHero from "@/components/features/FeaturesHero";

// Below-the-fold - lazy loaded with dynamic imports
const ShopFeatureShowcases = dynamic(() => import("@/components/features/ShopFeatureShowcases"), { ssr: true });
const CustomerFeatureShowcases = dynamic(() => import("@/components/features/CustomerFeatureShowcases"), { ssr: true });
const CTASection = dynamic(() => import("@/components/landing-v4/CTASection"), { ssr: true });

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shop");

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#0D0D0D] text-white">
        <ScrollProgress />
        <FeaturesHero activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "shop" ? (
          <>
            <ShopFeatureShowcases />
            <CTASection
              line1="Everything You Need"
              line2="In One Powerful Platform"
              description="Manage operations, engage customers, automate workflows, and grow your business with AI—all from a single platform built for modern businesses."
            />
          </>
        ) : (
          <>
            <CustomerFeatureShowcases />
            <CTASection
              line1="Your Rewards"
              line2="Journey Starts Here"
              description="Join FixFlow and start earning rewards, unlocking exclusive perks, and discovering businesses you'll love."
              ctaLabel="Join FixFlow →"
            />
          </>
        )}
      </div>
    </LazyMotion>
  );
}
