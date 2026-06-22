"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Gift, UserPlus, Trophy, Users, Wallet, LucideIcon } from "lucide-react";
import Badge from "./Badge";

interface LoyaltyItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

const items: LoyaltyItem[] = [
  {
    title: "Points & Rewards",
    description: "Earn points with every successful booking.",
    icon: Gift,
  },
  {
    title: "Referral Program",
    description: "Turn happy customers to branding advocates.",
    icon: UserPlus,
  },
  {
    title: "Tiers",
    description: "Unlock exclusive perks and special benefits.",
    icon: Trophy,
  },
  {
    title: "Customer Retention",
    description: "Build loyalty and increase repeat business.",
    icon: Users,
  },
  {
    title: "Customer Rewards Wallet",
    description: "A simple place for customers to track everything.",
    icon: Wallet,
  },
];

export default function Loyalty() {
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch">
          <div>
            <m.div {...fadeUp(0)}>
              <Badge label="Turn Visits Into Loyalty" />
            </m.div>

            <m.h2
              {...fadeUp(0.1)}
              className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight lg:whitespace-nowrap"
            >
              Keep Customers Coming Back
            </m.h2>

            <m.p
              {...fadeUp(0.15)}
              className="mt-4 text-gray-400 text-base sm:text-lg max-w-xl"
            >
              Reward loyal customers, encourage referrals, and increase repeat
              business with a rewards system built directly into FixFlow.
            </m.p>

            <div className="mt-8 space-y-2">
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <m.div
                    key={item.title}
                    {...fadeUp(0.1 + index * 0.05)}
                    className="flex items-center gap-4 border border-white/10 bg-white/[0.02] px-4 py-3.5 transition-colors duration-300 hover:border-[#F7CC00]/40"
                  >
                    <span className="flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-full bg-[#1c1c1c] border border-[#F7CC00]/30 text-[#F7CC00]">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-white font-semibold text-base">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{item.description}</p>
                    </div>
                  </m.div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            <div aria-hidden className="hidden lg:block invisible">
              <Badge label="Turn Visits Into Loyalty" />
            </div>
            <div
              aria-hidden
              className="hidden lg:block invisible mt-6 font-bold text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight lg:whitespace-nowrap"
            >
              Keep Customers Coming Back
            </div>
            <div
              aria-hidden
              className="hidden lg:block invisible mt-4 text-base sm:text-lg max-w-xl"
            >
              Reward loyal customers, encourage referrals, and increase repeat
              business with a rewards system built directly into FixFlow.
            </div>

            <m.div
              {...fadeUp(0.2)}
              className="relative mt-8 aspect-[4/3] lg:aspect-auto lg:flex-1 rounded-2xl overflow-hidden border border-white/10"
            >
              <Image
                src="/img/landingv4/rewards-showcase.png"
                alt="FixFlow rewards hub"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </m.div>
          </div>
        </div>
      </div>
    </section>
  );
}
