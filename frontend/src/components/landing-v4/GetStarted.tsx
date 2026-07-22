"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useModalStore } from "@/stores/modalStore";
import Badge from "./Badge";

interface Benefit {
  title: string;
  description: string;
}

const benefits: Benefit[] = [
  {
    title: "Grow Your Business",
    description: "Turn more visitors into loyal, repeat customers.",
  },
  {
    title: "Save Time With AI",
    description: "Automate everyday tasks and focus on what matters.",
  },
  {
    title: "Build Stronger Relationships",
    description: "Keep customers engaged before and after every visit.",
  },
  {
    title: "Everything in One Platform",
    description: "Manage your business without switching between multiple tools.",
  },
];

export default function GetStarted() {
  const prefersReducedMotion = useReducedMotion();
  const { openWelcomeModal } = useModalStore();

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
        <m.div {...fadeUp(0)}>
          <Badge label="YOUR GROWTH, OUR MISSION" />
        </m.div>

        <m.h2
          {...fadeUp(0.1)}
          className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight"
        >
          Start Growing With FixFlow AI
        </m.h2>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <m.p
              {...fadeUp(0.15)}
              className="text-gray-400 text-base sm:text-lg max-w-xl"
            >
              Everything your business needs to attract more customers,
              streamline daily operations, and build lasting relationships, all
              powered by one intelligent platform.
            </m.p>

            <div className="mt-8 space-y-6">
              {benefits.map((benefit, index) => (
                <m.div
                  key={benefit.title}
                  {...fadeUp(0.2 + index * 0.05)}
                  className="flex items-start gap-3"
                >
                  <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full bg-[#F7CC00]">
                    <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                  </span>
                  <div>
                    <h3 className="text-white font-semibold text-base">
                      {benefit.title}
                    </h3>
                    <p className="mt-1 text-gray-400 text-sm">
                      {benefit.description}
                    </p>
                  </div>
                </m.div>
              ))}
            </div>

            <m.div {...fadeUp(0.45)} className="mt-10">
              <button
                onClick={openWelcomeModal}
                className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Start Free Today
              </button>
            </m.div>
          </div>

          <m.div
            {...fadeUp(0.2)}
            className="relative aspect-[5/4] rounded-2xl overflow-hidden border border-white/10"
          >
            <Image
              src="/img/landingv4/getstarted-showcase.png"
              alt="Business owner surrounded by FixFlow performance insights"
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
