"use client";

import { useState } from "react";
import Section from "@/components/Section";
import { TierCard } from "./TierCard";

interface RewardYourCustomerProps {
  techBgImage: string;
  activeTab: "shop" | "customer";
  setActiveTab: (tab: "shop" | "customer") => void;
}

interface TierData {
  name: string;
  subName: string;
  header?: string;
  subHeader?: string;
  level: string;
  requirement: string;
  features: string[];
  featuresPrefix: string;
  img: string;
  textColor: string;
  subtitleColor: string;
  prefixColor: string;
}

const tierShopData: TierData[] = [
  {
    name: "Bronze Partner",
    subName: "Just sign up & start rewarding",
    level: "Welcome Rewards",
    requirement: "0-199 Lifetime RCN",
    featuresPrefix: "Your Benefits:",
    features: [
      "Buy RCN at $0.10, customers redeem at $1.00 value",
      "Issue 10 RCN for small repairs ($50-99)",
      "Issue 25 RCN for large repairs ($100+)",
      "Automated +10/+20/+30 tier bonuses",
      "Real-time dashboard with QR scanning",
      "Join 20% cross-shop redemption network",
      "Track referrals and customer lifetime value",
    ],
    img: "/img/rewards-customer-1.png",
    textColor: "text-white",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Silver Partner",
    subName: "25+ Customer Redemptions",
    level: "Loyalty Champion",
    requirement: "200-999 Lifetime RCN",
    featuresPrefix: "All Bronze benefits, plus:",
    features: [
      "5% discount on bulk RCN purchases (1000+ tokens)",
      "Featured shop status in customer app",
      "Custom promotional campaigns (2x/3x reward events)",
      "Advanced analytics: retention, CLV, redemption patterns",
      "Priority customer support response",
      "Co-marketing opportunities with RepairCoin",
    ],
    img: "/img/rewards-customer-2.png",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Gold Partner",
    subName: "50+ Customer Redemptions",
    level: "VIP Elite Status",
    requirement: "1,000+ Lifetime RCN",
    featuresPrefix: "All Silver benefits, plus:",
    features: [
      "10% discount on all RCN purchases",
      "Custom reward rules and tier configurations",
      "Dedicated account manager",
      "Quarterly strategy sessions with leadership",
      "Case study and PR opportunities",
    ],
    img: "/img/rewards-customer-3.png",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
];

const tierCustomerData: TierData[] = [
  {
    name: "Bronze Tier",
    subName: "Entry Level",
    header: "Free upon Sign-Up",
    subHeader: "What you get:",
    level: "Welcome Rewards",
    requirement: "0-199 Lifetime RCN",
    featuresPrefix: "Your Benefits:",
    features: [
      "Earn 10-25 RCN per repair service",
      "+10 RCN automatic bonus on every transaction",
      "$1 redemption value at your home shop",
      "20% balance usable at partner shops",
      "Instant mobile wallet activation",
      "Real-time transaction notifications",
    ],
    img: "/img/rewards-shop-1.png",
    textColor: "text-white",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Silver Tier",
    subName: "Middle Level",
    header: "Earn and Hold 250 RCN",
    subHeader: "All free features, plus:",
    level: "Loyalty Champion",
    requirement: "200-999 Lifetime RCN",
    featuresPrefix: "All Bronze benefits, plus:",
    features: [
      "+20 RCN automatic bonus per repair",
      "Priority service booking at shops",
      "Exclusive seasonal promotions (2x rewards)",
      "Birthday month: 50 RCN bonus gift",
      "Referral rewards: 25 RCN per success",
      "Monthly prize draws for free services",
    ],
    img: "/img/rewards-shop-2.png",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Gold Tier",
    subName: "High Level",
    header: "Earn and Hold 1,000 RCN",
    subHeader: "All starter features, plus:",
    level: "VIP Elite Status",
    requirement: "1,000+ Lifetime RCN",
    featuresPrefix: "All Silver benefits, plus:",
    features: [
      "+30 RCN automatic bonus per repair",
      "Free annual device health check ($50 value)",
      "VIP customer support hotline",
      "Exclusive partner discounts (10-20% off)",
      "Quarterly bonus rewards (100 RCN)",
      "Extended warranty options at partner shops",
      "Early access to new shop locations",
    ],
    img: "/img/rewards-shop-3.png",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
];

const RewardYourCustomer: React.FC<RewardYourCustomerProps> = ({
  activeTab,
  setActiveTab,
  techBgImage,
}) => {

  return (
    <div
      className="w-full pt-20 md:pt-10 bg-[#0D0D0D]"
      style={{ backgroundImage: `url(${techBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-col justify-between items-center py-8 xl:py-20 gap-34">
          <div className="w-full flex flex-col items-center gap-6">
            <div className="w-full flex flex-col justify-center items-center gap-10 md:gap-20">
              {/* Header */}
              {activeTab === "shop" ? (
                <div className="flex flex-col md:w-1/2 items-center md:gap-6 gap-4">
                  <p className="text-[#FFCC00] text-center text-base md:text-lg tracking-wide">
                    Partner with RepairCoin. Power Up Your Shop.
                  </p>
                  <p className="md:text-5xl text-2xl text-center font-bold text-white tracking-wide">
                    Reward your customers. Grow your business.
                  </p>
                  <p className="text-white text-sm md:text-base mb-6 text-center tracking-wide">
                    With RepairCoin, your shop stands out, earns loyalty, and
                    joins a growing network of future-ready service providers.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col md:w-1/2 items-center md:gap-6 gap-4">
                  <p className="text-[#FFCC00] text-center text-base md:text-lg tracking-wide">
                    Start Earning, Start Saving
                  </p>
                  <p className="md:text-5xl text-2xl text-center font-bold text-white tracking-wide">
                    Begin Your Journey Every Repair Earns You More
                  </p>
                  <p className="text-white text-sm md:text-base mb-6 text-center tracking-wide">
                    Every time you repair a device, you earn RepairCoin and
                    unlock collectible coins that mark your loyalty tier. These
                    coins symbolize your status and unlock real-world perks at
                    partner shops.
                  </p>
                </div>
              )}

              <div className="w-full flex items-center justify-center gap-10">
                <button
                  onClick={() => setActiveTab("shop")}
                  className={`border-2 font-semibold text-sm md:text-lg px-12 py-2 rounded-3xl transition-colors ${
                    activeTab === "shop"
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-[#979797] text-gray-300 border-[#979797]"
                  }`}
                >
                  Shops
                </button>
                <button
                  onClick={() => setActiveTab("customer")}
                  className={`border-2 font-semibold text-sm md:text-lg px-8 py-2 rounded-3xl transition-colors ${
                    activeTab === "customer"
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-[#979797] text-gray-300 border-[#979797]"
                  }`}
                >
                  Customers
                </button>
              </div>

              {/* Rewards Cards */}
              {activeTab === "shop" ? (
                <TierCard tierData={tierShopData} />
              ) : (
                <TierCard tierData={tierCustomerData} />
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default RewardYourCustomer;
