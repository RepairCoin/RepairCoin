"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { useModalStore } from "@/stores/modalStore";
import Badge from "./Badge";

export default function Network() {
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <m.div {...fadeUp(0)}>
              <Badge label="Discover. Book. Earn." />
            </m.div>

            <m.h2
              {...fadeUp(0.1)}
              className="mt-6 flex flex-col gap-4 font-bold text-white text-3xl sm:text-4xl lg:text-[42px] leading-tight tracking-tight"
            >
              <span>The Network Connecting</span>
              <span>Shops and Customers</span>
            </m.h2>

            <m.p
              {...fadeUp(0.15)}
              className="mt-5 text-gray-400 text-base sm:text-lg max-w-xl"
            >
              Discover trusted businesses, connect with new customers, and grow
              through the FixFlow ecosystem.
            </m.p>

            <m.div {...fadeUp(0.2)} className="mt-8">
              <button
                onClick={openWelcomeModal}
                className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Explore Partner Shops
              </button>
            </m.div>
          </div>

          <m.div
            {...fadeUp(0.2)}
            className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-white/10"
          >
            <Image
              src="/img/landingv4/network-showcase.png"
              alt="FixFlow partner network"
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
