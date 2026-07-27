"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import ScrollProgress from "@/components/motion/ScrollProgress";
import type { RewardsTabType } from "@/components/rewards/RewardsHero";

// Critical above-the-fold - imported directly
import RewardsHero from "@/components/rewards/RewardsHero";

// Below-the-fold - lazy loaded with dynamic imports
const ShopTierCards = dynamic(() => import("@/components/rewards/ShopTierCards"), { ssr: true });
const CustomerTierCards = dynamic(() => import("@/components/rewards/CustomerTierCards"), { ssr: true });
const CustomerHowTiersWork = dynamic(() => import("@/components/rewards/CustomerHowTiersWork"), { ssr: true });
const CTASection = dynamic(() => import("@/components/landing-v4/CTASection"), { ssr: true });

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<RewardsTabType>("shopowner");

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#0D0D0D] text-white">
        <ScrollProgress />
        <RewardsHero activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "shopowner" ? (
            <m.div
              key="shopowner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <section className="max-w-7xl mx-auto px-4 pt-4 pb-12 min-h-screen h-full">
                <ShopTierCards />
              </section>
            </m.div>
          ) : (
            <m.div
              key="customers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <section className="max-w-7xl mx-auto px-4 pt-4 pb-12">
                <CustomerTierCards />
              </section>
              <CustomerHowTiersWork />
            </m.div>
          )}
        </AnimatePresence>

        {/* Footer CTA — copy varies per tab */}
        {activeTab === "shopowner" ? (
          <CTASection
            line1="Start Building Customer"
            line2="Loyalty Today"
            description="Reward loyal customers, increase repeat bookings, and grow your business with a loyalty platform built for modern businesses."
            ctaLabel="Get Started Free →"
            secondaryLabel="Explore Pricing →"
            secondaryHref="/pricing"
          />
        ) : (
          <CTASection
            line1="Start Earning"
            line2="Smarter Today"
            description="Join the FixFlow to earn points, unlock exclusive perks, discover trusted businesses, and enjoy personalized rewards with every visit."
            ctaLabel="Join Free Today →"
          />
        )}
      </div>
    </LazyMotion>
  );
}
