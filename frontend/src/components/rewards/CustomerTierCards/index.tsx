"use client";

import { Medal, CheckCircle } from "lucide-react";

interface CustomerTier {
  name: string;
  subtitle: string;
  benefits: string[];
  note: string;
  badgeColor: string;
}

const customerTiers: CustomerTier[] = [
  {
    name: "Bronze",
    subtitle: "Starter Rewards",
    benefits: [
      "Earn base RCN on every repair and purchase",
      "Access to all verified partner shops",
      "Basic wallet history tracking",
    ],
    note: "Perfect for new customers just starting to earn.",
    badgeColor: "bg-[#CD7F32]", // Bronze color
  },
  {
    name: "Silver",
    subtitle: "Boosted Earnings",
    benefits: [
      "Boosted RCN rewards on eligible transactions",
      "Occasional promo multipliers at select shops",
      "Priority access to limited-time campaigns",
    ],
    note: "For regulars who visit partner shops more often.",
    badgeColor: "bg-[#C0C0C0]", // Silver color
  },
  {
    name: "Gold",
    subtitle: "Premium Loyalty",
    benefits: [
      "Highest RCN earning rates",
      "Early access to new partner shops and promos",
      "Exclusive Gold-only perks defined by governance",
    ],
    note: "Designed for power users and loyal customers.",
    badgeColor: "bg-[#FFD700]", // Gold color
  },
];

const CustomerTierCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {customerTiers.map((tier) => (
        <div
          key={tier.name}
          className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 md:p-8 hover:border-[#ffcc00]/30 transition-all duration-300"
        >
          {/* Header with icon */}
          <div className="flex items-start gap-4 mb-6">
            <div className="relative">
              <div className={`absolute inset-0 ${tier.badgeColor} blur-md opacity-50 rounded-lg`} />
              <div className={`relative p-2 rounded-lg ${tier.badgeColor}`}>
                <Medal className="w-5 h-5 text-[#101010]" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <p className="text-sm text-[#999999]">{tier.subtitle}</p>
            </div>
          </div>

          {/* Benefits list */}
          <ul className="space-y-4 mb-8">
            {tier.benefits.map((benefit, benefitIndex) => (
              <li key={benefitIndex} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Bottom note */}
          <p className="text-xs text-[#999999] mt-auto">{tier.note}</p>
        </div>
      ))}
    </div>
  );
};

export default CustomerTierCards;
