'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';

const tiers = [
  {
    name: 'Bronze',
    range: '0 - 199 RCN Lifetime Earned',
    headerBg: 'bg-gradient-to-r from-[#CD7F32] to-[#B87333]',
    image: '/img/landing/pexels-godisable-jacob-871495-removebg-preview 2.png',
    fallback: '🥉',
    description: 'Your starting point for earning rewards',
    benefits: [
      '+ 0 RCN Bonus',
      'Earn 10–25 RCN per qualifying repair'
    ]
  },
  {
    name: 'Silver',
    range: '200 - 999 RCN Lifetime Earned',
    headerBg: 'bg-gradient-to-r from-[#878686] to-[#A8A8A8]',
    image: '/img/landing/pexels-godisable-jacob-871495-removebg-preview 2 (1).png',
    fallback: '🥈',
    description: 'Earn and unlock your first loyalty boost',
    benefits: [
      '+ 2 RCN Bonus',
      'Earn 10–25 RCN per qualifying repair'
    ]
  },
  {
    name: 'Gold',
    range: '1,000+ RCN lifetime earned',
    headerBg: 'bg-gradient-to-r from-[#ad9307] to-[#FFC700]',
    image: '/img/landing/pexels-godisable-jacob-871495-removebg-preview 2 (2).png',
    fallback: '🥇',
    description: 'Maximum rewards for loyal customers',
    benefits: [
      '+ 5 RCN Bonus',
      'Earn 10–25 RCN per qualifying repair'
    ]
  }
];

export default function LoyaltyTiers() {
  return (
    <section className="relative bg-[#191919] w-full py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Loyalty That Levels Up
          </h2>
          <p className="text-sm sm:text-base text-gray-300">
            The more you repair, the more you earn — higher tiers unlock extra RCN bonuses.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative "
            >
              {/* Header with Gradient and Coin */}
              <div className={`${tier.headerBg} px-6 py-6 relative flex items-center justify-between max-h-20`}>
                <div className="">
                  <h3 className="text-xl lg:text-2xl font-extrabold text-white mb-1">
                    {tier.name}
                  </h3>
                  <p className="text-xs lg:text-sm text-white/90">
                    {tier.range}
                  </p>
                </div>

                {/* Coin Image */}
                <div className="absolute w-16 h-16 lg:w-20 lg:h-20 flex-shrink-0 right-4 relative">
                  <Image
                    src={tier.image}
                    alt={`${tier.name} Medal`}
                    fill
                    className="object-contain"
                    sizes="80px"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-700">
                  {tier.description}
                </p>

                <div className="space-y-2">
                  {tier.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-gray-700 flex-1">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
