"use client";

import Image from "next/image";
import { m } from "framer-motion";
import { BadgeCheck, Target } from "lucide-react";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";
import SectionBadge from "./SectionBadge";

const trustCards = [
  {
    icon: "/img/about/trust-clearvalue-icon.png",
    title: "Clear value, no surprises",
    description: "Rewards are designed to be stable and easy to understand, not a guessing game.",
  },
  {
    icon: "/img/about/trust-builtforlong-icon.png",
    title: "Built for long-term trust",
    description: "No expiration gimmicks.\nNo confusing point systems.\nJust consistent loyalty.",
  },
  {
    icon: "/img/about/trust-measurable-icon.png",
    title: "Measurable impact",
    description:
      "Track repeat visits, redemptions, and engagement so you can improve confidently.",
  },
];

const credibilityBadges = [
  "Fixed redemption model",
  "Non-public trading focus",
  "Anti-fraud mindset",
  "Operational analytics",
  "Built by service operator",
  "Proven in real service flows",
];

export default function Trust() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <AnimateOnScroll>
          <div className="text-center mb-14">
            <SectionBadge label="Trust" 
              className="mb-6"
            />
            <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Built to earn confidence, not hype
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-gray-400 text-sm sm:text-base leading-relaxed">
              RepairCoin is designed to feel responsible, stable, and practical for everyday
              businesses.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Trust cards */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {trustCards.map((card) => (
            <m.div
              key={card.title}
              variants={staggerItem}
              transition={{ duration: 0.5 }}
              className="rounded-[32px] border border-white/5 p-8 pt-10"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-[#ffcc00] flex items-center justify-center mb-8">
                <Image
                  src={card.icon}
                  alt={card.title}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                {card.description}
              </p>
            </m.div>
          ))}
        </StaggerContainer>

        {/* Signals of credibility */}
        <AnimateOnScroll delay={0.2}>
          <div
            className="rounded-[32px] border border-white/5 p-8 sm:p-10"
            style={{
              background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
            }}
          >
            <h3 className="text-xl font-bold text-white mb-2">Signals of credibility</h3>
            <p className="text-gray-400 text-sm mb-6">
              Designed for early-stage trust before big logos.
            </p>

            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.1}>
              {credibilityBadges.map((badge) => (
                <m.div
                  key={badge}
                  variants={staggerItem}
                  className="flex items-center gap-4 border border-white/5 rounded-2xl px-6 py-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
                  }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#ffcc00] flex-shrink-0">
                    <BadgeCheck className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-white text-sm font-medium">{badge}</span>
                </m.div>
              ))}
            </StaggerContainer>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
