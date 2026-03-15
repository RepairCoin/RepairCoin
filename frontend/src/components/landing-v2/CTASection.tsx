"use client";

import React from "react";
import Image from "next/image";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";

export default function CTASection() {
  return (
    <section className="relative bg-[#0a0a0a] py-12 sm:py-20 lg:py-28 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-20"
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 lg:px-8 relative z-10 text-center space-y-6 sm:space-y-8">
        <AnimateOnScroll>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Join RepairCoin as an
            <br />
            <span className="relative inline-block">
              <span className="text-gold-gradient">early partner</span>
              {/* Yellow underline curve - animated draw */}
              <svg
                className="absolute -bottom-8 -left-[3%] w-[106%] h-[18px]"
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
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                />
              </svg>
            </span>
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.3}>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto pt-2 sm:pt-4">
            Be among the first to launch, test, and grow with RepairCoin from day
            one.
          </p>

          <div className="flex justify-center mt-6 sm:mt-8">
            <button className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-base sm:text-lg">
              Join Waitlist &rarr;
            </button>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
