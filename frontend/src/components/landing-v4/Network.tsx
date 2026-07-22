"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import Badge from "./Badge";

interface Benefit {
  title: string;
  description: string;
}

const benefits: Benefit[] = [
  {
    title: "Get Discovered",
    description: "Help more local customers find your business.",
  },
  {
    title: "Book With Ease",
    description: "Simple, seamless scheduling for customers and businesses.",
  },
  {
    title: "Build Trust",
    description: "Verified profiles, ratings, and reviews inspire confidence.",
  },
];

export default function Network() {
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
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-14 items-center">
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
              FixFlow brings customers and local businesses together in one
              connected marketplace, making it easy to get discovered, book
              services, and build lasting relationships.
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
          </div>

          <m.div
            {...fadeUp(0.2)}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10"
          >
            <Image
              src="/img/landingv4/network-showcase.png"
              alt="FixFlow marketplace showing nearby shops on a map"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </m.div>
        </div>
      </div>
    </section>
  );
}
