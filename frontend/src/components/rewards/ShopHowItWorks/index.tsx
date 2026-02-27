"use client";

import { MessageCircle, CheckCircle } from "lucide-react";

const points = [
  "Tiers define a shop's RCN issuance rate, analytics access, and governance privileges.",
  "Standard Tier requires no RCG staking, making it ideal for shops testing the system.",
  "Premium unlocks improved RCN costs and access to deeper customer insights.",
  "Elite gives shops the best RCN economics, advanced tools, and access to governance-based perks.",
  "No matter the tier, every shop can start issuing RCN and tracking customer activity from day one.",
];

const ShopHowItWorks = () => {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-16">
      <div
        className="border border-[#2a2a2a] rounded-2xl p-5 md:p-8"
        style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-7">
          <div className="w-12 h-12 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1.5">How it works</h3>
            <p className="text-sm text-[#777] leading-relaxed">
              Shops purchase RCN at their tier rate and issue rewards after service completion.
              Customers redeem at a fixed $0.10 value per RCN — simple, consistent, and easy to
              explain.
            </p>
          </div>
        </div>

        {/* Points */}
        <ul className="space-y-3">
          {points.map((point, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-white leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ShopHowItWorks;
