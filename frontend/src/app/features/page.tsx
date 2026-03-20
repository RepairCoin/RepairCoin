"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { LazyMotion, domAnimation } from "framer-motion";
import ScrollProgress from "@/components/motion/ScrollProgress";
import type { TabType } from "@/components/features/data";

// Critical above-the-fold - imported directly
import FeaturesHero from "@/components/features/FeaturesHero";

// Below-the-fold - lazy loaded with dynamic imports
const FeaturesGrid = dynamic(() => import("@/components/features/FeaturesGrid"), { ssr: true });
const TokenSection = dynamic(() => import("@/components/features/TokenSection"), { ssr: true });
const TechSection = dynamic(() => import("@/components/features/TechSection"), { ssr: true });
const FeaturesCTA = dynamic(() => import("@/components/features/FeaturesCTA"), { ssr: true });

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shop");

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#0D0D0D] text-white">
        <ScrollProgress />
        <FeaturesHero activeTab={activeTab} onTabChange={setActiveTab} />
        <FeaturesGrid activeTab={activeTab} />
        <TokenSection />
        <TechSection />
        <FeaturesCTA activeTab={activeTab} />
      </div>
    </LazyMotion>
  );
}
