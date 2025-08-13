"use client";

import React from "react";
import StepCard from "@/components/StepCard";

const ArrowIcon = () => (
  <div className="hidden md:flex items-center">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  </div>
);

const HowRepairCoinWorks: React.FC<any> = () => {
  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="w-full flex flex-col  items-center md:gap-6 gap-4">
        <p className="text-[#FFCC00] text-base md:text-lg tracking-wide">
          Fix it. Earn it. Power the Repair Economy.
        </p>
        <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
          How RepairCoin Works
        </p>
        <p className="text-white text-sm md:text-base mb-6 xl:w-1/2 md:w-2/4 text-center tracking-wide">
          RepairCoin rewards customers for choosing repair over replacement. 
          Get repairs at participating shops, earn RCN tokens, and use them 
          for discounts on future services across our growing network of repair businesses.
        </p>
      </div>
      <div className="flex w-full  flex-col md:flex-row items-center justify-center md:gap-8 gap-2 md:mt-12">
        {[
          {
            title: "Repair",
            description:
              "Visit a participating repair shop for your phone, device or avail any repair services.",
            icon: <img src="/img/repair.png" alt="" />,
          },
          {
            title: "Earn",
            description: "Receive RepairCoin as a reward for every repair.",
            icon: <img src="/img/redeem.png" alt="" />,
          },
          {
            title: "Redeem",
            description:
              "Receive exciting rewards from our system. Trade other currencies from the market.",
            icon: <img src="/img/earn.png" alt="" />,
          },
        ].map((step, index, array) => (
          <React.Fragment key={index}>
            <div className="flex w-full h-full gap-10">
              <StepCard
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            </div>
            {index < array.length - 1 && (
              <div className="md:border-1 border-0 rounded-full py-1">
                {/* Mobile: Show SVG */}
                <div className="md:hidden">
                  <svg
                    className="w-10 h-10"
                    viewBox="0 0 60 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <ellipse
                      cx="30"
                      cy="30"
                      rx="30"
                      ry="30"
                      transform="rotate(90 30 30)"
                      fill="#FFCC00"
                    />
                    <path
                      d="M24 27L30 33L36 27"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {/* Desktop: Show ArrowIcon */}
                <div className="hidden md:block">
                  <ArrowIcon />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default HowRepairCoinWorks;
