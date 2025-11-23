'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';

const features = [
  'Search verified partner shops nationwide — Every location is RCG-approved for secure redemptions.',
  'Redeem RCN tokens at a fixed $0.10 value — No fluctuations, no guesswork.',
  'Customer approval required — Every redemption request must be confirmed by you before processing.',
  'Cross-shop redemption enabled — Use up to 20% of your lifetime RCN at other verified shops.',
  'Search verified partner shops nationwide — every location is RCG-approved for secure redemptions.'
];

export default function FindAndRedeem() {
  const { openWelcomeModal } = useModalStore();

  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Find & Redeem at Partner Shops
              </h2>
              <p className="text-base sm:text-lg text-gray-300">
                Search verified RCG partner locations to repair your devices, redeem tokens, or earn new rewards.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffcc00] flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-white text-base flex-1">
                    <span className="text-[#ffcc00]">{feature.split('—')[0]}</span>
                    {feature.includes('—') && ` — ${feature.split('—')[1]}`}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <button
                onClick={openWelcomeModal}
                className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-medium px-8 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started →
              </button>
            </div>
          </div>

          {/* Right Content - Map/Image */}
          <div className="relative h-[400px] rounded-xl overflow-hidden bg-gray-800">
            <Image
              src="/img/landing/Photo (4).png"
              alt="Find Partner Shops"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
