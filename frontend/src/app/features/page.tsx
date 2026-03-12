"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Store,
  Shield,
  Megaphone,
  Smartphone,
  BarChart3,
  Building2,
  UserCheck,
  DollarSign,
  BellRing,
  Star,
  SparklesIcon,
  BadgeCheck,
  HandCoins,
  Wallet,
  UserPlus,
  MessageCircle,
  CalendarCog,
  HandHeart,
  CreditCard,
  Coins,
  Medal
} from "lucide-react";

type TabType = "shop" | "customer";

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

function SectionBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ffcc00] bg-gradient-to-r from-[#ffcc00]/10 to-transparent text-[#ffcc00]">
      <SparklesIcon size={14} className="text-[#ffcc00] shrink-0" />
      <span className="text-xs md:text-sm font-medium whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shop");

  const customerFeatures: Feature[] = [
    {
      icon: <HandCoins className="w-6 h-6" />,
      title: "Earn RCN Tokens",
      description:
        "Earn 1 RCN token for every $10 spent on services. Earn rewards you can use on your next visit.",
      details: [
        "Automatic token rewards for all services",
        "Bonus tokens based on your loyalty tier",
        "Social media integration",
        "25 RCN welcome bonus for new customers"
      ]
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Redeem for Savings",
      description:
        "Grow your business using built-in marketing and engagement tools.",
      details: [
        "100% value at shops where you earned tokens",
        "20% value at any participating shop",
        "Partial redemptions allowed",
        "Digital receipts and transaction history"
      ]
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Referral Rewards",
      description:
        "Use tokens to save on future services and earn more when you refer a friend.",
      details: [
        "Unlimited referrals with unique codes",
        "Friends get 10 RCN welcome bonus",
        "Track referral status in dashboard",
        "Bonuses awarded after first repair"
      ]
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Mobile Experience",
      description:
        "Seamless mobile app experience with built-in QR codes for fast and secure transactions.",
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
      description:
        "Advance through loyalty tiers to unlock bigger and better bonus rewards.",
      details: [
        "Bronze: Standard earning rate",
        "Silver: +2 bonus tokens per transaction",
        "Gold: +5 bonus tokens per transaction",
        "Priority support and exclusive offers"
      ]
    },
    {
      icon: <Store className="w-6 h-6" />,
      title: "Service Marketplace",
      description:
        "Browse and book services from verified shops you can trust.",
      details: [
        "Browse services with filters and search",
        "See RCN earning potential on each service",
        "Favorite services for quick access",
        "View customer reviews and ratings",
        "Share services instantly on social platforms"
      ]
    },
    {
      icon: <CalendarCog className="w-6 h-6" />,
      title: "Appointment Scheduling",
      description:
        "Book services with easy date and time selection options for flexible scheduling and convenience.",
      details: [
        "Select preferred date and time slot",
        "Real-time availability based on shop hours",
        "24-hour reminder email before appointment",
        "View all your appointments in one place",
        "Instant booking confirmation email after payment"
      ]
    },
    {
      icon: <BellRing className="w-6 h-6" />,
      title: "Smart Notifications",
      description:
        "Stay informed with automated alerts and real-time service updates.",
      details: [
        "Email confirmations when you book services",
        "24-hour appointment reminder emails",
        "In-app alerts for bookings and rewards",
        "Transaction receipts and history",
        "Important updates and announcements"
      ]
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Reviews & Ratings",
      description:
        "Share your experience with reviews and ratings to help others choose with confidence.",
      details: [
        "Rate completed services 1-5 stars",
        "Write detailed reviews with photos",
        "Filter services by rating",
        "See shop responses to reviews",
        "Helpful voting on useful reviews"
      ]
    }
  ];

  const shopFeatures: Feature[] = [
    {
      icon: <CalendarCog className="w-6 h-6" />,
      title: "Bookings & Scheduling",
      description:
        "Complete control over scheduling and availability across your business",
      details: [
        "Daily hours with break time settings",
        "Configure slot duration and buffer time",
        "Manage concurrent booking limits",
        "Custom hours for holidays and special dates",
        "Monthly calendar view of all appointments"
      ]
    },
    {
      icon: <BellRing className="w-6 h-6" />,
      title: "Automated Notifications",
      description:
        "Control your services and bookings with a simple, unified system.",
      details: [
        "Instant booking confirmations for customers",
        "Automated 24-hour appointment reminders",
        "Get notified when new bookings arrive",
        "Alerts for upcoming appointments",
        "Fully automated notifications"
      ]
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Customer Messaging",
      description:
        "Instantly communicate with customers via chat or SMS.",
      details: [
        "Instantly confirm or update appointments with customers",
        "Use quick reply templates to save time",
        "Communicate easily through in-app chat and SMS",
        "Keep customers engaged and coming back"
      ]
    },
    {
      icon: <HandHeart className="w-6 h-6" />,
      title: "Rewards & Referrals",
      description:
        "Reward customers automatically when the service is completed — no punch cards, no manual math.",
      details: [
        "Reward customers instantly for services",
        "Track customer history and preferences",
        "Automated loyalty tier management",
        "Customer communication tools"
      ]
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Redemptions & Payouts",
      description:
        "Process customer token redemptions seamlessly within your dashboard.",
      details: [
        "Real-time redemption notifications",
        "Instant customer identification via QR",
        "Automatic value calculation",
        "Digital receipts and records"
      ]
    },
    {
      icon: <Megaphone className="w-6 h-6" />,
      title: "Promotions & Re-booking",
      description:
        "Grow your business using built-in marketing and engagement tools.",
      details: [
        "Promotional campaign creation",
        "Customer referral incentives",
        "Social media integration",
        "Review management system",
        "Customer messaging and notifications"
      ]
    },
    {
      icon: <Store className="w-6 h-6" />,
      title: "Service Marketplace",
      description:
        "Control your services and bookings with a simple, unified system.",
      details: [
        "Create and manage service listings",
        "Upload service images to DigitalOcean Spaces",
        "Set pricing, duration, and categories",
        "Track bookings and service analytics",
        "View and respond to customer reviews"
      ]
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Performance Dashboard",
      description:
        "Monitor business performance while uncovering valuable customer insights.",
      details: [
        "Revenue and profit tracking",
        "Customer retention metrics",
        "Service popularity analysis",
        "ROI on token investments"
      ]
    },
    {
      icon: <Coins className="w-6 h-6" />,
      title: "RCN Token Management",
      description:
        "Purchase, track, and manage your RCN balance with ease.",
      details: [
        "Tiered pricing based on RCG holdings",
        "Standard: $0.10, Premium: $0.08, Elite: $0.06",
        "Bulk purchase discounts available",
        "Real-time inventory tracking"
      ]
    },
  ];

  const tokenCards: TokenCard[] = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "RCN Utility Tokens",
      description: "Earn it. Use it. Redeem it with ease.",
      iconBg: "bg-[#ffcc00]",
      details: [
        { label: "Value", value: "1 RCN = $0.10 USD" },
        { label: "Purpose", value: "Customer rewards and redemptions" },
        { label: "Earning", value: "1 RCN per $10 spent on repairs" },
        {
          label: "Usage",
          value: "100% value at earning shop, 20% elsewhere"
        },
        {
          label: "Tiers",
          value: "Bonus tokens for Silver (+2) and Gold (+5) customers"
        }
      ]
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "RCG Governance Tokens",
      description:
        "Structured for effective governance and sustainable long-term value.",
      iconBg: "bg-[#ffcc00]",
      details: [
        { label: "Supply", value: "100M fixed supply" },
        { label: "Purpose", value: "Shop tier benefits and governance" },
        {
          label: "Tiers",
          value: "Standard/Premium/Elite (10K/50K/200K+ RCG)"
        },
        { label: "Benefits", value: "Better RCN pricing for shops" },
        { label: "Revenue", value: "10% to stakers, 10% to DAO" }
      ]
    }
  ];

  const techFeatures = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Blockchain Powered",
      description:
        "Built on Base Sepolia with Thirdweb SDK v5 for secure, transparent transactions"
    },
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Enterprise Ready",
      description:
        "PostgreSQL database with domain-driven architecture for scalability"
    },
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: "User Focused",
      description:
        "Next.js 15 + React 19 frontend with mobile-first design"
    }
  ];

  const getFeatures = (): Feature[] => {
    return activeTab === "shop" ? shopFeatures : customerFeatures;
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Section */}
      <section className="relative min-h-[75vh] overflow-hidden">
        {/* Background particle wave pattern */}
        <div
          className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
          style={{
            backgroundImage: "url(/img/about/bg-design.png)",
            backgroundSize: "contain",
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[75vh] max-w-7xl mx-auto px-4 pt-24 md:pt-0">
          {/* Badge */}
          <div className="flex justify-center mb-6 md:mb-10">
            <SectionBadge label="Two Experiences, One Loyalty Network" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-center leading-tight mb-4 md:mb-6">
            Features that connect
            <br />
            service,{" "}
            <span className="relative inline-block">
              rewards,
              {/* Yellow underline curve */}
              <svg
                className="absolute -bottom-1 md:-bottom-2 -left-[3%] w-[106%] h-[10px] md:h-[14px]"
                viewBox="0 0 311 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 5.5C80 1.5 230 1.5 309 5.5"
                  stroke="#ffcc00"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>{" "}
            and loyalty
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-lg text-center text-gray-400 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2">
            Rewards for customers. Growth for shops.
            <br />
            Every service creates value on both sides of the counter.
          </p>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-10 md:mb-16">
            <div className="flex items-center gap-1 bg-[#181818] border border-[#2a2a2a] rounded-full p-1">
              <button
                onClick={() => setActiveTab("shop")}
                className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                  activeTab === "shop"
                    ? "bg-[#FFCC00] text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Store className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Shop Owner
              </button>
              <button
                onClick={() => setActiveTab("customer")}
                className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
                  activeTab === "customer"
                    ? "bg-[#FFCC00] text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Customers
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-12 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {getFeatures().map((feature, index) => (
            <div
              key={index}
              className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[rgba(83,83,83,0.25)] rounded-2xl p-6 hover:border-[#ffcc00]/30 transition-all duration-300"
            >
              {/* Icon with shadow effect */}
              <div className="mb-5">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-full" />
                  <div className="relative p-3 bg-[#ffcc00] rounded-full text-black">
                    {feature.icon}
                  </div>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white mb-2">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-[#999999] text-sm mb-5">
                {feature.description}
              </p>

              {/* Details with yellow checkmark badges */}
              <ul className="space-y-3">
                {feature.details.map((detail, detailIndex) => (
                  <li
                    key={detailIndex}
                    className="flex items-start gap-3 text-sm"
                  >
                    <BadgeCheck className="w-5 h-5 shrink-0 mt-0.5 text-[#ffcc00]" />
                    <span className="text-white">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Dual-Token Business Model Section */}
      <section className="max-w-7xl mx-auto px-4 py-10 md:py-16">
        <div className="flex justify-center mb-4 md:mb-6">
          <SectionBadge label="Reward & Governance Model" />
        </div>

        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-3 md:mb-4">
          Dual-Token Business Model
        </h2>
        <p className="text-sm md:text-lg text-gray-400 text-center mb-8 md:mb-12 px-2">
          Built for stability, sustainable growth, and real-world use.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tokenCards.map((card, index) => (
            <div
              key={index}
              className="bg-[#101010] border border-[rgba(83,83,83,0.21)] rounded-lg p-6"
            >
              {/* Icon with shadow effect */}
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffcc00]/20 blur-md rounded-lg" />
                  <div
                    className={`relative p-2 ${card.iconBg} rounded-lg text-black`}
                  >
                    {card.icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {card.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-[#999999] text-sm mb-4">
                {card.description}
              </p>

              {/* Details with yellow bullets and bold labels */}
              <ul className="space-y-2">
                {card.details.map((detail, detailIndex) => (
                  <li
                    key={detailIndex}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="text-[#ffcc00] mt-1.5 shrink-0">
                      &#9702;
                    </span>
                    <span>
                      <span className="font-semibold text-white">
                        {detail.label}:
                      </span>
                      <span className="text-white"> {detail.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Built on Modern Technology Section */}
      <section className="max-w-7xl mx-auto px-4 py-10 md:py-16">
        <div className="flex justify-center mb-4 md:mb-6">
          <SectionBadge label="Core Infrastructure" />
        </div>

        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-3 md:mb-4">
          Built on Modern Technology
        </h2>
        <p className="text-sm md:text-lg text-gray-400 text-center mb-8 md:mb-12 px-2">
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

              <h3 className="text-lg font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-[#999999] text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA / Footer Section */}
      <section className="relative overflow-hidden bg-[#0D0D0D] py-16 md:py-28 pb-24 md:pb-28">
        {/* Background wave pattern */}
        <div
          className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
          style={{
            backgroundImage: "url(/img/about/bg-design.png)",
            backgroundSize: "contain",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white leading-tight">
            Bring smart rewards
            <br />
            <span className="relative inline-block">
              <span className="relative inline-block">to your services</span>
              <span className="relative inline-block w-2/3">
                <svg
                  className="absolute bottom-1 md:bottom-5 -left-[3%] w-[106%] h-[12px] md:h-[18px]"
                  viewBox="0 0 311 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 5.5C80 1.5 230 1.5 309 5.5"
                    stroke="#ffcc00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </h2>

          <p className="mt-10 text-white/50 text-base max-w-md leading-relaxed">
            Join RepairCoin and start rewarding customers, managing loyalty,
            and tracking growth&mdash;all in one platform.
          </p>

          <Link
            href={activeTab === "shop" ? "/choose?role=shop" : "/choose?role=customer"}
            className="mt-8 bg-[#FFCC00] text-black hover:bg-[#e6b800] transition-all duration-200 px-8 py-3 rounded-lg font-semibold"
          >
            {activeTab === "shop" ? "Join as Shop Owner" : "Join as Customer"} &rarr;
          </Link>
        </div>

        {/* RepairCoin logo -- bottom left */}
        <div className="absolute bottom-6 left-4 md:left-8 z-10">
          <div className="relative w-[120px] md:w-[150px] h-[28px] md:h-[34px] opacity-75">
            <Image
              src="/img/nav-logo.png"
              alt="RepairCoin"
              fill
              className="object-contain object-left"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
