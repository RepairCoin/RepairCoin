"use client";

import { Coins, Shield, CheckCircle, SparklesIcon } from "lucide-react";

const rcnPoints = [
  { label: "Value", value: "1 RCN = $0.10 USD" },
  { label: "Purpose", value: "Customer rewards and redemptions" },
  { label: "Earning", value: "1 RCN per $10 spent on repairs" },
  { label: "Usage", value: "100% value at earning shop, 20% elsewhere" },
  { label: "Tiers", value: "Bonus tokens for Silver (+2) and Gold (+5) customers" },
];

const rcgPoints = [
  { label: "Supply", value: "100M fixed supply" },
  { label: "Purpose", value: "Shop tier benefits and governance" },
  { label: "Tiers", value: "Standard/Premium/Elite (10K/50K/200K+ RCG)" },
  { label: "Benefits", value: "Better RCN pricing for shops" },
  { label: "Revenue", value: "10% to stakers, 10% to DAO" },
];

const CustomerDualToken = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-[#ffcc00] bg-gradient-to-r from-[#ffcc00]/10 to-transparent text-[#ffcc00] mb-6">
          <SparklesIcon size={16} className="text-[#ffcc00]" />
          <span className="text-sm font-medium">Reward &amp; Governance Model</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Dual-Token Business Model
        </h2>
        <p className="text-[#666] text-base">
          Built for stability, sustainable growth, and real-world use.
        </p>
      </div>

      {/* Token Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RCN Utility Tokens */}
        <div className="border border-[#2a2a2a] rounded-2xl p-6"
          style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}>
          <div className="w-12 h-12 rounded-full bg-[#FFCC00] flex items-center justify-center mb-4">
            <Coins className="w-6 h-6 text-black" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">RCN Utility Tokens</h3>
          <p className="text-sm text-[#777] mb-6">Earn it. Use it. Redeem it with ease.</p>
          <ul className="space-y-3">
            {rcnPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#bbb] leading-relaxed">
                  <span className="font-semibold text-white">{point.label}:</span>{" "}
                  {point.value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* RCG Governance Tokens */}
        <div className="border border-[#2a2a2a] rounded-2xl p-6"
          style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}>
          <div className="w-12 h-12 rounded-full bg-[#FFCC00] flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">RCG Governance Tokens</h3>
          <p className="text-sm text-[#777] mb-6">
            Structured for effective governance and sustainable long-term value.
          </p>
          <ul className="space-y-3">
            {rcgPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#bbb] leading-relaxed">
                  <span className="font-semibold text-white">{point.label}:</span>{" "}
                  {point.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default CustomerDualToken;
