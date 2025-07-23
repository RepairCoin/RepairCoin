'use client';

import { ReactElement } from "react";
import Image, { ImageProps } from "next/image";

interface StepCardProps {
  title: string;
  description: string;
  icon: ReactElement<ImageProps>;
}

const StepCard = ({ title, description, icon }: StepCardProps) => {
  return (
    <div className="flex flex-col w-full h-full items-center">
      <div className="bg-[#101010] w-full rounded-2xl border-1 border-gray-500 p-6 h-full flex flex-row items-center justify-center text-center shadow-md gap-10">
        <div className="flex flex-col gap-6 w-full h-full">
          <h3 className="text-xl md:text-2xl font-semibold text-left text-[#FFCC00] mb-2">
            {title}
          </h3>
          <p className="text-gray-300 text-sm md:text-base text-left">{description}</p>
        </div>
        <div className="flex justify-center items-center w-full h-full">
          <div className="relative">{icon}</div>
        </div>
      </div>
    </div>
  );
};

export default StepCard;
