"use client";

import React from "react";
import Image from "next/image";
import { m } from "framer-motion";
import SectionBadge from "@/components/about/SectionBadge";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import StaggerContainer, { staggerItem } from "@/components/motion/StaggerContainer";

const trustFeatures = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: "Secure by Design",
    description:
      "Rewards are protected using blockchain technology. Making every transaction verifiable and tamper resistant.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
    title: "Transparent & Trackable",
    description:
      "Every reward issued and redeemed is recorded clearly, giving full visibility to both businesses and customers.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Reliable for Everyday Use",
    description:
      "RepairCoin is built for real-world services, with safeguards that ensure rewards remain accurate and dependable.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: "Always in Your Control",
    description:
      "Track balances, view activity, and redeem with full visibility and confidence.",
  },
];

export default function WhosItFor() {
  return (
    <>
      {/* Who It's For Section */}
      <section className="relative bg-[#0a0a0a] py-12 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Header */}
          <AnimateOnScroll>
            <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-16">
              <div className="flex justify-center">
                <SectionBadge label="Who It's For" />
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
                Built for Businesses. Loved by Customers.
              </h2>

              <p className="text-gray-400 italic max-w-xl mx-auto">
                A loyalty system that works seamlessly for both sides of every
                service.
              </p>
            </div>
          </AnimateOnScroll>

          {/* Two Cards */}
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Business Card */}
            <m.div
              variants={staggerItem}
              transition={{ duration: 0.5 }}
              className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800/50 card-hover-glow flex flex-col"
            >
              <div className="relative h-56 sm:h-64">
                <Image
                  src="/img/landingv2/whositsfor-card1.png"
                  alt="For Businesses"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 flex flex-col flex-1 text-center">
                <h3 className="text-white font-semibold text-lg">
                  Turn Everyday Services Into Repeat Business
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mt-3">
                  Reward loyalty automatically, track performance and keep
                  customers coming back with less effort.
                </p>
                <div className="mt-auto pt-5 flex justify-center">
                  <button className="px-6 py-2.5 border border-white text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors">
                    Learn More &rarr;
                  </button>
                </div>
              </div>
            </m.div>

            {/* Customer Card */}
            <m.div
              variants={staggerItem}
              transition={{ duration: 0.5 }}
              className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800/50 card-hover-glow flex flex-col"
            >
              <div className="relative h-56 sm:h-64">
                <Image
                  src="/img/landingv2/whositsfor-card2.png"
                  alt="For Customers"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 flex flex-col flex-1 text-center">
                <h3 className="text-white font-semibold text-lg">
                  Rewards That Move With You
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mt-3">
                  Earn rewards after every visit and redeem them across
                  participating shops.
                </p>
                <div className="mt-auto pt-5 flex justify-center">
                  <button className="px-6 py-2.5 border border-white text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors">
                    Learn More &rarr;
                  </button>
                </div>
              </div>
            </m.div>
          </StaggerContainer>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="relative bg-[#0a0a0a] py-12 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Header */}
          <AnimateOnScroll>
            <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-16">
              <div className="flex justify-center">
                <SectionBadge label="Trust & Security" />
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
                Built on Security. Designed for Confidence.
              </h2>

              <p className="text-gray-400 italic max-w-2xl mx-auto">
                RepairCoin ensures rewards are secure and transparent, giving
                everyone confidence in the system.
              </p>
            </div>
          </AnimateOnScroll>

          {/* Feature Cards */}
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustFeatures.map((feature, index) => (
              <m.div
                key={index}
                variants={staggerItem}
                transition={{ duration: 0.5 }}
                className="relative pt-6 h-full"
              >
                {/* Icon overlapping top of card */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <m.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.3 + index * 0.1,
                    }}
                    className="w-12 h-12 rounded-full bg-[#F7CC00] text-black flex items-center justify-center shadow-lg"
                  >
                    {feature.icon}
                  </m.div>
                </div>
                {/* Card body */}
                <div className="bg-[#1a1a1a] rounded-2xl pt-10 pb-6 px-5 border border-gray-800/50 text-center space-y-3 card-hover-glow h-full">
                  <h3 className="text-white font-semibold text-base">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </m.div>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </>
  );
}
