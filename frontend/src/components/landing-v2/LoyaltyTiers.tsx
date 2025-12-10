"use client";

import React from "react";
import Image from "next/image";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Bronze",
    range: "0 - 199 RCN Lifetime Earned",
    headerBg: "bg-gradient-to-r from-[#ce8946] to-[#bfbfbf]",
    medalImage:
      "/img/landing/pexels-godisable-jacob-871495-removebg-preview 2.png",
    description: "Your starting point for earning rewards",
    checkColor: "bg-[#ce8946]", // Bronze/orange
    benefits: ["+ 0 RCN Bonus", "Earn 10–25 RCN per qualifying repair"],
    highlightColor: "bg-[#8B5A2B]/30", // Bronze highlight
  },
  {
    name: "Silver",
    range: "200 - 999  RCN Lifetime Earned",
    headerBg: "bg-gradient-to-r from-[#e8e8e8] to-[rgba(218,210,201,0.55)]",
    medalImage:
      "/img/landing/pexels-godisable-jacob-871495-removebg-preview 2 (1).png",
    description: "Earn and unlock your first loyalty boost",
    checkColor: "bg-[#9ca3af]", // Gray
    benefits: ["+ 2 RCN Bonus", "Earn 10–25 RCN per qualifying repair"],
    highlightColor: "bg-[#C0C0C0]/40", // Silver highlight
  },
  {
    name: "Gold",
    range: "1,000+ RCN lifetime earned",
    headerBg: "bg-gradient-to-r from-[#ffcc00] to-[rgba(218,210,201,0.55)]",
    medalImage:
      "/img/landing/pexels-godisable-jacob-871495-removebg-preview 2 (2).png",
    description: "The ultimate level of loyalty and reward",
    checkColor: "bg-[#ffcc00]", // Gold/yellow
    benefits: ["+ 5 RCN Bonus", "Earn 10–25 RCN per qualifying repair"],
    highlightColor: "bg-[#FFD700]/30", // Gold highlight
  },
];

export default function LoyaltyTiers() {
  return (
    <section className="relative bg-[#191919] w-full py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Loyalty That Levels Up
          </h2>
          <p className="text-base lg:text-lg text-gray-300">
            The more you repair, the more you earn — higher tiers unlock extra
            RCN bonuses.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="bg-white rounded-[20px] shadow-lg hover:shadow-2xl transition-shadow duration-300 relative"
            >
              <div className="relative overflow-hidden rounded-t-[20px]">
                {/* Header with Gradient */}
                <div className={`${tier.headerBg} h-[75px] relative`}>
                  {/* Tier Name and Range */}
                  <div className="absolute left-[20px] top-[14px] z-20">
                    <h3 className="text-[18px] font-semibold text-[#101010] leading-normal">
                      {tier.name}
                    </h3>
                    <p className="text-[12px] font-medium text-[#101010] leading-normal mt-0.5">
                      {tier.range}
                    </p>
                  </div>
                </div>

                {/* Coin/Medal Image - constrained within header wrapper */}
                <div className="absolute right-0 top-0 w-[130px] h-[75px] pointer-events-none">
                  <Image
                    src={tier.medalImage}
                    alt={`${tier.name} Medal`}
                    fill
                    className="object-contain object-right z-10"
                    sizes="130px"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="px-5 pt-4 pb-5">
                {/* Description - centered */}
                <p className="text-[14px] font-medium text-[#101010] text-center leading-[1.4] mb-4 pr-16">
                  {tier.description}
                </p>

                {/* Benefits */}
                <div className="space-y-2">
                  {tier.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full ${tier.checkColor} flex items-center justify-center`}
                      >
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                      <span className="text-[14px] font-medium text-[#101010] leading-[1.5]">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
