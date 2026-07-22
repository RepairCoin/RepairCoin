"use client";

import { Shield, Sparkles, Crown, CheckCircle } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { staggerItem } from "@/components/motion/StaggerContainer";

interface CustomerTier {
  name: string;
  description: string;
  benefits: string[];
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const customerTiers: CustomerTier[] = [
  {
    name: "Bronze",
    description:
      "Your automatic starting tier. Every member begins here and starts earning from their very first service.",
    benefits: [
      "Earn base RCN on every repair and purchase",
      "Access to all verified partner shops",
      "Basic wallet history tracking",
    ],
    icon: Shield,
    iconBg: "bg-[#CD7F32]",
    iconColor: "text-black",
  },
  {
    name: "Silver",
    description:
      "Unlock this tier by staying active. Earn higher multipliers and gain early access as your repair activity grows.",
    benefits: [
      "Boosted RCN rewards on eligible transactions",
      "Occasional promo multipliers at select shops",
      "Priority access to limited-time campaigns",
    ],
    icon: Sparkles,
    iconBg: "bg-[#C0C0C0]",
    iconColor: "text-black",
  },
  {
    name: "Gold",
    description:
      "The highest tier for your most loyal activity. Earn maximum rewards, unlock exclusive benefits, and enjoy priority access across the network.",
    benefits: [
      "Highest RCN earning rates",
      "Early access to new partner shops and promos",
      "Exclusive Gold-only perks defined by governance",
    ],
    icon: Crown,
    iconBg: "bg-[#FFCC00]",
    iconColor: "text-black",
  },
];

const CustomerTierCards = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      initial={prefersReducedMotion ? undefined : "hidden"}
      animate={prefersReducedMotion ? undefined : "visible"}
      transition={{ staggerChildren: 0.15 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-7"
    >
      {customerTiers.map((tier) => {
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
              className={`w-9 h-9 rounded-full ${tier.iconBg} flex items-center justify-center mb-6`}
            >
              <Icon className={`w-5 h-5 ${tier.iconColor}`} />
            </div>

            {/* Name & Description */}
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{tier.name}</h3>
            <p className="text-sm text-[#777] mb-6 leading-relaxed">
              {tier.description}
            </p>

            {/* Divider */}
            <div className="border-t border-[#1e1e28] mb-6" />

            {/* Tier Benefits */}
            <h4 className="text-base font-bold text-white mb-4">Tier Benefits</h4>
            <ul className="space-y-3">
              {tier.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#bbb] leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>
          </m.div>
        );
      })}
    </m.div>
  );
};

export default CustomerTierCards;
