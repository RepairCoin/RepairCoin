'use client';

import React from 'react';

const features = [
  {
    title: 'DAO Parameters',
    description: 'Earning rates, tier bonuses, cross‑shop limits, and more are set via community votes.'
  },
  {
    title: 'Revenue Sharing',
    description: '10% RCG Stakers • 10% DAO Treasury • 80% Operations.'
  },
  {
    title: 'Verification & Tiers',
    description: 'Shops stake RCG to unlock Standard, Premium, and Elite partner benefits.'
  }
];

export default function CommunityDriven() {
  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Community‑Driven. Transparently Managed.
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-4xl mx-auto">
            RCG governance sets earning rates, caps, and cross‑shop rules. Platform revenue shares support RCG stakers and the DAO treasury.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-200 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              <h3 className="text-xl font-bold text-black mb-4">
                {feature.title}
              </h3>
              <p className="text-base text-gray-700">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
