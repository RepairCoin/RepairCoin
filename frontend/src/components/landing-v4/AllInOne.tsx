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
    icon: <CalendarClock className="w-7 h-7" />,
  },
  {
    title: "Customer CRM",
    description:
      "Build stronger customer relationships with a complete view of every conversation, booking, and purchase.",
    icon: <SquareUserRound className="w-7 h-7" />,
  },
  {
    title: "AI Marketing",
    description:
      "Create smarter campaigns, generate content faster, and reach the right customers with AI-powered marketing.",
    icon: <Megaphone className="w-7 h-7" />,
  },
  {
    title: "Rewards Hub",
    description:
      "Reward loyal customers, encourage referrals, and turn every visit into a reason to come back.",
    icon: <Gift className="w-7 h-7" />,
  },
  {
    title: "Business Insights",
    description:
      "Turn your business data into actionable insights with real-time analytics, trends, and AI-powered recommendations.",
    icon: <ChartColumnIncreasing className="w-7 h-7" />,
  },
  {
    title: "AI Lead Assistant",
    description:
      "Capture, qualify, and engage potential customers automatically with an AI assistant that never misses an opportunity.",
    icon: <FunnelPlus className="w-7 h-7" />,
  },
];

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
            className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight"
          >
            Everything Your Business Needs, All in One Place
          </m.h2>

          <m.p
            {...fadeUp(0.15)}
            className="mt-4 text-gray-400 text-base sm:text-lg max-w-2xl"
          >
            Appointments, marketing, customer management, rewards, analytics, and
            AI shouldn&apos;t be scattered across multiple platforms.
          </m.p>
        </div>

        <div className="relative mt-16 max-w-[1060px] mx-auto border border-white/[0.06] overflow-hidden">
          <div className="relative grid grid-cols-1 md:grid-cols-3 divide-x divide-y divide-white/[0.06] [&>*]:border-white/[0.06]">
            {features.map((feature, index) => (
              <m.div
                key={feature.title}
                {...fadeUp(0.05 * (index % 3))}
                className="p-10 min-h-[480px] flex flex-col justify-center bg-[linear-gradient(to_bottom_right,#0a0a0a_30%,rgba(133,110,40,0.55))]"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[#F7CC00] text-black">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-white font-semibold text-[30px] leading-snug">
                  {feature.title}
                </h3>
                <p className="mt-3 text-gray-400 text-[1.25rem] leading-relaxed min-h-[160px]">
                  {feature.description}
                </p>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
