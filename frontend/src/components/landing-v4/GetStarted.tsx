"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import Badge from "./Badge";

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: "Join FixFlow",
    description:
      "Create your FixFlow account and access your all-in-one business platform.",
  },
  {
    title: "Set Up Your Brand",
    description:
      "Create a professional brand with custom logos, colors, profiles, and marketing tools—all in one place.",
  },
  {
    title: "Set Up Your Business",
    description:
      "Set up your shop, services, team, scheduling options, and customer engagement tools.",
  },
  {
    title: "Start Growing With AI",
    description:
      "Put AI to work with automation, customer engagement, rewards, and insights.",
  },
];

export default function GetStarted() {
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
            <Badge label="Get Started In Minutes" />
          </m.div>

          <m.h2
            {...fadeUp(0.1)}
            className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight"
          >
            Start Growing With FixFlow AI
          </m.h2>

          <m.p
            {...fadeUp(0.15)}
            className="mt-4 text-gray-400 text-base sm:text-lg max-w-2xl"
          >
            Everything you need to manage, grow, and automate your
            business—without the complexity.
          </m.p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch">
          <div className="divide-y divide-white/10 bg-white/[0.03] border border-white/5">
            {steps.map((step, index) => (
              <m.div
                key={step.title}
                {...fadeUp(0.1 + index * 0.05)}
                className="flex items-start gap-5 py-7 px-6"
              >
                <span className="flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-full bg-[#1c1c1c] text-[#F7CC00] font-semibold text-lg">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-white font-semibold text-xl">{step.title}</h3>
                  <p className="mt-2 text-gray-400 text-sm sm:text-base leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </m.div>
            ))}
          </div>

          <m.div
            {...fadeUp(0.2)}
            className="relative rounded-2xl overflow-hidden border border-white/10 min-h-[360px] lg:min-h-0"
          >
            <Image
              src="/img/landingv4/getstarted-showcase.png"
              alt="FixFlow platform"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </m.div>
        </div>
      </div>
    </section>
  );
}
