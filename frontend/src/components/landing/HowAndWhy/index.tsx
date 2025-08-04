"use client";

import Section from "@/components/Section";
import React from "react";
import HowRepairCoinWorks from "./HowRepairCoinWorks";
import WhyRepairCoin from "./WhyRepairCoin";

interface HowAndWhy {
  techBgImage: string;
}

const HowAndWhy: React.FC<HowAndWhy> = ({ techBgImage }) => {
  return (
    <div className="w-full md:pt-10 xl:pt-0 bg-[#0D0D0D]" style={{ backgroundImage: `url(${techBgImage})` }}>
      <Section>
        <div className="w-full flex flex-col justify-between items-center py-8 xl:py-20 gap-34">
          <HowRepairCoinWorks />
          <WhyRepairCoin />
        </div>
      </Section>
    </div>
  );
};

export default HowAndWhy;
