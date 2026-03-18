"use client";

import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { m, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useModalStore } from "@/stores/modalStore";
import SectionBadge from "@/components/about/SectionBadge";

interface HeroSectionProps {
  hasWallet: boolean;
  isDetecting: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  isRedirecting?: boolean;
  onGetStartedClick: () => void;
}

export default function HeroSection({
  hasWallet,
  isDetecting,
  isRedirecting = false,
  onGetStartedClick,
}: HeroSectionProps) {
  const isLoading = isDetecting || isRedirecting;
  const { openWelcomeModal } = useModalStore();
  const prefersReducedMotion = useReducedMotion();

  const { scrollY } = useScroll();
  const macbookY = useTransform(scrollY, [0, 500], [0, -30]);
  const iphoneY = useTransform(scrollY, [0, 500], [0, -50]);

  const handleGetStartedClick = () => {
    if (!hasWallet) {
      openWelcomeModal();
    } else {
      onGetStartedClick();
    }
  };

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative bg-[#0a0a0a] h-screen">
      {/* Dotted background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
      </div>

      {/* Content wrapper */}
      <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 ">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8 h-full">
          {/* Left Content */}
          <div className="lg:flex-1 space-y-4 sm:space-y-7 pt-20 sm:pt-28 lg:pt-0 pb-8 md:pb-0">
            {/* Badge */}
            <m.div
              {...fadeUp(0.1)}
              className="[&>div]:px-3 [&>div]:py-1.5 [&>div]:gap-1.5 sm:[&>div]:px-5 sm:[&>div]:py-2 sm:[&>div]:gap-2.5 [&_span]:text-xs sm:[&_span]:text-sm [&_svg]:w-3 [&_svg]:h-3 sm:[&_svg]:w-4 sm:[&_svg]:h-4"
            >
              <SectionBadge label="Modern Loyalty for Service Businesses" />
            </m.div>

            <m.h1
              {...fadeUp(0.2)}
              className="text-[1.75rem] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[4rem] font-bold text-white leading-[1.08] tracking-tight"
            >
              <span className="sm:whitespace-nowrap">Connect. Schedule.</span>
              <br />
              <span className="sm:whitespace-nowrap">
                <span className="text-gold-gradient">Grow</span> Your Business.
              </span>
            </m.h1>

            <m.p
              {...fadeUp(0.35)}
              className="text-sm sm:text-lg text-gray-400 leading-relaxed max-w-[460px]"
            >
              RepairCoin helps service businesses grow with a marketplace, smart
              scheduling, and loyalty rewards in one powerful platform.
            </m.p>

            {/* Get Started - hidden on small mobile, visible sm+ */}
            <m.div {...fadeUp(0.5)} className="pt-1 hidden sm:block">
              <button
                onClick={handleGetStartedClick}
                disabled={isLoading}
                className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-7 sm:px-10 py-3 sm:py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isRedirecting ? "Redirecting..." : "Loading..."}
                  </>
                ) : (
                  <>Get Started &rarr;</>
                )}
              </button>
            </m.div>
          </div>

          {/* Right Content - Device Mockups (desktop) */}
          <div className="relative hidden lg:block lg:flex-1 h-[550px] xl:h-[600px]">
            <m.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, x: 60 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.8, delay: 0.4, ease: "easeOut" as const }
              }
              style={prefersReducedMotion ? undefined : { y: macbookY }}
              className="absolute top-0 right-[-120px] xl:right-[-180px] w-[700px] xl:w-[800px] h-[420px] xl:h-[470px]"
            >
              <Image
                src="/img/landingv2/MacBookAir.png"
                alt="RepairCoin Dashboard on MacBook"
                fill
                className="object-contain object-right-top"
                priority
              />
            </m.div>
            <m.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.8, delay: 0.6, ease: "easeOut" as const }
              }
              style={prefersReducedMotion ? undefined : { y: iphoneY }}
              className="absolute left-[60px] xl:left-[40px] bottom-[-20px] w-[220px] xl:w-[260px] h-[430px] xl:h-[480px] z-10"
            >
              <Image
                src="/img/landingv2/iPhone13.png"
                alt="RepairCoin Mobile App"
                fill
                className="object-contain object-bottom"
                priority
              />
            </m.div>
          </div>

          {/* Mobile/Tablet devices - iPhone only on small, both on md+ */}
          <div className="relative flex lg:hidden flex-col items-center flex-1 min-h-0 pb-6">
            <m.div {...fadeUp(0.5)} className="flex-1 min-h-0 flex items-center justify-center w-full">
              <Image
                src="/img/landingv2/iPhone13.png"
                alt="RepairCoin Mobile App"
                width={640}
                height={1280}
                className="h-full w-auto max-h-full object-contain"
                priority
              />
            </m.div>

            {/* Get Started - below iPhone on small mobile only */}
            <m.div {...fadeUp(0.5)} className="mt-4 shrink-0 sm:hidden">
              <button
                onClick={handleGetStartedClick}
                disabled={isLoading}
                className="btn-shimmer bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-7 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isRedirecting ? "Redirecting..." : "Loading..."}
                  </>
                ) : (
                  <>Get Started &rarr;</>
                )}
              </button>
            </m.div>
          </div>
        </div>
      </div>
    </section>
  );
}
