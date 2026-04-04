"use client";

import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import SectionBadge from "./SectionBadge";

export default function AboutHero() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative h-screen w-full bg-[#0D0D0D] overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <m.div {...fadeUp(0.1)}>
          <SectionBadge label="About RepairCoin" />
        </m.div>

        <m.h1
          {...fadeUp(0.2)}
          className="mt-10 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white !leading-[1.3]"
        >
          The story behind
          <br />
          <span className="relative inline-block">
            <span className="text-gold-gradient">RepairCoin</span>
            {/* Yellow underline curve */}
            <svg
              className="absolute -bottom-[13%] -left-[-4%] w-[92%] h-[18px]"
              viewBox="0 0 311 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <m.path
                d="M2 5.5C80 1.5 230 1.5 309 5.5"
                stroke="#ffcc00"
                className="stroke-[2] sm:stroke-[3] md:stroke-[4]"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.8, delay: 0.6, ease: "easeOut", opacity: { duration: 0.01, delay: 0.6 } }}
              />
            </svg>
          </span>
        </m.h1>

        <m.p
          {...fadeUp(0.35)}
          className="mt-10 max-w-2xl text-gray-400 text-lg sm:text-xl leading-relaxed"
        >
          RepairCoin is a modern loyalty platform for service businesses, created from everyday
          operations and focused on long term customer relationships.
        </m.p>

        <m.div {...fadeUp(0.5)}>
          <Link
            href="/waitlist"
            className="inline-block mt-8 px-10 py-3.5 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-semibold rounded-lg transition-colors"
          >
            Join Waitlist &rarr;
          </Link>
        </m.div>
      </div>
    </section>
  );
}
