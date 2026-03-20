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
      "You start here and keep climbing. Every repair begins here with base rewards and full access to the RepairCoin partner network.",
    benefits: [
      "Earn base RCN on every repair and purchase",
      "Access to all verified partner shops",
      "Basic wallet history tracking",
    ],
    icon: Shield,
    iconBg: "bg-[#2a1e10]",
    iconColor: "text-[#CD7F32]",
  },
  {
    name: "Silver",
    description:
      "Boost your tier by staying active. Earn higher multipliers and get early access to promotions across the network.",
    benefits: [
      "Boosted RCN rewards on eligible services",
      "Occasional promo multipliers at select shops",
      "Priority access to limited-time campaigns",
    ],
    icon: Sparkles,
    iconBg: "bg-[#1e1e1e]",
    iconColor: "text-[#C0C0C0]",
  },
  {
    name: "Gold",
    description:
      "The highest tier for your most loyal activity. Earn maximum rewards, exclusive benefits, and priority access across the entire network.",
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
              className={`w-14 h-14 rounded-full ${tier.iconBg} flex items-center justify-center mb-6`}
            >
              <Icon className={`w-7 h-7 ${tier.iconColor}`} />
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
