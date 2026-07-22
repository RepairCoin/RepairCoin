"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import { useModalStore } from "@/stores/modalStore";

interface CTASectionProps {
  line1?: string;
  line2?: string;
  description?: string;
  ctaLabel?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export default function CTASection({
  line1 = "One Platform.",
  line2 = "Endless Possibilities.",
  description = "From bookings and customer management to rewards and AI insights, FixFlow gives you everything you need to succeed.",
  ctaLabel = "Start Free Trial →",
  secondaryLabel,
  secondaryHref,
}: CTASectionProps = {}) {
  const { openWelcomeModal } = useModalStore();

  return (
    <section className="relative bg-[#0a0a0a] py-12 sm:py-20 lg:py-28 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-50"
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 lg:px-8 relative z-10 text-center space-y-6 sm:space-y-8">
        <AnimateOnScroll>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            {line1}
            <br />
            <span className="relative inline-block">
              {line2}
              <svg
                className="absolute -bottom-8 left-[15%] w-[70%] h-[18px]"
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
            {description}
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-6 sm:mt-8">
            <button
              onClick={openWelcomeModal}
              className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-base sm:text-lg"
            >
              {ctaLabel}
            </button>

            {secondaryLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                className="bg-white hover:bg-gray-100 text-black font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-base sm:text-lg"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
