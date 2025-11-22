'use client';

import React from 'react';
import { Check } from 'lucide-react';

const features = [
  'App-based balance tracking: Check your RCN anytime through your RepairCoin dashboard.',
  'Instant redemption access: Approve redemptions directly from your account.',
  'Full transaction history: View every earn, redeem, and approval in real time.',
  'Transparent redemption logs for every transaction — visible to both shop and customer.'
];

export default function WalletControl() {
  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Your Wallet. Your Control.
              </h2>
              <p className="text-base sm:text-lg text-gray-300">
                Track your RCN balance, view transactions, and redeem tokens instantly — all in a secure, mobile‑first wallet.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffcc00] flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-white text-sm flex-1">
                    <span className="text-[#ffcc00]">{feature.split(':')[0]}:</span>
                    {feature.includes(':') && ` ${feature.split(':')[1]}`}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <button className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-medium px-8 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                Download App →
              </button>
            </div>
          </div>

          {/* Right Content - Mobile/Wallet Image */}
          <div className="relative h-[400px] rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
              <img
                src="/img/landing/Photo (4).png"
                alt="Wallet Control"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to existing image if landing image not found
                  e.currentTarget.src = '/img/cust-ref-widget3.png';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
