"use client";

import Section from "@/components/Section";
import React, { ReactElement } from "react";
import Image, { ImageProps } from "next/image";

interface StepCardProps {
  title: string;
  description: string;
  icon: ReactElement<ImageProps>;
}

const StepCard = ({ title, description, icon }: StepCardProps) => (
  <div className="flex flex-col h-full items-center">
    <div className="bg-[#101010] rounded-2xl border-1 border-gray-500 p-6 h-full flex flex-row items-center justify-center text-center shadow-md gap-10">
      <div className="flex flex-col h-full">
        <h3 className="text-xl font-semibold text-left text-[#FFCC00] mb-2">{title}</h3>
        <p className="text-gray-300 text-sm text-left">{description}</p>
      </div>
      <div className="w-1/3 flex justify-center items-center h-full">
        <div className="relative w-24 h-24">{icon}</div>
      </div>
    </div>
  </div>
);

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

interface HowRepairCoinWorksProps {
  techBgImage: string;
}

const HowRepairCoinWorks: React.FC<HowRepairCoinWorksProps> = ({
  techBgImage,
}) => {
  return (
    <div
      className="w-full border-2"
      style={{ backgroundImage: `url(${techBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-col justify-between items-center py-8 xl:py-10">
          <div className="w-full md:w-1/2 flex flex-col border-2 items-center gap-6">
            <p className="text-[#FFCC00] text-sm md:text-lg tracking-wide">
              Fix it. Earn it. Power the Repair Economy.
            </p>
            <p className="md:text-5xl text-3xl font-bold text-white tracking-wide">
              How RepairCoin Works
            </p>
            <p className="text-white text-xs md:text-base mb-6 w-3/4 text-center tracking-wide">
              Amet minim mollit non deserunt ullamco est sit aliqua dolor do
              amet sint. Velit officia consequat duis enim velit mollit.
              Exercitation veniam consequat sunt nostrud amet.
            </p>
          </div>
          <div className="w-[90%] flex flex-col md:flex-row items-center justify-center gap-8 mt-12">
            {[
              {
                title: "Repair",
                description:
                  "Visit a participating repair shop for your phone, device or avail any repair services.",
                icon: <img src="/repair.png" alt="" />,
              },
              {
                title: "Earn",
                description: "Receive RepairCoin as a reward for every repair.",
                icon: <img src="/redeem.png" alt="" />,

              },
              {
                title: "Redeem",
                description:
                  "Receive exciting rewards from our system. Trade other currencies from the market.",
                icon: <img src="/earn.png" alt="" />,
              },
            ].map((step, index, array) => (
              <React.Fragment key={index}>
                <div className="flex w-full h-[25vh] gap-10">
                  <StepCard
                    title={step.title}
                    description={step.description}
                    icon={step.icon}
                  />
                </div>
                {index < array.length - 1 && (
                  <div className="border-1 rounded-full p-2">
                    <ArrowIcon />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
};

export default HowRepairCoinWorks;
