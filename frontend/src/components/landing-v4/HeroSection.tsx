"use client";

import React from "react";
import Image from "next/image";
import { Loader2, SendHorizontal } from "lucide-react";
import { FaMicrophone } from "react-icons/fa";
import Badge from "./Badge";
import { m, useReducedMotion } from "framer-motion";
import { useModalStore } from "@/stores/modalStore";

interface HeroSectionProps {
  hasWallet: boolean;
  isDetecting: boolean;
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
  section: [
    "relative bg-[#0a0a0a]",
    "min-h-[100svh]",
    "overflow-hidden",
    "flex items-center",
    "pt-24 pb-12 sm:pt-28 sm:pb-20 lg:py-28",
  ].join(" "),

  container: ["max-w-7xl mx-auto w-full", "px-4 lg:px-8"].join(" "),

  column: [
    "relative z-10",
    "flex flex-col items-center text-center",
    "space-y-6 sm:space-y-7",
  ].join(" "),

  heading: [
    "font-bold text-white leading-[1.15] text-balance",
    "max-w-4xl",
    "text-[2.25rem]",
    "sm:text-[3rem]",
    "xl:text-[4rem]",
  ].join(" "),

  ctaButton: [
    "btn-shimmer",
    "bg-[#F7CC00] hover:bg-[#E5BB00]",
    "text-black font-semibold",
    "px-8 py-3.5",
    "rounded-xl shadow-lg hover:shadow-xl",
    "transition-all duration-200",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "flex items-center gap-2",
    "text-sm sm:text-base",
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
    <section className={layout.section}>
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-70"
          priority
        />
      </div>

      <div className={layout.container}>
        <div className={layout.column}>
          <m.div {...fadeUp(0.1)}>
            <Badge label="The Future of Service Businesses" />
          </m.div>

          <m.h1 {...fadeUp(0.2)} className={layout.heading}>
            The Smarter Way to Grow Your Business With AI
          </m.h1>

          <m.p
            {...fadeUp(0.35)}
            className="text-gray-300 leading-relaxed max-w-2xl text-base sm:text-[1.25rem] -mt-2 sm:-mt-3"
          >
            FixFlow helps local service businesses manage bookings, customers,
            marketing, rewards, and daily operations from one intelligent
            platform.
          </m.p>

          {/* CTA */}
          <m.div {...fadeUp(0.5)}>
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
                <>Start Free Trial</>
              )}
            </button>
          </m.div>

          {/* ── AI assistant ── */}
          <div className="w-full max-w-3xl pt-4 sm:pt-6">
            {/* AI assistant prompt label */}
            <m.div
              {...fadeUp(0.6)}
              className="flex items-start justify-center gap-2"
            >
              <CurvedArrow />
              <span className="text-[#F7CC00] font-semibold text-sm sm:text-base text-left">
                Ask our AI assistant anything about your business
              </span>
            </m.div>

            {/* AI chat bar (visual only) */}
            <m.div {...fadeUp(0.7)} className="mt-3">
              <AIChatBar />
            </m.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Hand-drawn curved arrow pointing at the AI label ── */
function CurvedArrow() {
  return (
    <svg
      width="32"
      height="28"
      viewBox="0 0 32 28"
      fill="none"
      className="flex-shrink-0 text-[#F7CC00]"
      aria-hidden="true"
    >
      <path
        d="M30 4C18 2 4 8 4 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 20L1 13M4 20L11 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── AI chat bar — visual only, not wired to a backend ── */
function AIChatBar() {
  return (
    <div className="relative flex items-center gap-3 rounded-full bg-white border border-[#F7CC00]/60 pl-4 pr-2 py-2 shadow-[0_0_30px_-5px_rgba(247,204,0,0.35)]">
      <span className="relative w-7 h-7 flex-shrink-0">
        <Image
          src="/img/landingv4/chat-bot.png"
          alt=""
          fill
          className="object-contain"
        />
      </span>
      <input
        type="text"
        placeholder="Try.. How can I grow my business faster?"
        className="flex-1 bg-transparent text-sm sm:text-base text-black placeholder-black/50 focus:outline-none"
        aria-label="Ask the AI assistant"
      />
      <button
        type="button"
        aria-label="Use voice input"
        className="p-2 text-black hover:text-black/70 transition-colors"
      >
        <FaMicrophone className="w-5 h-5 text-black" />
      </button>
      <button
        type="button"
        aria-label="Send message"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F7CC00] hover:bg-[#E5BB00] text-black transition-colors flex-shrink-0"
      >
        <SendHorizontal className="w-5 h-5" />
      </button>
    </div>
  );
}
