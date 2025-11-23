"use client";

import React from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { useModalStore } from "@/stores/modalStore";

const tiers = [
  {
    name: "Standard Partner",
    stake: "Stake: 10,000 – 49,999 RCG",
    headerBg: "bg-gray-300",
    textColor: "text-black",
    checkmarkColor: "bg-yellow-400",
    image: "/img/landing/Photo (9).png",
    fallback: "🏪",
    description:
      "Start your journey with RepairCoin — Earn loyalty rewards and get listed nationwide.",
    benefits: [
      "$0.10 per RCN — standard rate for entry-level partners.",
      "Integrated with FixFlow CRM for tracking and reporting",
      'Listed on the "Find a Shop" nationwide map',
      "Standard redemption cap (set by DAO policy)",
      "Eligible for cross-shop redemption",
    ],
  },
  {
    name: "Premium Partner",
    stake: "Stake: 50,000 – 199,999 RCG",
    headerBg: "bg-white",
    textColor: "text-black",
    checkmarkColor: "bg-yellow-400",
    image: "/img/landing/Photo (10).png",
    fallback: "⭐",
    description:
      "Scale your shop's loyalty program — Unlock higher rewards and advanced CRM insights.",
    benefits: [
      "$0.08 per RCN — 20% lower reward cost for RCG-staked shops.",
      'Priority listing on the "Find a Shop" network',
      "Cross-shop redemption enabled — redeem at other partners",
      "Early access to RepairCoin campaigns and seasonal reward boosts",
      "Cross-shop redemption enabled — redeem at other partners",
    ],
  },
  {
    name: "Elite Partner",
    stake: "Stake: 200,000+ RCG",
    headerBg: "bg-[#FFD700]",
    textColor: "text-black",
    checkmarkColor: "bg-yellow-400",
    image: "/img/landing/Photo (11).png",
    fallback: "💎",
    description:
      "From earning to influencing — Govern the RepairCoin ecosystem with exclusive perks.",
    benefits: [
      "$0.06 per RCN — exclusive 40% discount for top-tier DAO members.",
      "Full access to RepairCoin Governance Dashboard (RCG DAO)",
      "Featured shop placement in national and cross-brand campaigns",
      "Eligible for DAO incentive rewards and RCG yield programs",
      "Cross-shop redemption enabled, allowing customers to redeem RCN in partner shops",
    ],
  },
];

export default function ShopTiers() {
  const { openWelcomeModal } = useModalStore();

  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Verified by Governance. Built for Growth.
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-4xl mx-auto">
            Each shop's RCG stake defines its tier, pricing, and benefits —
            ensuring trust and transparency for every customer.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              {/* Header */}
              <div className={`${tier.headerBg} px-6 py-6`}>
                <h3 className={`text-2xl font-bold ${tier.textColor} mb-2`}>
                  {tier.name}
                </h3>
                <p className={`text-sm ${tier.textColor}`}>{tier.stake}</p>
              </div>

              {/* Shop Image */}
              <div className="h-80 bg-gray-200 flex items-center justify-center overflow-hidden relative">
                <Image
                  src={tier.image}
                  alt={`${tier.name} Shop`}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <p className="text-center text-sm text-gray-800 leading-relaxed">
                  {tier.description}
                </p>

                <div className="space-y-3">
                  {tier.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full ${tier.checkmarkColor} flex items-center justify-center mt-0.5`}
                      >
                        <Check className="w-3 h-3 text-black" />
                      </div>
                      <span className="text-sm text-gray-800 leading-relaxed">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Get Started Button */}
                <div className="pt-4 text-center mt-auto flex-grow flex items-end justify-center">
                  <button
                    onClick={openWelcomeModal}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors "
                  >
                    Get Started →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
