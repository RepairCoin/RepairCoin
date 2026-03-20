"use client";

import React from "react";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";
import SectionBadge from "@/components/about/SectionBadge";
import { techFeatures } from "./data";

export default function TechSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10 md:py-16">
      <AnimateOnScroll>
        <div className="flex justify-center mb-4 md:mb-6">
          <SectionBadge label="Core Infrastructure" />
        </div>

        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-3 md:mb-4">
          Built on Modern Technology
        </h2>
        <p className="text-sm md:text-lg text-gray-400 text-center mb-8 md:mb-12 px-2">
          Powering RepairCoin with speed, security, and real scalability.
        </p>
      </AnimateOnScroll>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {techFeatures.map((feature, index) => (
          <m.div
            key={index}
            variants={staggerItem}
            transition={{ duration: 0.5 }}
            className="card-hover-glow bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 text-center"
          >
            {/* Centered icon with shadow effect */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                <div className="relative p-2 bg-[#ffcc00] rounded-lg text-black">
                  {feature.icon}
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-3">
              {feature.title}
            </h3>
            <p className="text-[#999999] text-sm">
              {feature.description}
            </p>
          </m.div>
        ))}
      </StaggerContainer>
    </section>
  );
}
