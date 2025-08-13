import React from "react";

const WhatWeDo: React.FC<any> = () => {
  return (
    <div className="w-full flex flex-col items-center gap-14 md:px-24">
      <div className="w-full flex flex-col md:gap-6 gap-4">
        <p className="text-3xl md:text-5xl md:text-center font-bold text-white tracking-wide">
          What We Do?
        </p>
        <p className="text-[#FFCC00] md:text-center text-sm md:text-lg tracking-wide">
          We connect customers and repair shops through smart, token-based
          loyalty.
        </p>
      </div>
      <div className="w-full grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-8">
        <div className="rounded-2xl items-center overflow-hidden flex-1 flex flex-col gap-6">
          <img
            src="/img/whatWeDo1.png"
            alt="Repair shop owner working"
            className="w-full object-cover"
          />
          <p className="text-white text-xs md:text-base font-light tracking-wide px-2">RepairCoin is a crypto-based rewards system built for the tech repair industry.</p>
        </div>
        <div className="rounded-2xl items-center overflow-hidden flex-1 flex flex-col gap-6">
          <img
            src="/img/whatWeDo4.png"
            alt="Shop owner with tools"
            className="w-full object-cover"
          />
          <p className="text-white text-xs md:text-base font-light tracking-wide px-2">Customers earn  and redeem RepairCoin tokens when they use participating shops.</p>
        </div>
        <div className="rounded-2xl items-center overflow-hidden flex-1 flex flex-col gap-6">
          <img
            src="/img/whatWeDo3.png"
            alt="Repair shop interior"
            className="w-full object-cover"
          />  
          <p className="text-white text-xs md:text-base font-light tracking-wide px-2">They can redeem tokens for discounts, products, or perks.</p>
        </div>
        <div className="rounded-2xl items-center overflow-hidden flex-1 flex flex-col gap-6">
          <img
            src="/img/whatWeDo2.png"
            alt="Repair shop interior"
            className="w-full object-cover"
          />
          <p className="text-white text-xs md:text-base font-light tracking-wide px-2">Shops benefit from loyalty, visibility, and co-branded marketing.</p>
        </div>
      </div>
    </div>
  );
};

export default WhatWeDo;
