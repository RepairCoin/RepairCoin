"use client";

import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
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

  const handleGetStartedClick = () => {
    if (!hasWallet) {
      openWelcomeModal();
    } else {
      onGetStartedClick();
    }
  };

  return (
    <section className="relative bg-[#0a0a0a] w-full min-h-[100dvh] md:min-h-screen lg:h-screen overflow-hidden">
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
      <div className="relative z-10 h-full flex items-center">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-4 sm:space-y-7 pt-20 sm:pt-28 lg:pt-0 pb-8 md:pb-0">
              {/* Badge - smaller on mobile */}
              <div className="[&>div]:px-3 [&>div]:py-1.5 [&>div]:gap-1.5 sm:[&>div]:px-5 sm:[&>div]:py-2 sm:[&>div]:gap-2.5 [&_span]:text-xs sm:[&_span]:text-sm [&_svg]:w-3 [&_svg]:h-3 sm:[&_svg]:w-4 sm:[&_svg]:h-4">
                <SectionBadge label="Modern Loyalty for Service Businesses" />
              </div>

              <h1 className="text-[1.75rem] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[4rem] font-bold text-white leading-[1.08] tracking-tight">
                <span className="sm:whitespace-nowrap">Connect. Schedule.</span>
                <br />
                <span className="sm:whitespace-nowrap"><span className="text-[#F7CC00]">Grow</span> Your Business.</span>
              </h1>

              <p className="text-sm sm:text-lg text-gray-400 leading-relaxed max-w-[460px]">
                RepairCoin helps service businesses grow with a marketplace,
                smart scheduling, and loyalty rewards in one powerful platform.
              </p>

              {/* Get Started - hidden on small mobile, visible sm+ */}
              <div className="pt-1 hidden sm:block">
                <button
                  onClick={handleGetStartedClick}
                  disabled={isLoading}
                  className="bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-7 sm:px-10 py-3 sm:py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base"
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
              </div>
            </div>

            {/* Right Content - Device Mockups (desktop) */}
            <div className="relative hidden lg:block h-[550px] xl:h-[600px]">
              <div
                className="absolute top-0 right-[-120px] xl:right-[-180px] w-[700px] xl:w-[800px] h-[420px] xl:h-[470px]"
              >
                <Image
                  src="/img/landingv2/MacBookAir.png"
                  alt="RepairCoin Dashboard on MacBook"
                  fill
                  className="object-contain object-right-top"
                  priority
                />
              </div>
              <div
                className="absolute left-[60px] xl:left-[40px] bottom-[-20px] w-[220px] xl:w-[260px] h-[430px] xl:h-[480px] z-10"
              >
                <Image
                  src="/img/landingv2/iPhone13.png"
                  alt="RepairCoin Mobile App"
                  fill
                  className="object-contain object-bottom"
                  priority
                />
              </div>
            </div>

            {/* Mobile/Tablet devices - iPhone only on small, both on md+ */}
            <div className="relative flex lg:hidden flex-col items-center pb-6">
              <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md h-[280px] sm:h-[320px] md:h-[350px]">
                {/* MacBook - hidden on small mobile, visible md+ */}
                <div className="absolute right-0 top-0 w-[75%] h-[60%] hidden md:block">
                  <Image
                    src="/img/landingv2/MacBookAir.png"
                    alt="RepairCoin Dashboard on MacBook"
                    fill
                    className="object-contain object-right-top"
                    priority
                  />
                </div>
                {/* iPhone - always visible, centered on small, left on md+ */}
                <div className="relative md:absolute mx-auto md:mx-0 md:left-[5%] md:bottom-0 w-[140px] sm:w-[160px] md:w-[38%] h-[260px] sm:h-[300px] md:h-[80%] z-10">
                  <Image
                    src="/img/landingv2/iPhone13.png"
                    alt="RepairCoin Mobile App"
                    fill
                    className="object-contain object-bottom"
                    priority
                  />
                </div>
              </div>

              {/* Get Started - below iPhone on small mobile only */}
              <div className="mt-4 sm:hidden">
                <button
                  onClick={handleGetStartedClick}
                  disabled={isLoading}
                  className="bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-7 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
