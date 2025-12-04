"use client";

import { MessageCircleQuestion } from "lucide-react";

interface TierInfoSectionProps {
  activeTab: "customers" | "shops";
}

const customerInfo = {
  title: "How customer tiers are typically determined",
  points: [
    {
      highlight: "Activity-based:",
      text: "your tier may be influenced by how often you repair, purchase, and redeem using RCN.",
    },
    {
      highlight: "Governance-driven:",
      text: "exact rules are defined and updated through RCG governance to keep rewards fair and sustainable.",
    },
    {
      highlight: "Transparent:",
      text: "all rules are visible inside the RepairCoin app, so you always know how to level up.",
    },
  ],
};

const shopInfo = {
  title: "How shop tiers work",
  points: [
    {
      highlight: "",
      text: "Tiers define a shop's RCN issuance rate, analytics access, and governance privileges.",
    },
    {
      highlight: "",
      text: "Standard requires no RCG staking, making it ideal for shops testing the system.",
    },
    {
      highlight: "",
      text: "Premium unlocks improved RCN costs and access to deeper customer insights.",
    },
    {
      highlight: "",
      text: "Elite gives shops the best RCN economics, advanced tools, and access to governance-based perks.",
    },
    {
      highlight: "",
      text: "No matter the tier, every shop can start issuing RCN and tracking customer activity from day one.",
    },
  ],
};

const TierInfoSection: React.FC<TierInfoSectionProps> = ({ activeTab }) => {
  const info = activeTab === "customers" ? customerInfo : shopInfo;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-[#FFCC00] blur-md opacity-50 rounded-lg" />
            <div className="relative p-2 rounded-lg bg-[#FFCC00]">
              <MessageCircleQuestion className="w-5 h-5 text-[#101010]" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-white">{info.title}</h3>
        </div>

        {/* Bullet points */}
        <ul className="space-y-4 ml-2">
          {info.points.map((point, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="text-[#FFCC00] text-lg mt-0.5">•</span>
              <p className="text-sm text-white leading-relaxed">
                {point.highlight && (
                  <span className="font-bold">{point.highlight} </span>
                )}
                {point.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TierInfoSection;
