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
    <section className="relative bg-[#0a0a0a] w-full h-screen overflow-hidden">
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

      {/* Content wrapper - full width, no max-w constraint on the right */}
      <div className="relative z-10 h-full flex items-center">
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-7 pt-20 lg:pt-0">
              {/* Badge */}
              <SectionBadge label="Modern Loyalty for Service Businesses" />

              <h1 className="text-[2.75rem] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[4rem] font-bold text-white leading-[1.08] tracking-tight">
                <span className="whitespace-nowrap">Connect. Schedule.</span>
                <br />
                <span className="whitespace-nowrap"><span className="text-[#F7CC00]">Grow</span> Your Business.</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-[460px]">
                RepairCoin helps service businesses grow with a marketplace,
                smart scheduling, and loyalty rewards in one powerful platform.
              </p>

              <div className="pt-1">
                <button
                  onClick={handleGetStartedClick}
                  disabled={isLoading}
                  className="bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-10 py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-base"
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

            {/* Right Content - Device Mockups */}
            <div className="relative hidden lg:block h-[550px] xl:h-[600px]">
              {/* MacBook - positioned to bleed off the right edge */}
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

              {/* iPhone - overlapping MacBook from center-left */}
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

            {/* Mobile devices - shown only on smaller screens */}
            <div className="relative lg:hidden flex justify-center pb-8">
              <div className="relative w-full max-w-md h-[350px] sm:h-[400px]">
                {/* MacBook */}
                <div className="absolute right-[-20px] top-0 w-[80%] h-[65%]">
                  <Image
                    src="/img/landingv2/MacBookAir.png"
                    alt="RepairCoin Dashboard on MacBook"
                    fill
                    className="object-contain object-right-top"
                    priority
                  />
                </div>
                {/* iPhone */}
                <div className="absolute left-[10%] bottom-0 w-[35%] h-[75%] z-10">
                  <Image
                    src="/img/landingv2/iPhone13.png"
                    alt="RepairCoin Mobile App"
                    fill
                    className="object-contain object-bottom"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
