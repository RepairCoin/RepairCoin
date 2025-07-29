'use client';

import Image from 'next/image';

interface PricingTiersProps {
  techBgImage?: string;
}

const tiers = [
  {
    name: 'Bronze Partner',
    subtitle: 'Just sign up & start rewarding',
    color: 'from-amber-600 to-amber-700',
    bgColor: 'bg-gradient-to-br from-amber-100 to-amber-200',
    borderColor: 'border-amber-300',
    buttonColor: 'bg-amber-600 hover:bg-amber-700',
    perks: [
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet'
    ],
    character: '/bronze-character.png' // You'll need to add this image
  },
  {
    name: 'Silver Partner',
    subtitle: '20+ Customer Redemptions',
    color: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200',
    borderColor: 'border-gray-300',
    buttonColor: 'bg-gray-600 hover:bg-gray-700',
    featured: true,
    perks: [
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet'
    ],
    character: '/silver-character.png' // You'll need to add this image
  },
  {
    name: 'Gold Partner',
    subtitle: '50+ Customer Redemptions',
    color: 'from-yellow-500 to-yellow-600',
    bgColor: 'bg-gradient-to-br from-yellow-100 to-yellow-200',
    borderColor: 'border-yellow-300',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
    perks: [
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet',
      'Lorem ipsum dolor sit amet'
    ],
    character: '/gold-character.png' // You'll need to add this image
  }
];

export default function PricingTiers({ techBgImage }: PricingTiersProps) {
  return (
    <section className="relative py-20 px-4 bg-gray-50">
      {/* Background Pattern */}
      {techBgImage && (
        <div className="absolute inset-0 opacity-5">
          <Image
            src={techBgImage}
            alt=""
            fill
            className="object-cover"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Partnership Level
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Unlock exclusive benefits and rewards as you grow with RepairCoin
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 ${tier.bgColor} ${tier.borderColor} border-2 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
                tier.featured ? 'md:scale-105' : ''
              }`}
            >
              {/* Card Header */}
              <div className="text-center mb-6">
                <h3 className={`text-2xl font-bold bg-gradient-to-r ${tier.color} bg-clip-text text-transparent mb-2`}>
                  {tier.name}
                </h3>
                <p className="text-sm text-gray-600">{tier.subtitle}</p>
              </div>

              {/* Perks Section */}
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-4">Perks</h4>
                <ul className="space-y-3">
                  {tier.perks.map((perk, perkIndex) => (
                    <li key={perkIndex} className="flex items-start">
                      <svg
                        className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-green-600`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700 text-sm">{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Character Image */}
              <div className="relative h-48 mb-6">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Placeholder for character image */}
                  <div className="text-6xl">
                    {index === 0 && '👩‍💼'}
                    {index === 1 && '👨‍💼'}
                    {index === 2 && '🧑‍💼'}
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                className={`w-full py-4 px-6 rounded-xl font-semibold text-white ${tier.buttonColor} transition-colors duration-200 transform hover:scale-105`}
              >
                Get Started →
              </button>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            Ready to join the RepairCoin network?
          </p>
          <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
            Register Your Shop Today
          </button>
        </div>
      </div>
    </section>
  );
}