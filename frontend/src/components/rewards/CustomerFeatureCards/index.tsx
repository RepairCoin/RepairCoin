"use client";

import {
  Coins,
  Tag,
  Users,
  Smartphone,
  Medal,
  ShoppingBag,
  Calendar,
  Bell,
  Star,
  CheckCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
}

const featureCards: FeatureCard[] = [
  {
    icon: Coins,
    title: "Earn RCN Tokens",
    description:
      "Earn 1 RCN token for every $10 spent on services. You can save on your next visit.",
    points: [
      "Automatic token rewards for all services",
      "Bonus tokens based on your loyalty tier",
      "Social media integration",
      "25 RCN welcome bonus for new customers",
    ],
  },
  {
    icon: Tag,
    title: "Redeem for Savings",
    description: "Grow your savings using built-in marketing and engagement tools.",
    points: [
      "100% value at shops where you earned tokens",
      "20% value at any participating shop",
      "Partial redemptions allowed",
      "Digital receipts and transaction history",
    ],
  },
  {
    icon: Users,
    title: "Referral Rewards",
    description:
      "Use tokens to save on future services and earn more when you refer a friend.",
    points: [
      "Unlimited referrals with unique codes",
      "Friends get 10 RCN welcome bonus",
      "Track referral status in dashboard",
      "Bonuses awarded after first repair",
    ],
  },
  {
    icon: Smartphone,
    title: "Mobile Experience",
    description:
      "Seamless mobile app experience with built-in QR codes for fast and secure transactions.",
    points: [
      "QR code for instant shop identification",
      "Real-time balance and notifications",
      "Shop finder with ratings and reviews",
      "Secure wallet integration",
    ],
  },
  {
    icon: Medal,
    title: "Loyalty Tiers",
    description: "Advance through loyalty tiers to unlock bigger and better bonus rewards.",
    points: [
      "Bronze: Standard earning rate",
      "Silver: +2 bonus tokens per transaction",
      "Gold: +5 bonus tokens per transaction",
      "Priority support and exclusive offers",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Service Marketplace",
    description: "Browse services from verified shops you can trust.",
    points: [
      "Browse services with filters and search",
      "See RCN earning potential on each service",
      "Favorite services for quick access",
      "View customer reviews and ratings",
      "Share services instantly on social platforms",
    ],
  },
  {
    icon: Calendar,
    title: "Appointment Scheduling",
    description:
      "Book services with easy date and time selection options for flexible scheduling and convenience.",
    points: [
      "Select preferred date and time slot",
      "Real-time availability based on shop hours",
      "24-hour reminder email before appointment",
      "View all your appointments in one place",
      "Instant booking confirmation email after payment",
    ],
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Stay informed with automated alerts and real-time service updates.",
    points: [
      "Email confirmations when you book services",
      "24-hour appointment reminder emails",
      "In-app alerts for bookings and rewards",
      "Transaction receipts and history",
      "Important updates and announcements",
    ],
  },
  {
    icon: Star,
    title: "Reviews & Ratings",
    description:
      "Share your experience with reviews and ratings to help others choose with confidence.",
    points: [
      "Rate completed services 1-5 stars",
      "Write detailed reviews with photos",
      "Filter reviews by rating",
      "See shop responses to reviews",
      "Helpful voting on useful reviews",
    ],
  },
];

const CustomerFeatureCards = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12 min-h-screen h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="border border-[#2a2a2a] rounded-3xl p-8"
              style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#FFCC00] flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-black" />
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-[#777] mb-5 leading-relaxed">{card.description}</p>

              {/* Points */}
              <ul className="space-y-2.5">
                {card.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#aaa] leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CustomerFeatureCards;
