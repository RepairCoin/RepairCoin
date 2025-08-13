'use client';

import { ReactElement } from "react";
import Image, { ImageProps } from "next/image";

interface StepCardProps {
  title: string;
  description: string;
  icon: ReactElement<ImageProps>;
  whyRepairCoin?: boolean;
}

const StepCard = ({ title, description, icon, whyRepairCoin }: StepCardProps) => {
  return (
    <div className="flex flex-col w-full h-full items-center">
      <div className={`bg-[#1a1919] w-full rounded-2xl border-1 border-gray-500 p-6 h-full flex ${whyRepairCoin ? 'flex-col md:flex-row' : 'flex-row'} items-center justify-center text-center shadow-md gap-6 md:gap-10`}>
        <div className={`flex flex-col gap-2 md:gap-6 md:w-2/3 w-full h-full`}>
          <p className={`text-xl ${whyRepairCoin ? 'text-center md:text-left' : 'text-left'} md:text-2xl font-semibold text-[#FFCC00] mb-2 ${whyRepairCoin ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
            {title}
          </p>
          <p className={`text-gray-300 text-sm md:text-base ${whyRepairCoin ? 'text-center md:text-left' : 'text-left'}`}>{description}</p>
        </div>
        <div className="flex justify-center items-center w-1/3 h-full">
          <div className="relative">{icon}</div>
        </div>
      </div>
    </div>
  );
};

export default StepCard;
