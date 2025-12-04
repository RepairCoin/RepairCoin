"use client";

import { Store, CheckCircle } from "lucide-react";

interface ShopTier {
  name: string;
  overview: string;
  benefits: string[];
  whoFor: string;
  badgeColor: string;
  badgeTextColor: string;
}

const shopTiers: ShopTier[] = [
  {
    name: "Standard Tier",
    overview:
      "Standard Tier lets any shop plug into the RepairCoin network instantly — no staking, no commitment. Start offering rewards, track customer activity automatically, and test the loyalty system with zero risk. Ideal for small shops and solo techs getting started.",
    benefits: [
      "No RCG required so you can start instantly",
      "Pay $0.10 per RCN at the Standard shop rate",
      "Customer redemption value fixed at $0.10 per RCN",
      "Redemption cap up to $50 RCN per customer per visit",
      "Use all core loyalty tools and QR based redemptions",
      "Issue RCN Rewards to customers on small, medium and large repairs",
    ],
    whoFor:
      "Shops that want a simple, low risk way to start rewarding customers, collect data, and improve retention without changing their current operations too much.",
    badgeColor: "bg-[#999999]",
    badgeTextColor: "text-[#101010]",
  },
  {
    name: "Premium Tier",
    overview:
      "Premium Tier is designed for growing shops that want more value from every visit. By staking RCG you unlock better RCN pricing, higher redemption caps, and stronger loyalty incentives that keep customers coming back more often.",
    benefits: [
      "Stake 500 RCG to unlock Premium status",
      "Pay $0.08 per RCN with improved shop pricing",
      "Customer redemption value still fixed at $0.10 per RCN",
      "Redemption cap up to $75 RCN per customer per visit",
      "Automatic Premium bonus of +2 RCN added to each reward",
      "Issue RCN Rewards to customers on small, medium and large repairs",
    ],
    whoFor:
      "Shops that are ready to scale, want a better return on every dollar spent on rewards, and are building a loyal base of recurring customers.",
    badgeColor: "bg-[#DDDDDD]",
    badgeTextColor: "text-[#101010]",
  },
  {
    name: "Elite Tier",
    overview:
      "Elite Tier is for top performing shops that want the strongest loyalty engine possible. You get the lowest RCN cost, the highest redemption caps, and the biggest tier bonuses so you can turn every repair into long term customer value.",
    benefits: [
      "Stake 1500 RCG to unlock Elite status",
      "Pay $0.06 per RCN at the best shop rate",
      "Customer redemption value still fixed at $0.10 per RCN",
      "Redemption cap up to $100 RCN per customer per visit",
      "Automatic Elite bonus of +5 RCN added to each reward",
      "Issue RCN Rewards to customers on small, medium and large repairs",
    ],
    whoFor:
      "High volume repair shops, clinics, and service businesses that treat loyalty as a core growth strategy and want maximum leverage from the RepairCoin ecosystem.",
    badgeColor: "bg-[#FFCC00]",
    badgeTextColor: "text-[#101010]",
  },
];

const ShopTierCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {shopTiers.map((tier) => (
        <div
          key={tier.name}
          className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 md:p-8 flex flex-col hover:border-[#ffcc00]/30 transition-all duration-300"
        >
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-1.5 ${tier.badgeColor} px-3 py-1.5 rounded-full w-fit mb-6`}
          >
            <Store className={`w-5 h-5 ${tier.badgeTextColor}`} />
            <span className={`text-sm font-medium ${tier.badgeTextColor}`}>
              {tier.name}
            </span>
          </div>

          {/* Overview Section */}
          <div className="mb-6">
            <h4 className="text-base font-bold text-white mb-3">Overview</h4>
            <p className="text-sm text-white leading-relaxed text-justify">
              {tier.overview}
            </p>
          </div>

          {/* Key Benefits Section */}
          <div className="mb-6">
            <h4 className="text-base font-bold text-white mb-4">Key Benefits</h4>
            <ul className="space-y-3">
              {tier.benefits.map((benefit, benefitIndex) => (
                <li key={benefitIndex} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Separator */}
          <div className="border-t border-[rgba(83,83,83,0.21)] my-6" />

          {/* Who It Is For Section */}
          <div className="mt-auto">
            <h4 className="text-base font-bold text-white mb-3">Who It Is For</h4>
            <p className="text-sm text-[#979797] leading-relaxed text-justify">
              {tier.whoFor}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShopTierCards;
