"use client";

import StepCard from "@/components/StepCard";
import React from "react";

const WhyRepairCoin: React.FC<any> = () => {
  return (
    <div className="w-full flex flex-col items-center gap-6 mt-12 md:mt-40">
      <div className="w-full flex flex-col  items-center md:gap-6 gap-4">
        <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
          Why RepairCoin?
        </p>
        <p className="text-[#FFCC00] text-base md:text-lg tracking-wide">
          Fix it. Earn it. Power the Repair Economy.
        </p>
      </div>
      <div className="w-full mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {[
            {
              title: "Get Rewarded for What You’re Already Doing",
              description:
                "Every time you repair your phone, laptop, or device at a partner shop, you earn RepairCoin — a crypto token with real-world value.",
              icon: <img src="/img/reward.png" alt="Repair" />,
            },
            {
              title: "Loyalty That Pays You Back",
              description: "Unlike generic points or coupons, RepairCoin is a blockchain-backed token that can grow in value, be traded, or used for discounts and perks.",
              icon: <img src="/img/loyalty.png" alt="Earn" />,
            },
            {
              title: "Support Local. Earn Global.",
              description:
                "When you use RepairCoin, you’re not just earning crypto — you’re empowering local repair businesses while tapping into a global digital economy.",
              icon: <img src="/img/repair.png" alt="Redeem" />,
            },
            {
              title: "Sustainable & Smart Choice",
              description:
                "Choosing to repair your devices instead of replacing them helps the planet. RepairCoin rewards eco-conscious behavior with smart, tech-forward incentives that benefit everyone.",
              icon: <img src="/img/sustain.png" alt="Redeem" />,
            },
          ].map((step, index) => (
            <div key={index} className="w-full h-full">
              <StepCard
                title={step.title}
                description={step.description}
                icon={step.icon}
                whyRepairCoin={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhyRepairCoin;
