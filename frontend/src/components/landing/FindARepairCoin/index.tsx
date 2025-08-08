"use client";

import React from "react";
import Section from "@/components/Section";

interface FindARepairCoinProps {
  chainBgImage: string;
}

const FindARepairCoin: React.FC<FindARepairCoinProps> = ({ chainBgImage }) => {
  return (
    <div
      className="w-full h-[50vh] xl:h-screen bg-[#0D0D0D]"
      style={{ backgroundImage: `url(${chainBgImage})` }}
    >
      <Section>
        <div className="relative w-full flex flex-row justify-between items-center py-8 xl:py-20 gap-34">
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
            {/* <button className="bg-[#FFCC00] text-black py-2 md:py-4 px-4 md:px-6 rounded-full font-semibold text-sm md:text-base text-center w-[200px] md:w-[250px] xl:w-1/3">
              Search Shops <span className="ml-2 text-sm md:text-lg">→</span>
            </button> */}
          </div>
          <div className="absolute left-1/2 md:left-auto md:translate-x-0 md:translate-y-0 md:static w-1/2 flex flex-col items-center justify-center">
            <img src="/img/gps.png" alt="" />
          </div>
        </div>
      </Section>
    </div>
  );
};

export default FindARepairCoin;
