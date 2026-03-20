"use client";

import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";
import { shopFeatures, customerFeatures, type TabType } from "./data";

interface FeaturesGridProps {
  activeTab: TabType;
}

export default function FeaturesGrid({ activeTab }: FeaturesGridProps) {
  const features = activeTab === "shop" ? shopFeatures : customerFeatures;

  return (
    <section className="max-w-7xl mx-auto px-4 pb-12 md:pb-20">
      <AnimatePresence mode="wait">
        <m.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {features.map((feature, index) => (
              <m.div
                key={index}
                variants={staggerItem}
                transition={{ duration: 0.5 }}
                className="card-hover-glow bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[rgba(83,83,83,0.25)] rounded-2xl p-6"
              >
                {/* Icon with shadow effect */}
                <div className="mb-5">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-full" />
                    <div className="relative p-3 bg-[#ffcc00] rounded-full text-black">
                      {feature.icon}
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white mb-2">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-[#999999] text-sm mb-5">
                  {feature.description}
                </p>

                {/* Details with yellow checkmark badges */}
                <ul className="space-y-3">
                  {feature.details.map((detail, detailIndex) => (
                    <li
                      key={detailIndex}
                      className="flex items-start gap-3 text-sm"
                    >
                      <BadgeCheck className="w-5 h-5 shrink-0 mt-0.5 text-[#ffcc00]" />
                      <span className="text-white">{detail}</span>
                    </li>
                  ))}
                </ul>
              </m.div>
            ))}
          </StaggerContainer>
        </m.div>
      </AnimatePresence>
    </section>
  );
}
