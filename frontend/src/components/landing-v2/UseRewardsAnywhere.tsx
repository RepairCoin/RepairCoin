'use client';

import React from 'react';
import { Check } from 'lucide-react';

const customerFeatures = [
  'Universal Redemption: Use your RCN at any participating RepairCoin shop nationwide.',
  'Cross-Shop Compatibility: Whether it\'s phone repair, console service, or battery replacement — your tokens work anywhere.',
  'No Expiry Dates: Your loyalty never expires — spend it when you need it most.',
  'Earn Once, Spend Anywhere: Get rewarded at one shop, redeem at another.'
];

const shopFeatures = [
  'Network-Wide Acceptance: Shops under the RepairCoin ecosystem honor the same RCN value.',
  'Backed by DAO Governance: Cross-redemptions are verified through the RCG compliance layer.',
  'Secure Validation: Every transaction runs through RepairCoin\'s anti-fraud system.',
  'Access network insights to see where redemptions and referrals come from.'
];

export default function UseRewardsAnywhere() {
  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Use Your Rewards Anywhere
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-4xl mx-auto">
            Redeem 100% at your home shop and up to 20% across other participating shops — verified by the RepairCoin network.
          </p>
        </div>

        {/* Customer Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image */}
          <div className="relative h-[400px] rounded-xl overflow-hidden order-2 lg:order-1">
            <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
              <img
                src="/img/landing/userewardsanywherecard1.gif"
                alt="Customer Rewards"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to existing image if landing image not found
                  e.currentTarget.src = '/img/redeem.png';
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 order-1 lg:order-2">
            <p className="text-white text-base">
              As a customer, you can earn at one shop and redeem at another — your rewards travel with you.
            </p>

            <div className="space-y-4">
              {customerFeatures.map((feature, index) => (
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
          </div>
        </div>

        {/* Shop Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Content */}
          <div className="space-y-6">
            <p className="text-white text-base">
              As a shop owner, you gain new customers and repeat visits through RepairCoin's cross-shop rewards system.
            </p>

            <div className="space-y-4">
              {shopFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffcc00] flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-white text-sm flex-1">
                    {feature.includes(':') ? (
                      <>
                        <span className="text-[#ffcc00]">{feature.split(':')[0]}:</span>
                        {` ${feature.split(':')[1]}`}
                      </>
                    ) : (
                      <><span className="text-[#ffcc00]">{feature.split(' ')[0]}</span> {feature.substring(feature.indexOf(' '))}</>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="relative h-[400px] rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
              <img
                src="/img/landing/userewardsanywherecard2.gif"
                alt="Shop Rewards"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to existing image if landing image not found
                  e.currentTarget.src = '/img/shop-issue-rewards-1.png';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
