"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import {
  Gift,
  UserPlus,
  Trophy,
  Users,
  Wallet,
  Check,
  LucideIcon,
} from "lucide-react";
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

interface JourneyStep {
  label: string;
  image: string;
  alt: string;
  notificationTitle: string;
  notificationBody: string;
}

const journey: JourneyStep[] = [
  {
    label: "Customer Books",
    image: "/img/landingv4/loyalty/journey-1-books.png",
    alt: "Customer booking a service on a laptop",
    notificationTitle: "Booking Confirmed",
    notificationBody: "Your booking is confirmed! See you soon!",
  },
  {
    label: "Business Delivers",
    image: "/img/landingv4/loyalty/journey-2-delivers.png",
    alt: "Business owner completing a service at the counter",
    notificationTitle: "Service Completed",
    notificationBody: "Your device is ready. Thanks for trusting us!",
  },
  {
    label: "Customer gets rewarded",
    image: "/img/landingv4/loyalty/journey-3-rewarded.png",
    alt: "Customer checking earned reward points on a phone",
    notificationTitle: "Points Rewarded!",
    notificationBody: "You earned points for your recent service.",
  },
  {
    label: "Customer refers a friend",
    image: "/img/landingv4/loyalty/journey-4-referral.png",
    alt: "Customer sharing a referral with a friend",
    notificationTitle: "Referral Reward Earned",
    notificationBody: "You and your friend both earned 50 points.",
  },
  {
    label: "Customer returns",
    image: "/img/landingv4/loyalty/journey-5-returns.png",
    alt: "Returning customer greeted at a service shop",
    notificationTitle: "Welcome Back!",
    notificationBody: "Great to see you again! You have reached Gold Tier",
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
        <div className="flex flex-col items-center text-center">
          <m.div {...fadeUp(0)}>
            <Badge label="Turn Visits Into Loyalty" />
          </m.div>

          <m.h2
            {...fadeUp(0.1)}
            className="mt-6 font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight text-balance"
          >
            Turn First-Time Customers Into Regulars
          </m.h2>

          <m.p
            {...fadeUp(0.15)}
            className="mt-4 text-gray-400 text-base sm:text-lg max-w-3xl"
          >
            Create memorable customer experiences with a loyalty program that
            rewards every visit, encourages referrals, and builds lasting
            relationships that grow your business.
          </m.p>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="flex flex-col gap-3">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <m.div
                  key={item.title}
                  {...fadeUp(0.1 + index * 0.05)}
                  className="flex flex-1 items-center gap-4 border border-white/10 bg-white/[0.02] px-5 py-4 transition-colors duration-300 hover:border-white/20"
                >
                  <span className="flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-full bg-[#F7CC00] text-black">
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

          <m.div
            {...fadeUp(0.2)}
            className="relative aspect-[4/3] lg:aspect-auto lg:min-h-full rounded-2xl overflow-hidden border border-white/10"
          >
            <Image
              src="/img/landingv4/loyalty/loyalty-main.png"
              alt="Shop owner handing a repaired device to a happy customer"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </m.div>
        </div>

        {/* ── The Loyalty Journey ── */}
        <div className="mt-20 lg:mt-24">
          <m.h3
            {...fadeUp(0)}
            className="text-center font-bold text-white text-2xl sm:text-3xl tracking-tight"
          >
            The Loyalty Journey with FixFlow
          </m.h3>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {journey.map((step, index) => (
              <m.div key={step.label} {...fadeUp(0.05 * index)}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full bg-[#F7CC00] text-black text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-white text-xs sm:text-sm font-medium">
                    {step.label}
                  </span>
                </div>

                <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={step.image}
                      alt={step.alt}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="relative -mt-10 rounded-t-xl bg-white p-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full bg-[#F7CC00]">
                        <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                      </span>
                      <div>
                        <p className="text-black font-semibold text-xs leading-snug">
                          {step.notificationTitle}
                        </p>
                        <p className="mt-1 text-gray-600 text-[11px] leading-snug">
                          {step.notificationBody}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
