"use client";

import { HelpCircle } from "lucide-react";

const columns = [
  {
    title: "Activity-Based",
    description:
      "Your tier progression is based on how often you visit partner services and interact using RCN.",
  },
  {
    title: "Governance-Defined",
    description:
      "The rules and structure are voted and refined through RCG governance to ensure fairness and long-term sustainability.",
  },
  {
    title: "Fully Transparent",
    description:
      "All requirements are visible inside the app so you always know what it takes to level up.",
  },
];

const CustomerHowTiersWork = () => {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-16">
      <div
        className="border border-[#2a2a2a] rounded-2xl p-5 md:p-8"
        style={{
          background:
            "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1.5">
              How Customer Tiers Are Determined
            </h3>
            <p className="text-sm text-[#777] leading-relaxed">
              Your tier reflects your activity and engagement across the RepairCoin network.
            </p>
          </div>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col, i) => (
            <div key={i}>
              <h4 className="text-sm font-bold text-white mb-2">{col.title}</h4>
              <p className="text-sm text-[#777] leading-relaxed">{col.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CustomerHowTiersWork;
