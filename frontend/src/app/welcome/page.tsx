'use client';

import Link from 'next/link';

export default function WelcomePage() {
  const perspectives = [
    {
      title: 'Customer Dashboard',
      description: 'Earn RepairCoin tokens for repairs and track your loyalty progress',
      icon: '👤',
      href: '/',
      color: 'from-blue-600 to-indigo-600',
      bgColor: 'from-blue-50 to-indigo-100',
      features: [
        'View RCN token balance',
        'Track tier progression (Bronze/Silver/Gold)',
        'See daily and lifetime earnings',
        'Connect Web3 wallet',
        'Redeem tokens at participating shops'
      ]
    },
    {
      title: 'Shop Dashboard',
      description: 'Manage your repair shop and purchase RCN tokens for customer bonuses',
      icon: '🏪',
      href: '/shop',
      color: 'from-green-600 to-emerald-600',
      bgColor: 'from-green-50 to-emerald-100',
      features: [
        'Purchase RCN at $1.00 per token',
        'Track tier bonus distribution',
        'Monitor shop analytics',
        'Manage cross-shop redemptions',
        'View purchase history'
      ]
    },
    {
      title: 'Admin Dashboard',
      description: 'Platform administration with comprehensive management tools',
      icon: '⚡',
      href: '/admin',
      color: 'from-red-600 to-pink-600',
      bgColor: 'from-red-50 to-pink-100',
      features: [
        'Platform-wide statistics',
        'Customer management',
        'Shop approval and verification',
        'Token minting controls',
        'System monitoring'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="text-8xl mb-8">🔧</div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              RepairCoin
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The Web3 loyalty token system that rewards customers and empowers repair shops
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <span className="flex items-center bg-white px-4 py-2 rounded-full shadow-sm">
                <span className="text-blue-500 mr-2">🌐</span>
                Built on Base Sepolia
              </span>
              <span className="flex items-center bg-white px-4 py-2 rounded-full shadow-sm">
                <span className="text-green-500 mr-2">🔒</span>
                Secure & Transparent
              </span>
              <span className="flex items-center bg-white px-4 py-2 rounded-full shadow-sm">
                <span className="text-purple-500 mr-2">⚡</span>
                Real-time Rewards
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Perspectives Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Choose Your Perspective
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Access the RepairCoin ecosystem from different viewpoints - each tailored for specific users and use cases
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {perspectives.map((perspective, index) => (
            <div
              key={perspective.href}
              className={`relative bg-gradient-to-br ${perspective.bgColor} rounded-3xl shadow-xl border border-white/50 overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              </div>

              <div className="relative p-8">
                {/* Icon */}
                <div className="text-6xl mb-6 text-center">
                  {perspective.icon}
                </div>

                {/* Title & Description */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {perspective.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {perspective.description}
                  </p>
                </div>

                {/* Features */}
                <div className="mb-8">
                  <h4 className="font-semibold text-gray-900 mb-4 text-center">Key Features</h4>
                  <ul className="space-y-2">
                    {perspective.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-gray-700 text-sm">
                        <span className="text-green-500 mr-2 mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <Link
                  href={perspective.href}
                  className={`block w-full bg-gradient-to-r ${perspective.color} text-white font-bold py-4 px-6 rounded-2xl text-center transition-all duration-200 transform group-hover:scale-105 shadow-lg hover:shadow-xl`}
                >
                  Enter {perspective.title.split(' ')[0]}
                </Link>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-4 right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              <div className="absolute bottom-4 left-4 w-12 h-12 bg-white/5 rounded-full blur-lg"></div>
            </div>
          ))}
        </div>

        {/* Additional Info Section */}
        <div className="mt-20 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
            <h3 className="text-3xl font-bold text-gray-900 mb-6">
              How RepairCoin Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-5xl mb-4">🛠️</div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">Complete Repairs</h4>
                <p className="text-gray-600">
                  Customers earn RCN tokens for repairs at participating shops. Bigger repairs = more tokens!
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl mb-4">🏆</div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">Tier Bonuses</h4>
                <p className="text-gray-600">
                  Bronze, Silver, and Gold tiers provide additional bonus tokens funded by shop purchases.
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl mb-4">🔄</div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">Cross-Shop Redemption</h4>
                <p className="text-gray-600">
                  Use earned tokens at any participating shop with our 20% cross-shop redemption system.
                </p>
              </div>
            </div>

            <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
              <h4 className="text-2xl font-bold text-gray-900 mb-4">
                🌟 Built for the Future of Loyalty
              </h4>
              <p className="text-gray-700 text-lg leading-relaxed max-w-4xl mx-auto">
                RepairCoin leverages blockchain technology to create a transparent, secure, and interoperable 
                loyalty system. With anti-arbitrage protection, real-time verification, and comprehensive 
                analytics, it's designed to benefit customers, shops, and the entire repair ecosystem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}