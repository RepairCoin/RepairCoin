"use client";

import React from "react";
import Section from "@/components/Section";

interface FindARepairCoinProps {
  chainBgImage: string;
}

const FindARepairCoin: React.FC<FindARepairCoinProps> = ({ chainBgImage }) => {
  return (
    <div
      className="w-full h-screen md:h-[70vh] xl:h-screen"
      style={{ backgroundImage: `url(${chainBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-row justify-between items-center py-8 xl:py-20 gap-34">
          <div className="w-1/2 flex flex-col">
            <div className="w-full flex flex-col items-center">
              <p className="md:text-5xl text-3xl font-bold text-white mb-6">
                Find a RepairCoin Partner Near You
              </p>
              <p className="text-white text-xs md:text-base mb-10">
                Looking to earn RepairCoin?  Just search for a trusted repair
                shop near you.  Get your device fixed and earn crypto rewards
                instantly — no extra steps needed.
              </p>
            </div>
            <button className="bg-[#FFCC00] text-black w-1/3 py-2 md:py-4 px-4 md:px-6 rounded-full font-semibold text-sm md:text-base text-center">
              Search Shops <span className="ml-2 text-sm md:text-lg">→</span>
            </button>
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center">
            <img src="/gps.png" alt="" />
          </div>
        </div>
      </Section>
    </div>
  );
};

export default FindARepairCoin;
