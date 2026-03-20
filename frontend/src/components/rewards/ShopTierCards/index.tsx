"use client";

import { Shield, Sparkles, Crown, CheckCircle, Coins } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { staggerItem } from "@/components/motion/StaggerContainer";

interface ShopTier {
  name: string;
  description: string;
  rcgStake: string;
  rcnShopRate: string;
  redemptionCap: string;
  benefits: string[];
  whoFor: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const shopTiers: ShopTier[] = [
  {
    name: "Standard Tier",
    description:
      "Plug into RepairCoin with zero staking. Great for new partner shops testing loyalty rewards.",
    rcgStake: "None",
    rcnShopRate: "Pay $0.10 per RCN",
    redemptionCap: "$50 in RCN per customer, per visit.",
    benefits: [
      "Start issuing RCN rewards in minutes",
      "Customer redemption value fixed at $0.10 per RCN",
      "QR-based redemption + core loyalty tools",
      "Track customer activity & retention insights",
      "Issue rewards for small, medium, and large services",
    ],
    whoFor:
      "Shops looking for a simple, low-risk way to reward customers, gather useful data, and improve retention without overhauling their current operations.",
    icon: Shield,
    iconBg: "bg-[#252525]",
    iconColor: "text-white",
  },
  {
    name: "Premium",
    description:
      "For growing shops that want better RCN pricing and stronger incentives to drive repeat visits.",
    rcgStake: "500 RCG",
    rcnShopRate: "Pay $0.08 per RCN",
    redemptionCap: "$75 in RCN per customer, per visit.",
    benefits: [
      "Premium pricing on RCN purchases",
      "Customer redemption value still fixed at $0.10 per RCN",
      "Recommended for scaling multi-tech operations",
      "Automatic +2 RCN bonus added to each reward",
      "Issue rewards for small, medium, and large services",
    ],
    whoFor:
      "Shops that are ready to scale, want a better return on every dollar spent on rewards, and are building a loyal base of recurring customers.",
    icon: Sparkles,
    iconBg: "bg-[#252525]",
    iconColor: "text-white",
  },
  {
    name: "Elite Tier",
    description:
      "Built for top-performing service shops that want the strongest loyalty engine and best rates.",
    rcgStake: "1500 RCG",
    rcnShopRate: "Pay $0.06 per RCN",
    redemptionCap: "$100 in RCN per customer, per visit.",
    benefits: [
      "Best shop pricing + highest caps",
      "Customer redemption value still fixed at $0.10 per RCN",
      "Automatic +5 RCN bonus added to each reward",
      "Ideal for high-volume, high-ticket service teams",
      "Priority access to new partner features",
    ],
    whoFor:
      "High volume repair shops, clinics, and service businesses that treat loyalty as a core growth strategy and want maximum leverage from the RepairCoin ecosystem.",
    icon: Crown,
    iconBg: "bg-[#FFCC00]",
    iconColor: "text-black",
  },
];

const ShopTierCards = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      initial={prefersReducedMotion ? undefined : "hidden"}
      animate={prefersReducedMotion ? undefined : "visible"}
      transition={{ staggerChildren: 0.15 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-7 min-h-screen"
    >
      {shopTiers.map((tier) => {
        const Icon = tier.icon;
        return (
          <m.div
            key={tier.name}
            variants={staggerItem}
            transition={{ duration: 0.5 }}
            className="card-hover-glow border border-[#2a2a2a] rounded-3xl p-5 md:p-8 flex flex-col"
            style={{
              background:
                "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)",
            }}
          >
            {/* Icon circle */}
            <div
              className={`w-14 h-14 rounded-full ${tier.iconBg} flex items-center justify-center mb-6`}
            >
              <Icon className={`w-7 h-7 ${tier.iconColor}`} />
            </div>

            {/* Name & Description */}
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{tier.name}</h3>
            <p className="text-sm text-[#777] mb-6 leading-relaxed">{tier.description}</p>

            {/* RCG Stake pill */}
            <div className="inline-flex items-center gap-2 border border-[#2a2a2a] rounded-lg px-3 py-2 w-fit mb-6">
              <Coins className="w-4 h-4 text-[#666]" />
              <span className="text-sm text-[#aaa]">
                RCG Stake:{" "}
                <span className="font-semibold text-white">{tier.rcgStake}</span>
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="border border-[#252530] rounded-xl p-4">
                <p className="text-xs text-[#555] mb-2 font-medium">RCN Shop Rate</p>
                <p className="text-sm text-white font-semibold">{tier.rcnShopRate}</p>
              </div>
              <div className="border border-[#252530] rounded-xl p-4">
                <p className="text-xs text-[#555] mb-2 font-medium">Redemption Cap</p>
                <p className="text-sm text-white font-semibold">{tier.redemptionCap}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#1e1e28] mb-6" />

            {/* Key Benefits */}
            <h4 className="text-base font-bold text-white mb-4">Key Benefits</h4>
            <ul className="space-y-3 mb-6">
              {tier.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#bbb] leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Divider */}
            <div className="border-t border-[#1e1e28] mb-6" />

            {/* Who It's For */}
            <div className="mt-auto">
              <h4 className="text-base font-bold text-white mb-2">Who It&apos;s For</h4>
              <p className="text-sm text-[#777] leading-relaxed">{tier.whoFor}</p>
            </div>
          </m.div>
        );
      })}
    </m.div>
  );
};

export default ShopTierCards;
