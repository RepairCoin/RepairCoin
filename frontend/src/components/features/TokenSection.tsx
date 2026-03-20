"use client";

import React from "react";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";
import SectionBadge from "@/components/about/SectionBadge";
import { tokenCards } from "./data";

export default function TokenSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10 md:py-16">
      <AnimateOnScroll>
        <div className="flex justify-center mb-4 md:mb-6">
          <SectionBadge label="Reward & Governance Model" />
        </div>

        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-3 md:mb-4">
          Dual-Token Business Model
        </h2>
        <p className="text-sm md:text-lg text-gray-400 text-center mb-8 md:mb-12 px-2">
          Built for stability, sustainable growth, and real-world use.
        </p>
      </AnimateOnScroll>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tokenCards.map((card, index) => (
          <m.div
            key={index}
            variants={staggerItem}
            transition={{ duration: 0.5 }}
            className="card-hover-glow bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6"
          >
            {/* Icon with shadow effect */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                <div
                  className={`relative p-2 ${card.iconBg} rounded-lg text-black`}
                >
                  {card.icon}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white">
                {card.title}
              </h3>
            </div>

            {/* Description */}
            <p className="text-[#999999] text-sm mb-4">
              {card.description}
            </p>

            {/* Details with yellow bullets and bold labels */}
            <ul className="space-y-2">
              {card.details.map((detail, detailIndex) => (
                <li
                  key={detailIndex}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="text-[#ffcc00] mt-1.5 shrink-0">
                    &#9702;
                  </span>
                  <span>
                    <span className="font-semibold text-white">
                      {detail.label}:
                    </span>
                    <span className="text-white"> {detail.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </m.div>
        ))}
      </StaggerContainer>
    </section>
  );
}
