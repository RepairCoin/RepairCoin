"use client";

import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { m, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useModalStore } from "@/stores/modalStore";
import { HeroContent } from "./_component/HeroContent";
import { DesktopMockups } from "./_component/DesktopMockups";
import { MobileMockups } from "./_component/MobileMockups";

interface HeroSectionProps {
  hasWallet: boolean;
  isDetecting: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  isRedirecting?: boolean;
  onGetStartedClick: () => void;
}

/* ─── Viewport Ranges ───────────────────────────────
 *  mobile:  0 - 639px       (default / no prefix)
 *  tablet:  640px - 1279px  (sm:, md:, lg:)
 *  desktop: 1280px+         (xl:)
 *  wide:    1536px+         (2xl:)
 * ─────────────────────────────────────────────────── */
const layout = {
  /* ── Page-level ── */
  section: [
    "relative bg-[#0a0a0a]",
    "min-h-[100svh]",              // at least viewport height, grows with content
    "overflow-hidden",              // prevent double scrollbar on short viewports
    "flex items-center",            // vertically center content within viewport
    "pt-24 pb-12 sm:pt-28 sm:pb-20 lg:py-28", // top clears navbar, bottom padding preserved
  ].join(" "),

  container: [
    "max-w-7xl mx-auto w-full",    // match site-wide container
    "px-4 lg:px-8",                // match WhatIsRepairCoin padding
  ].join(" "),

  row: [
    "grid",
    "grid-cols-1 lg:grid-cols-2",  // 2-column grid like WhatIsRepairCoin
    "items-center",                // center vertically within grid
    "gap-8 lg:gap-16",             // match WhatIsRepairCoin gap
  ].join(" "),


  heading: [
    "font-bold text-white leading-[1.08] tracking-tight",
    "text-[1.75rem]",         // mobile:  28px
    "sm:text-[3.25rem]",      // tablet:  52px
    "xl:text-[3.75rem]",      // desktop: 60px
    "2xl:text-[4.25rem]",     // wide:    68px
  ].join(" "),

  ctaButton: [
    "btn-shimmer",
    "bg-[#F7CC00] hover:bg-[#E5BB00]",
    "text-black font-semibold",
    "px-7 py-3",              // mobile size
    "sm:px-10 sm:py-4",       // tablet+ size
    "rounded-lg shadow-lg hover:shadow-xl",
    "transition-all duration-200",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "flex items-center gap-2",
    "text-sm sm:text-base",
  ].join(" "),

  ctaDesktop: [
    "pt-1",
    "hidden",                 // mobile: hidden (shown below iPhone instead)
    "sm:block",               // tablet+: visible next to text
  ].join(" "),

  ctaMobile: [
    "sm:hidden",              // tablet+: hidden (shown next to text instead)
    "pt-10",
  ].join(" "),
  
  /* ── Left Column (text + CTA) ── */
  leftColumn: [
    "relative",
    "space-y-4 sm:space-y-7",
  ].join(" "),

  /* ── Desktop Mockups (lg+) ── */
  RightgColumn: [
    "relative",
    "hidden lg:block",
  ].join(" "),

  macbook: [
    // "bg-blue-400"
  ].join(" "),

  desktopIphone: [
    "absolute",
    "bottom-[-20%]",         // peek below container
    "left-[20%]",            // desktop position
    "w-[25%] aspect-[9/19]",  // sized relative to parent, iPhone proportions
  ].join(" "),

  /* ── Mobile / Tablet Mockups (0 - 1279px) ── */
  mobileWrapper: [
    "relative",
    "flex flex-col items-center",
    "lg:hidden",
  ].join(" "),
};

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

  const ctaButton = (
    <button
      onClick={handleGetStartedClick}
      disabled={isLoading}
      className={layout.ctaButton}
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
  );

  return (
    <section className={layout.section}>
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
      </div>

      <div className={layout.container}>
        <div className={layout.row}>

          {/* ── Left column: text + CTA ── */}
          <div className={layout.leftColumn}>
            <HeroContent fadeUp={fadeUp} headingClassName={layout.heading} />

            {/* CTA — tablet & desktop (sm+) */}
            <m.div {...fadeUp(0.5)} className={layout.ctaDesktop}>
              {ctaButton}
            </m.div>
          </div>

          {/* ── Desktop mockups (xl: 1280px+) ── */}
          <div className={layout.RightgColumn}>
            <DesktopMockups
              prefersReducedMotion={prefersReducedMotion}
              macbookY={macbookY}
              iphoneY={iphoneY}
              macbookClassName={layout.macbook}
              iphoneClassName={layout.desktopIphone}
            />
          </div>

          {/* ── Mobile / Tablet mockups (0 - 1279px) ── */}
          <div className={layout.mobileWrapper}>
            <MobileMockups fadeUp={fadeUp} />

            {/* CTA — mobile only (below sm: 640px) */}
            <m.div {...fadeUp(0.5)} className={layout.ctaMobile}>
              {ctaButton}
            </m.div>
          </div>

        </div>
      </div>
    </section>
  );
}
