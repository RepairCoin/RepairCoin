"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  Store,
  Shield,
  ShoppingBag,
  CreditCard,
  Gift,
  QrCode,
  Medal,
  Coins,
  Heart,
  BarChart3,
  Building2,
  UserCheck,
  DollarSign,
  Activity
} from "lucide-react";
import Image from "next/image";

type TabType = "customer" | "shop" | "admin";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

interface TokenCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: { label: string; value: string }[];
  iconBg: string;
}

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("customer");

  const customerFeatures: Feature[] = [
    {
      icon: <Coins className="w-6 h-6" />,
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
      icon: <ShoppingBag className="w-6 h-6" />,
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
      description: "Use tokens to save money on future repairs",
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
      icon: <Medal className="w-6 h-6" />,
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

  const shopFeatures: Feature[] = [
    {
      icon: <Heart className="w-6 h-6" />,
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
      icon: <Coins className="w-6 h-6" />,
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
      icon: <BarChart3 className="w-6 h-6" />,
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

  const adminFeatures: Feature[] = [
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
        "Token pricing and tier management",
        "Revenue sharing distribution (10% to stakers, 10% to DAO)"
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
      icon: <Activity className="w-6 h-6" />,
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

  const tokenCards: TokenCard[] = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "RCN Utility Tokens",
      description: "Earn it. Use it. Redeem it.",
      iconBg: "bg-[#ffcc00]",
      details: [
        { label: "Value", value: "1 RCN = $0.10 USD" },
        { label: "Purpose", value: "Customer rewards and redemptions" },
        { label: "Earning", value: "1 RCN per $10 spent on repairs" },
        { label: "Usage", value: "100% value at earning shop, 20% elsewhere" },
        { label: "Tiers", value: "Bonus tokens for Silver (+2) and Gold (+5) customers" }
      ]
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "RCG Governance Tokens",
      description: "Built for governance and long-term value.",
      iconBg: "bg-[#ffcc00]",
      details: [
        { label: "Supply", value: "100M fixed supply" },
        { label: "Purpose", value: "Shop tier benefits and governance" },
        { label: "Tiers", value: "Standard/Premium/Elite (10K/50K/200K+ RCG)" },
        { label: "Benefits", value: "Better RCN pricing for shops" },
        { label: "Revenue", value: "10% to stakers, 10% to DAO" }
      ]
    }
  ];

  const techFeatures = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Blockchain Powered",
      description: "Built on Base Sepolia with Thirdweb SDK v5 for secure, transparent transactions"
    },
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Enterprise Ready",
      description: "PostgreSQL database with domain-driven architecture for scalability"
    },
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: "User Focused",
      description: "Next.js 15 + React 19 frontend with mobile-first design"
    }
  ];

  const getFeatures = (): Feature[] => {
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

  const getTabDescription = (): string => {
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
    <div className="min-h-screen bg-[#191919] text-white">
      {/* Hero Section with Background Image - extends behind feature cards */}
      <div className="relative">
        {/* Background image - wave pattern - extends to cover cards area */}
        <div className="absolute inset-0 h-[700px] md:h-[700px]">
          <Image
            src="/img/features/hero-bg.png"
            alt="Hero background"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Subtle overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 pt-44">
          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-center mb-6">
            RepairCoin Features
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-center text-white/80 max-w-xl mx-auto mb-10">
            Discover how RepairCoin revolutionizes the repair industry with blockchain-powered loyalty rewards
          </p>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 flex gap-1 shadow-lg">
              <button
                onClick={() => setActiveTab("customer")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm font-medium ${
                  activeTab === "customer"
                    ? "bg-[#ffcc00] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Customers</span>
              </button>
              <button
                onClick={() => setActiveTab("shop")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm font-medium ${
                  activeTab === "shop"
                    ? "bg-[#ffcc00] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <Store className="w-5 h-5" />
                <span>Shops</span>
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm font-medium ${
                  activeTab === "admin"
                    ? "bg-[#ffcc00] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <Shield className="w-5 h-5" />
                <span>Admins</span>
              </button>
            </div>
          </div>

          {/* Tab Description */}
          <p className="text-center text-white/70 max-w-3xl mx-auto mb-12">
            {getTabDescription()}
          </p>
        </div>

        {/* Features Grid - positioned within hero background */}
        <div className="relative max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFeatures().map((feature, index) => (
            <div
              key={index}
              className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 hover:border-[#ffcc00]/30 transition-all duration-300"
            >
              {/* Icon with shadow effect */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                  <div className="relative p-2 bg-[#ffcc00] rounded-lg text-black">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
              </div>

              {/* Description */}
              <p className="text-[#999999] mb-4">{feature.description}</p>

              {/* Details with yellow bullets */}
              <ul className="space-y-2">
                {feature.details.map((detail, detailIndex) => (
                  <li key={detailIndex} className="flex items-start gap-2 text-sm">
                    <span className="text-[#ffcc00] mt-1.5">•</span>
                    <span className="text-white">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Dual-Token Business Model Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          Dual-Token Business Model
        </h2>
        <p className="text-lg text-[#e8e8e8] text-center mb-12">
          Designed for stability, growth, and real-world usability.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tokenCards.map((card, index) => (
            <div
              key={index}
              className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6"
            >
              {/* Icon with shadow effect */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                  <div className={`relative p-2 ${card.iconBg} rounded-lg text-black`}>
                    {card.icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
              </div>

              {/* Description */}
              <p className="text-[#999999] text-sm mb-4">{card.description}</p>

              {/* Details with yellow bullets and bold labels */}
              <ul className="space-y-2">
                {card.details.map((detail, detailIndex) => (
                  <li key={detailIndex} className="flex items-start gap-2 text-sm">
                    <span className="text-[#ffcc00] mt-1.5">•</span>
                    <span>
                      <span className="font-semibold text-white">{detail.label}:</span>
                      <span className="text-white"> {detail.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Built on Modern Technology Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          Built on Modern Technology
        </h2>
        <p className="text-lg text-[#e8e8e8] text-center mb-12">
          Powering RepairCoin with speed, security, and real scalability.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {techFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6 text-center"
            >
              {/* Centered icon with shadow effect */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                  <div className="relative p-2 bg-[#ffcc00] rounded-lg text-black">
                    {feature.icon}
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-[#999999] text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl min-h-[300px]">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/img/features/getstarted-bg.png')" }}
          />
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Content */}
          <div className="relative flex flex-col lg:flex-row items-center justify-between h-full">
            {/* Text content */}
            <div className="px-8 md:px-16 py-12 lg:max-w-[60%]">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-lg text-[#e8e8e8] mb-8 max-w-2xl">
                Sign up now and turn every repair, service, and purchase into rewards. Start building your RCN balance from day one.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/customer"
                  className="bg-[#ffcc00] text-black px-8 py-3 rounded-lg font-medium hover:bg-[#e6b800] transition-colors inline-flex items-center justify-center"
                >
                  Join as Customer →
                </Link>
                <Link
                  href="/register/shop"
                  className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
                >
                  Join as Shop Owner →
                </Link>
              </div>
            </div>

            {/* Persons image - visible on larger screens */}
            <div className="hidden lg:block absolute right-0 bottom-0 h-full w-[40%]">
              <Image
                src="/img/features/getstarted-persons.png"
                alt="Happy customers"
                fill
                className="object-contain object-right-bottom"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
