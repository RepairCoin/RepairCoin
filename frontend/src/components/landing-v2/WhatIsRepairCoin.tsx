'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the 3D model component with no SSR
const RepairCoin3DModel = dynamic(
  () => import('./RepairCoin3DModel'),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[250px] lg:h-[300px] flex items-center justify-center">
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

export default function WhatIsRepairCoin() {
  return (
    <section className="relative bg-[#191919] w-full my-32">
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

          {/* Right Content - 3D Coin Model */}
          <RepairCoin3DModel />
        </div>
      </div>
    </section>
  );
}
