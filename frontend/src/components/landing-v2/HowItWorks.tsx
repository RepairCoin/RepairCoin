'use client';

import React from 'react';

const features = [
  {
    title: 'Repair or Refer',
    description: 'Qualifying repairs and successful referrals automatically earn RCN rewards.',
    image: '/img/landing/Photo.png',
    fallback: '🔧'
  },
  {
    title: 'Track & Approve',
    description: 'See your balance, then approve shop redemption requests with one tap.',
    image: '/img/landing/Photo (1).png',
    fallback: '✅'
  },
  {
    title: 'Redeem Anywhere',
    description: 'Use RCN at verified partner shops nationwide at a fixed $0.10 per token.',
    image: '/img/landing/Photo (2).png',
    fallback: '🏪'
  }
];

export default function HowItWorks() {
  return (
    <section className="relative bg-[#191919] w-full py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="mb-8 lg:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-gray-300 max-w-3xl">
            Earn RCN through qualifying repairs and referrals, review & approve redemptions securely, and redeem tokens across the network at a stable $0.10 value.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              {/* Card Image */}
              <div className="h-48 lg:h-56 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to emoji if image not found
                    e.currentTarget.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.className = 'text-6xl';
                    fallback.textContent = feature.fallback;
                    e.currentTarget.parentElement?.appendChild(fallback);
                  }}
                />
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {feature.description}
                </p>

                {/* Learn More Link */}
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors inline-block"
                >
                  Learn More →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
