'use client';

import React from 'react';

interface HeroSectionProps {
  hasWallet: boolean;
  isDetecting: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  onGetStartedClick: () => void;
}

export default function HeroSection({
  hasWallet,
  isDetecting,
  isRegistered,
  isAuthenticated,
  onGetStartedClick
}: HeroSectionProps) {
  return (
    <section className="relative bg-[#101010] w-full h-screen overflow-hidden flex items-center">
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Main gradient overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(255, 204, 0, 0.15), transparent)'
          }}
        />

        {/* Top right gradient circle */}
        <div
          className="absolute top-[-200px] right-[-200px] w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 204, 0, 0.1), transparent 70%)'
          }}
        />

        {/* Bottom left gradient circle */}
        <div
          className="absolute bottom-[-300px] left-[-300px] w-[1000px] h-[1000px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 204, 0, 0.08), transparent 70%)'
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center h-screen">
          {/* Left Content */}
          <div className="space-y-6 pt-20 lg:pt-0">
            <div className="inline-block">
              <p className="text-[#ffcc00] text-sm sm:text-base md:text-lg font-semibold tracking-wider uppercase">
                THE REPAIR INDUSTRY&apos;S LOYALTY TOKEN
              </p>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              The Future of
              <br />
              Repair Rewards
            </h1>

            <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-[18rem] md:max-w-md">
              RepairCoin is a blockchain-based loyalty system that connects customers and shops under one transparent, stable-value network.
              <br /><br />
              Every repair earns RCN you can actually use.
            </p>

            <div className="pt-4">
              <button
                onClick={onGetStartedClick}
                className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-medium px-8 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started →
              </button>
            </div>
          </div>

          {/* Right Content - Hero Image */}
          <div className=" h-full flex items-end justify-center lg:justify-end pb-0">
             <div className="w-full">
              <img
                src="/img/landing/hero-person.gif"
                alt="RepairCoin Hero - Person with devices"
                className="absolute bottom-0 left-1/4 w-full h-[80vh] object-contain object-bottom"
                onError={(e) => {
                  // Fallback to existing image if landing image not found
                  e.currentTarget.src = '/img/hero-bg.png';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
