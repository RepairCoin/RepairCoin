"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { Sparkles, Wallet, Zap, Megaphone, UserRound } from "lucide-react";

interface Addon {
  icon: React.ReactNode;
  title: string;
  description: string;
  price: string;
  priceNote: string;
}

const addons: Addon[] = [
  {
    icon: <Wallet className="w-4 h-4" />,
    title: "Payments Processing",
    description: "Accepts payments, in person or online. Simple, secure and powerful.",
    price: "0.5% - 1%",
    priceNote: "per transaction",
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: "AI Usage Overage",
    description: "Additional AI usage beyond you plan limits. Billed based on actual usage.",
    price: "Usage x 3",
    priceNote: "Pay as you Grow",
  },
  {
    icon: <Megaphone className="w-4 h-4" />,
    title: "AI Ads Management",
    description: "Let FixFlow run your ads, create content and deliver more leads.",
    price: "$199 - $999",
    priceNote: "/ month",
  },
  {
    icon: <UserRound className="w-4 h-4" />,
    title: "Agency Program",
    description: "Manage up to 10 client accounts. Add more for just $50 / client.",
    price: "$999 / mo",
    priceNote: "10 Client Accounts",
  },
];

export default function PricingAddons() {
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
    <section className="relative bg-[#0a0a0a] pb-24">
      <div className="relative max-w-7xl mx-auto w-full px-4 lg:px-8">
        <m.div
          {...fadeUp(0)}
          className="rounded-lg bg-[#111111] overflow-hidden shadow-xl ring-1 ring-white/5"
        >
          {/* Yellow header bar */}
          <div className="flex items-center gap-2 bg-[#F7CC00] text-black font-medium px-6 py-3">
            <Sparkles className="w-4 h-4" />
            Addons
          </div>

          {/* White body */}
          <div className="bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
              {/* Addon rows */}
              <div className="w-fit divide-y divide-gray-200">
                {addons.map((addon) => (
                  <div
                    key={addon.title}
                    className="flex items-start gap-4 px-6 py-6"
                  >
                    <span className="flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-full bg-[#F7CC00] text-black">
                      {addon.icon}
                    </span>

                    <div className="flex-shrink-0 w-[300px]">
                      <h3 className="text-gray-900 font-bold text-[24px]">
                        {addon.title}
                      </h3>
                      <p className="mt-1 text-gray-500 text-sm">
                        {addon.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 text-left w-52 ml-32">
                      <p className="text-gray-900 font-semibold text-[38px] leading-tight whitespace-nowrap">
                        {addon.price}
                      </p>
                      <p className="mt-0.5 text-gray-800 text-[20px]">
                        {addon.priceNote}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Robot mascot */}
              <div className="relative hidden lg:flex items-center justify-center px-6 py-8 -ml-16">
                <div className="relative w-full h-[470px]">
                  <Image
                    src="/img/landingv4/addons-robot.png"
                    alt="FixFlow AI assistant"
                    fill
                    sizes="(max-width: 1024px) 0px, 33vw"
                    unoptimized
                    className="object-contain object-center"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dark footer strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111111] px-10 py-10">
            <div>
              <p className="text-white font-semibold text-lg">
                Need a customer solution?
              </p>
              <p className="text-gray-400 text-base">
                Let&apos;s build the perfect for your business.
              </p>
            </div>
            <Link
              href="/contact-us"
              className="inline-block text-center bg-[#F7CC00] hover:bg-[#e0b900] text-black font-semibold px-24 py-3 min-w-[260px] rounded-sm transition-colors duration-200"
            >
              Contact Sales
            </Link>
          </div>
        </m.div>
      </div>
    </section>
  );
}
