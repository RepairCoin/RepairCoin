"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, Store, Shield, Users, DollarSign, CreditCard, QrCode, Gift } from "lucide-react";

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<"customer" | "shop" | "admin">("customer");

  const customerFeatures = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Earn RCN Tokens",
      description: "Earn 1 RCN token for every $10 spent on repairs",
      details: [
        "Automatic token rewards for all repair services",
        "Bonus tokens based on loyalty tier (Bronze/Silver/Gold)",
        "No daily or monthly earning limits",
        "25 RCN welcome bonus for new customers"
      ]
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Redeem for Savings",
      description: "Use tokens to save money on future repairs",
      details: [
        "100% value at shops where you earned tokens",
        "20% value at any participating shop",
        "Partial redemptions allowed",
        "Digital receipts and transaction history"
      ]
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Referral Rewards",
      description: "Earn 25 RCN for each successful referral",
      details: [
        "Unlimited referrals with unique codes",
        "Friends get 10 RCN welcome bonus",
        "Track referral status in dashboard",
        "Bonuses awarded after first repair"
      ]
    },
    {
      icon: <QrCode className="w-6 h-6" />,
      title: "Mobile Experience",
      description: "Seamless mobile app with QR codes",
      details: [
        "QR code for instant shop identification",
        "Real-time balance and notifications",
        "Shop finder with ratings and reviews",
        "Secure wallet integration"
      ]
    },
    {
      icon: <Gift className="w-6 h-6" />,
      title: "Loyalty Tiers",
      description: "Advance through tiers for bonus rewards",
      details: [
        "Bronze: Standard earning rate",
        "Silver: +2 bonus tokens per transaction",
        "Gold: +5 bonus tokens per transaction", 
        "Priority support and exclusive offers"
      ]
    }
  ];

  const shopFeatures = [
    {
      icon: <Store className="w-6 h-6" />,
      title: "Customer Loyalty Platform",
      description: "Build lasting relationships with token rewards",
      details: [
        "Reward customers instantly for repairs",
        "Track customer history and preferences",
        "Automated loyalty tier management",
        "Customer communication tools"
      ]
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "RCN Token Management",
      description: "Purchase and manage token inventory",
      details: [
        "Tiered pricing based on RCG holdings",
        "Standard: $0.10, Premium: $0.08, Elite: $0.06",
        "Bulk purchase discounts available",
        "Real-time inventory tracking"
      ]
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Redemption Processing",
      description: "Process customer token redemptions seamlessly",
      details: [
        "Real-time redemption notifications",
        "Instant customer identification via QR",
        "Automatic value calculation",
        "Digital receipts and records"
      ]
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Analytics & Reports",
      description: "Track performance and customer insights",
      details: [
        "Revenue and profit tracking",
        "Customer retention metrics",
        "Service popularity analysis",
        "ROI on token investments"
      ]
    },
    {
      icon: <Gift className="w-6 h-6" />,
      title: "Marketing Tools",
      description: "Grow your business with built-in marketing",
      details: [
        "Promotional campaign creation",
        "Customer referral incentives",
        "Social media integration",
        "Review management system"
      ]
    }
  ];

  const adminFeatures = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Platform Management",
      description: "Comprehensive admin control and monitoring",
      details: [
        "Shop verification and approval",
        "Customer management and support",
        "Platform-wide analytics dashboard",
        "Emergency controls and security"
      ]
    },
    {
      icon: <Store className="w-6 h-6" />,
      title: "Shop Operations",
      description: "Manage shop network and subscriptions",
      details: [
        "$500/month subscription management",
        "Shop tier classification (Standard/Premium/Elite)",
        "Performance monitoring and support",
        "Verification process management"
      ]
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Token Treasury",
      description: "Manage platform token economics",
      details: [
        "RCN token minting and supply control",
        "RCG governance token management",
        "Revenue sharing distribution (10% to stakers, 10% to DAO)",
        "Token pricing and tier management"
      ]
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Customer Support",
      description: "Advanced customer service tools",
      details: [
        "Customer account management",
        "Transaction dispute resolution",
        "Tier adjustment capabilities",
        "Comprehensive audit trails"
      ]
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Financial Oversight",
      description: "Monitor platform financial health",
      details: [
        "Revenue tracking and reporting",
        "Subscription billing management",
        "Token economics monitoring",
        "Compliance and audit tools"
      ]
    }
  ];

  const getFeatures = () => {
    switch (activeTab) {
      case "customer":
        return customerFeatures;
      case "shop":
        return shopFeatures;
      case "admin":
        return adminFeatures;
      default:
        return customerFeatures;
    }
  };

  const getTabDescription = () => {
    switch (activeTab) {
      case "customer":
        return "Earn tokens with every repair and redeem them for savings at participating shops";
      case "shop":
        return "Build customer loyalty with a comprehensive token reward platform";
      case "admin":
        return "Manage the RepairCoin platform with advanced administrative tools";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Header */}
     {/*  <div className="bg-gradient-to-r from-gray-900 to-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <img src="/img/nav-logo.png" alt="RepairCoin" className="h-8" />
            </div>
          </div>
        </div>
      </div> */}

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-900 to-[#0D0D0D] py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            RepairCoin Features
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover how RepairCoin revolutionizes the repair industry with blockchain-powered loyalty rewards
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <div className="flex justify-center">
          <div className="bg-gray-800 rounded-lg p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab("customer")}
              className={`px-6 py-3 rounded-md flex items-center space-x-2 transition-all duration-200 ${
                activeTab === "customer"
                  ? "bg-yellow-400 text-gray-900 font-medium"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
            >
              <User className="w-5 h-5" />
              <span>Customers</span>
            </button>
            <button
              onClick={() => setActiveTab("shop")}
              className={`px-6 py-3 rounded-md flex items-center space-x-2 transition-all duration-200 ${
                activeTab === "shop"
                  ? "bg-yellow-400 text-gray-900 font-medium"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Store className="w-5 h-5" />
              <span>Shops</span>
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-6 py-3 rounded-md flex items-center space-x-2 transition-all duration-200 ${
                activeTab === "admin"
                  ? "bg-yellow-400 text-gray-900 font-medium"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Admins</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Description */}
      <div className="max-w-7xl mx-auto px-4 mb-12 text-center">
        <p className="text-lg text-gray-400">{getTabDescription()}</p>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {getFeatures().map((feature, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-yellow-400 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-400/10"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-yellow-400 rounded-lg text-gray-900">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
              </div>
              <p className="text-gray-400 mb-4">{feature.description}</p>
              <ul className="space-y-2">
                {feature.details.map((detail, detailIndex) => (
                  <li key={detailIndex} className="flex items-start space-x-2 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Business Model Section */}
      <div className="bg-gray-900 border-t border-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            Dual-Token Business Model
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-500 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-white">RCN Utility Tokens</h3>
              </div>
              <div className="space-y-3 text-gray-300">
                <p>• <strong>Value:</strong> 1 RCN = $0.10 USD</p>
                <p>• <strong>Purpose:</strong> Customer rewards and redemptions</p>
                <p>• <strong>Earning:</strong> 1 RCN per $10 spent on repairs</p>
                <p>• <strong>Usage:</strong> 100% value at earning shop, 20% elsewhere</p>
                <p>• <strong>Tiers:</strong> Bonus tokens for Silver (+2) and Gold (+5) customers</p>
              </div>
            </div>
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-white">RCG Governance Tokens</h3>
              </div>
              <div className="space-y-3 text-gray-300">
                <p>• <strong>Supply:</strong> 100M fixed supply</p>
                <p>• <strong>Purpose:</strong> Shop tier benefits and governance</p>
                <p>• <strong>Tiers:</strong> Standard/Premium/Elite (10K/50K/200K+ RCG)</p>
                <p>• <strong>Benefits:</strong> Better RCN pricing for shops</p>
                <p>• <strong>Revenue:</strong> 10% to stakers, 10% to DAO</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="bg-[#0D0D0D] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            Built on Modern Technology
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Blockchain Powered</h3>
              <p className="text-gray-400">Built on Base Sepolia with Thirdweb SDK v5 for secure, transparent transactions</p>
            </div>
            <div className="text-center">
              <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Enterprise Ready</h3>
              <p className="text-gray-400">PostgreSQL database with domain-driven architecture for scalability</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">User Focused</h3>
              <p className="text-gray-400">Next.js 15 + React 19 frontend with mobile-first design</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-800 mb-8 max-w-2xl mx-auto">
            Join the RepairCoin ecosystem and revolutionize how you handle repair shop loyalty
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/customer"
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Join as Customer
            </Link>
            <Link
              href="/register/shop"
              className="bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Register Your Shop
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <img src="/img/nav-logo.png" alt="RepairCoin" className="h-6" />
          </div>
          <p className="text-gray-500">
            © 2024 RepairCoin. All rights reserved. Built with blockchain technology for the future of automotive repair.
          </p>
        </div>
      </footer>
    </div>
  );
}