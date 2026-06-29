"use client";

import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import Badge from "@/components/landing-v4/Badge";

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
    <section className="relative overflow-hidden bg-[#0D0D0D]">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <m.div {...fadeUp(0.1)} className="flex justify-center lg:justify-start mb-6 md:mb-8">
              <Badge label="Our Story" />
            </m.div>

            {/* Reserve height on desktop so the mascot column stretches and
                renders at the same size as the features hero. */}
            <div className="lg:min-h-[440px] flex flex-col justify-center">
            {/* Title */}
            <m.h1
              {...fadeUp(0.2)}
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.2] mb-5 md:mb-6"
            >
              <span className="block lg:whitespace-nowrap">Building the Future of</span>
              <span className="block lg:whitespace-nowrap">
                Business{" "}
                <span className="relative inline-block">
                  Growth With AI
                  {/* Yellow underline curve - animated draw */}
                  <svg
                    className="absolute -bottom-2 md:-bottom-3 left-0 w-full h-[12px] md:h-[16px]"
                    viewBox="0 0 200 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <m.path
                      d="M2 9C50 2 150 2 198 9"
                      stroke="#ffcc00"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={prefersReducedMotion ? undefined : { pathLength: 0 }}
                      animate={prefersReducedMotion ? undefined : { pathLength: 1 }}
                      transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                    />
                  </svg>
                </span>
              </span>
            </m.h1>

            {/* Subtitle */}
            <m.p
              {...fadeUp(0.35)}
              className="text-base md:text-[22px] text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Built from real business experience, FixFlow AI helps businesses streamline
              operations, engage customers, automate workflows, and grow smarter&mdash;all from one
              platform.
            </m.p>
            </div>
          </div>

          {/* Right: mascot */}
          <m.div
            {...fadeUp(0.3)}
            className="flex justify-center lg:justify-start lg:self-stretch lg:items-end lg:-ml-16"
          >
            <Image
              src="/img/about/hero-mascot.png"
              alt="RepairCoin AI mascot"
              width={520}
              height={520}
              priority
              className="w-[260px] sm:w-[340px] h-auto lg:w-auto lg:h-full object-contain"
            />
          </m.div>
        </div>
      </div>
    </section>
  );
}
