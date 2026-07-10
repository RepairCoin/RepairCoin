"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";

interface Industry {
  title: string;
  description: string;
  image: string;
}

const industries: Industry[] = [
  {
    title: "Repair Shops",
    description: "Streamline repairs, manage customers, and boost loyalty.",
    image: "/img/landingv4/industries/repair-shops.png",
  },
  {
    title: "Automotive Services",
    description: "Manage appointments, track services, and grow repeat visits.",
    image: "/img/landingv4/industries/automotive.png",
  },
  {
    title: "Beauty and Wellness",
    description: "Manage appointments, staff and customer loyalty.",
    image: "/img/landingv4/industries/beauty-wellness.png",
  },
  {
    title: "Fitness and Lifestyle",
    description:
      "Increase memberships, improve retention, and keep clients coming back.",
    image: "/img/landingv4/industries/fitness.png",
  },
  {
    title: "Home Repair Services",
    description: "Handle requests, and customer communications.",
    image: "/img/landingv4/industries/home-repair.png",
  },
  {
    title: "Legal Services",
    description:
      "Manage consultations, client communications, and case workflows with confidence.",
    image: "/img/landingv4/industries/legal.png",
  },
  {
    title: "Pet Care",
    description: "Increase bookings, build loyalty, and keep pet owners coming back.",
    image: "/img/landingv4/industries/pet-care.png",
  },
  {
    title: "And Many More",
    description: "Any service business. One powerful platform.",
    image: "/img/landingv4/industries/many-more.png",
  },
];

export default function ServiceIndustries() {
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
        <m.h2
          {...fadeUp(0)}
          className="text-center font-bold text-white text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight"
        >
          One Platform. Every Service Industry.
        </m.h2>
        <m.p
          {...fadeUp(0.1)}
          className="mt-4 text-center text-gray-400 text-base sm:text-lg max-w-2xl mx-auto"
        >
          Manage bookings, customers, marketing, rewards, and daily operations
          from one intelligent platform built around your business.
        </m.p>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {industries.map((industry, index) => (
            <m.div
              key={industry.title}
              {...fadeUp(0.05 * (index % 4))}
              className="group rounded-2xl bg-[#141414] border border-white/5 overflow-hidden transition-colors duration-300 hover:border-[#F7CC00]/40"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={industry.image}
                  alt={industry.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="px-4 pt-4 pb-5">
                <h3 className="text-white font-semibold text-lg">
                  {industry.title}
                </h3>
                <p className="mt-1.5 text-gray-400 text-sm leading-relaxed">
                  {industry.description}
                </p>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
