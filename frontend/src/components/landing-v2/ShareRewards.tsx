'use client';

import React from 'react';
import { Check } from 'lucide-react';

const benefits = [
  {
    text: (
      <>
        <span className="font-semibold text-[#ffcc00]">25 RCN</span> to you when your referral's first repair is completed.
      </>
    )
  },
  {
    text: (
      <>
        <span className="font-semibold text-[#ffcc00]">10 RCN</span> welcome bonus for your friend.
      </>
    )
  },
  {
    text: (
      <>
        Rewards <span className="font-semibold text-[#ffcc00]">appear instantly</span> in your RepairCoin account.
      </>
    )
  },
  {
    text: (
      <>
        <span className="font-semibold text-[#ffcc00]">Fully verified</span> through blockchain — no manual claims required.
      </>
    )
  }
];

export default function ShareRewards() {
  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Share the Rewards. Grow the Movement.
              </h2>
              <p className="text-base sm:text-lg text-gray-300">
                Invite friends to experience smarter, reward-based repairs. They earn tokens on their first service and you earn every time they repair.
              </p>
            </div>

            {/* Benefits List */}
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffcc00] flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-white text-base flex-1">
                    {benefit.text}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <button className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-medium px-8 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                Get Your Referral Link →
              </button>
            </div>
          </div>

          {/* Right Content - Image */}
          <div className="relative h-[400px] rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
              <img
                src="/img/landing/Photo (3).png"
                alt="Share Rewards"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to existing image if landing image not found
                  e.currentTarget.src = '/img/rewards-people-2.png';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
