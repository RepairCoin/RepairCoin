"use client";

import React from "react";
import Image from "next/image";
import SectionBadge from "@/components/about/SectionBadge";

const cards = [
  {
    image: "/img/landingv2/howrepaircoinworks-card1.png",
    title: "A service is completed like any other transaction.",
    description: "RepairCoin works quietly in the background.",
  },
  {
    image: "/img/landingv2/howrepaircoinworks-card2.png",
    title: "Rewards are automatically added after the service.",
    description:
      "Both businesses and customers can trust that every reward is accurately tracked.",
  },
  {
    image: "/img/landingv2/howrepaircoinworks-card3.png",
    title: "Customers use their rewards across the RepairCoin network.",
    description: "More reasons to return and explore other shops.",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative bg-[#0a0a0a] py-12 sm:py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-16">
          <div className="flex justify-center">
            <SectionBadge label="From Service to Rewards" />
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
            How RepairCoin Works
          </h2>

          <p className="text-gray-400 italic max-w-lg mx-auto">
            No extra steps. No complexity. Just smarter rewards.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card, index) => (
            <div
              key={index}
              className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800/50 transition-transform duration-300 hover:scale-[1.02]"
            >
              <div className="relative h-56 sm:h-64">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 text-center">
                <h3 className="text-white font-semibold text-base leading-snug">
                  {card.title}
                </h3>
                <div className="w-full h-px bg-gray-700 my-4" />
                <p className="text-gray-400 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
