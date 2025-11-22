'use client';

import React from 'react';
import Image from 'next/image';

const steps = [
  {
    title: 'Shop Sends Request',
    description1: 'When you choose to redeem tokens at a partner shop.',
    description2: 'The system instantly sends a secure request to your account for approval.',
    image: '/img/landing/Photo (5).png',
    fallback: '📧'
  },
  {
    title: 'Review the Details',
    description1: 'View the shop name, token amount, and service details.',
    description2: 'Approve only if everything looks correct — your tokens stay safe until you confirm.',
    image: '/img/landing/Photo (6).png',
    fallback: '📋'
  },
  {
    title: 'Approve Securely',
    description1: 'Once you\'re ready, simply tap Approve to authorize the transaction.',
    description2: 'The shop will be notified instantly to process your service.',
    image: '/img/landing/Photo (7).png',
    fallback: '✅'
  },
  {
    title: 'Redemption Complete',
    description1: 'Once approved, your tokens are verified and deducted.',
    description2: 'The shop can now process your service — fast, secure, and fully transparent.',
    image: '/img/landing/Photo (8).png',
    fallback: '🛡️'
  }
];

export default function RedemptionControl() {
  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            You Control Every Redemption
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-4xl mx-auto">
            Approve only the requests you recognize. Your tokens move only when you confirm — simple, safe, and transparent.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              {/* Image */}
              <div className="w-full h-56 bg-[#E8E8E8] flex items-center justify-center overflow-hidden relative">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  {step.description1}
                </p>
                <p className="text-sm text-gray-700">
                  {step.description2}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
