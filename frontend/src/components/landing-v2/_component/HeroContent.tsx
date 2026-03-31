"use client";

import { m } from "framer-motion";
import SectionBadge from "@/components/about/SectionBadge";

interface HeroContentProps {
  fadeUp: (delay: number) => Record<string, unknown>;
  headingClassName: string;
}

export function HeroContent({ fadeUp, headingClassName }: HeroContentProps) {
  return (
    <>
      <m.div {...fadeUp(0.1)}>
        <SectionBadge label="Modern Loyalty for Service Businesses" />
      </m.div>

      <m.h1 {...fadeUp(0.2)} className={headingClassName}>
        <span>Connect. Schedule.</span>
        <br />
        <span>
          <span className="relative inline-block">
            <span className="text-gold-gradient">Grow</span>
            <svg
              className="absolute -bottom-2 -left-[3%] w-[106%] h-[10px]"
              viewBox="0 0 311 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <m.path
                d="M2 5.5C80 1.5 230 1.5 309 5.5"
                stroke="#ffcc00"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              />
            </svg>
          </span>{" "}
          Your Business.
        </span>
      </m.h1>

      <m.p
        {...fadeUp(0.35)}
        className="text-gray-400 leading-relaxed max-w-[460px]"
      >
        RepairCoin helps service businesses grow with a marketplace, smart
        scheduling, and loyalty rewards in one powerful platform.
      </m.p>
    </>
  );
}
