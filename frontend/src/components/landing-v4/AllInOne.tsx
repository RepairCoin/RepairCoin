"use client";

import React from "react";
import { m, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  SquareUserRound,
  Megaphone,
  Gift,
  ChartColumnIncreasing,
  FunnelPlus,
  Check,
} from "lucide-react";
import Badge from "./Badge";

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    title: "Smart Bookings",
    description:
      "Let customers book effortlessly while you manage every appointment in one place.",
    icon: <CalendarClock className="w-5 h-5" />,
  },
  {
    title: "Customer CRM",
    description:
      "Build stronger customer relationships with a complete view of every conversation, booking, and purchase.",
    icon: <SquareUserRound className="w-5 h-5" />,
  },
  {
    title: "AI Marketing",
    description:
      "Create smarter campaigns, generate content faster, and reach the right customers with AI-powered marketing.",
    icon: <Megaphone className="w-5 h-5" />,
  },
  {
    title: "Rewards Hub",
    description:
      "Reward loyal customers, encourage referrals, and turn every visit into a reason to come back.",
    icon: <Gift className="w-5 h-5" />,
  },
  {
    title: "Business Insights",
    description:
      "Turn your business data into actionable insights with real-time analytics, trends, and AI-powered recommendations.",
    icon: <ChartColumnIncreasing className="w-5 h-5" />,
  },
  {
    title: "AI Lead Assistant",
    description:
      "Capture, qualify, and engage potential customers automatically with an AI assistant that never misses an opportunity.",
    icon: <FunnelPlus className="w-5 h-5" />,
  },
];

const outcomes: string[] = [
  "Spend less time managing tasks and more time growing your business.",
  "Create lasting customer relationships through smarter engagement.",
  "Turn AI insights into better decisions and measurable business growth.",
  "Everything you need to run your business, working together seamlessly.",
];

const cardClass = [
  "rounded-2xl p-6 sm:p-7",
  "border border-white/[0.07]",
  "bg-[linear-gradient(150deg,#161616_0%,#0f0f0f_55%,#121212_100%)]",
  "transition-colors duration-200 hover:border-white/[0.14]",
].join(" ");

export default function AllInOne() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 24 },
    whileInView: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.5, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative bg-[#0a0a0a] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto w-full px-4 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <m.div {...fadeUp(0)}>
            <Badge label="All-In-One Business Platform" />
          </m.div>

          <m.h2
            {...fadeUp(0.1)}
            className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight text-balance"
          >
            Everything Your Business Needs, All in One Place
          </m.h2>

          <m.p
            {...fadeUp(0.15)}
            className="mt-4 text-gray-400 text-base sm:text-lg max-w-4xl"
          >
            From bookings and customer management to AI assistance, marketing,
            and rewards, FixFlow helps you spend less time switching between
            tools and more time serving your customers.
          </m.p>
        </div>

        <div className="mt-14 max-w-[1060px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {features.map((feature, index) => (
              <m.div
                key={feature.title}
                {...fadeUp(0.05 * (index % 3))}
                className={cardClass}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F7CC00] text-black">
                  {feature.icon}
                </div>
                <h3 className="mt-6 text-white font-semibold text-lg leading-snug">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </m.div>
            ))}
          </div>

          {/* Outcome strip */}
          <m.div
            {...fadeUp(0.2)}
            className="mt-6 lg:mt-8 rounded-2xl border border-white/[0.07] bg-[linear-gradient(150deg,#161616_0%,#0f0f0f_60%,#121212_100%)] p-6 sm:p-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {outcomes.map((outcome) => (
                <div key={outcome} className="flex items-start gap-3">
                  <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#F7CC00] flex-shrink-0">
                    <Check className="w-3 h-3 text-black" strokeWidth={3} />
                  </span>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {outcome}
                  </p>
                </div>
              ))}
            </div>
          </m.div>
        </div>
      </div>
    </section>
  );
}
