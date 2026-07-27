"use client";

import { HelpCircle } from "lucide-react";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";

const columns = [
  {
    title: "Activity-Based",
    description:
      "Your tier progresses based on how often you use partner services and interact using RCN.",
  },
  {
    title: "Governance-Defined",
    description:
      "Tier rules are structured and updated through RCG governance to ensure fairness and long-term sustainability.",
  },
  {
    title: "Fully Transparent",
    description:
      "All requirements are visible inside the app, so you always know what it takes to level up.",
  },
];

const CustomerHowTiersWork = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-16">
      <AnimateOnScroll>
        <div
          className="card-hover-glow border border-[#2a2a2a] rounded-2xl p-5 md:p-8"
          style={{
            background:
              "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)",
          }}
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-9 h-9 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-black" />
            </div>

            {/* Header + three columns, aligned to the title text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white mb-1.5">
                How Customer Tiers Are Determined
              </h3>
              <p className="text-sm text-[#777] leading-relaxed">
                Your tier reflects your activity and engagement across the RepairCoin network.
              </p>

              <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {columns.map((col, i) => (
                  <m.div key={i} variants={staggerItem} transition={{ duration: 0.5 }}>
                    <h4 className="text-sm font-bold text-white mb-2">{col.title}</h4>
                    <p className="text-sm text-[#777] leading-relaxed">{col.description}</p>
                  </m.div>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </div>
      </AnimateOnScroll>
    </section>
  );
};

export default CustomerHowTiersWork;
