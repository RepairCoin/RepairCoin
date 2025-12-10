'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

// Dynamically import the 3D model component with no SSR
const RepairCoin3DModel = dynamic(
  () => import('./RepairCoin3DModel'),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[350px] lg:h-[500px] flex items-center justify-center">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ffcc00] to-[#ff9900] animate-pulse"></div>
          <div className="absolute inset-4 rounded-full bg-[#191919] flex items-center justify-center">
            <span className="text-4xl sm:text-5xl font-bold text-[#ffcc00]">RCN</span>
          </div>
        </div>
      </div>
    )
  }
);

const WhatIsRepairCoin = React.memo(function WhatIsRepairCoin() {
  const [shouldLoad3D, setShouldLoad3D] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Detect mobile devices to show static image instead of 3D model
  useEffect(() => {
    const checkMobile = () => {
      // Check screen width and also device capabilities
      const isSmallScreen = window.innerWidth < 1024;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isSmallScreen || isTouchDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Skip 3D loading on mobile
    if (isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad3D(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile]);

  return (
    <section ref={sectionRef} className="relative bg-[#191919] w-full my-4">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-4 lg:space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              What is RepairCoin?
            </h2>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              A blockchain-powered rewards token for real repairs. No public trading or speculation — just a fixed $0.10 value you can redeem at participating shops.
            </p>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              Governance and platform rules are managed by RepairCoin Governance (RCG) holders.
            </p>
          </div>

          {/* Right Content - Static image on mobile, 3D model on desktop */}
          {isMobile ? (
            // Static image for mobile devices - much better performance
            <div className="relative h-[300px] sm:h-[350px] flex items-center justify-center">
              <div className="relative w-56 h-56 sm:w-72 sm:h-72">
                <Image
                  src="/img/landing/repaircoin-icon.png"
                  alt="RepairCoin Token"
                  fill
                  className="object-contain drop-shadow-[0_0_30px_rgba(255,204,0,0.3)]"
                  priority
                />
              </div>
            </div>
          ) : shouldLoad3D ? (
            <RepairCoin3DModel />
          ) : (
            <div className="relative h-[350px] lg:h-[500px] flex items-center justify-center">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ffcc00]/30 to-[#ff9900]/30"></div>
                <div className="absolute inset-4 rounded-full bg-[#191919] flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl font-bold text-[#ffcc00]/50">RCN</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

export default WhatIsRepairCoin;
