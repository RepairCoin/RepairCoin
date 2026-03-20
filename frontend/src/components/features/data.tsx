import React from "react";
import {
  HandCoins,
  Wallet,
  UserPlus,
  Smartphone,
  Medal,
  Store,
  CalendarCog,
  BellRing,
  Star,
  MessageCircle,
  HandHeart,
  CreditCard,
  Megaphone,
  BarChart3,
  Coins,
  DollarSign,
  Shield,
  Building2,
  UserCheck,
} from "lucide-react";

export type TabType = "shop" | "customer";

export interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

export interface TokenCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: { label: string; value: string }[];
  iconBg: string;
}

export interface TechFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const customerFeatures: Feature[] = [
  {
    icon: <HandCoins className="w-6 h-6" />,
    title: "Earn RCN Tokens",
    description:
      "Earn 1 RCN token for every $10 spent on services. Earn rewards you can use on your next visit.",
    details: [
      "Automatic token rewards for all services",
      "Bonus tokens based on your loyalty tier",
      "Social media integration",
      "25 RCN welcome bonus for new customers",
    ],
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
      "Digital receipts and transaction history",
    ],
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
      "Bonuses awarded after first repair",
    ],
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
      "Secure wallet integration",
    ],
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
      "Priority support and exclusive offers",
    ],
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
      "Share services instantly on social platforms",
    ],
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
      "Instant booking confirmation email after payment",
    ],
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
      "Important updates and announcements",
    ],
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
      "Helpful voting on useful reviews",
    ],
  },
];

export const shopFeatures: Feature[] = [
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
      "Monthly calendar view of all appointments",
    ],
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
      "Fully automated notifications",
    ],
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
      "Keep customers engaged and coming back",
    ],
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
      "Customer communication tools",
    ],
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
      "Digital receipts and records",
    ],
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
      "Customer messaging and notifications",
    ],
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
      "View and respond to customer reviews",
    ],
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
      "ROI on token investments",
    ],
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
      "Real-time inventory tracking",
    ],
  },
];

export const tokenCards: TokenCard[] = [
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "RCN Utility Tokens",
    description: "Earn it. Use it. Redeem it with ease.",
    iconBg: "bg-[#ffcc00]",
    details: [
      { label: "Value", value: "1 RCN = $0.10 USD" },
      { label: "Purpose", value: "Customer rewards and redemptions" },
      { label: "Earning", value: "1 RCN per $10 spent on repairs" },
      { label: "Usage", value: "100% value at earning shop, 20% elsewhere" },
      { label: "Tiers", value: "Bonus tokens for Silver (+2) and Gold (+5) customers" },
    ],
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
      { label: "Tiers", value: "Standard/Premium/Elite (10K/50K/200K+ RCG)" },
      { label: "Benefits", value: "Better RCN pricing for shops" },
      { label: "Revenue", value: "10% to stakers, 10% to DAO" },
    ],
  },
];

export const techFeatures: TechFeature[] = [
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Blockchain Powered",
    description:
      "Built on Base Sepolia with Thirdweb SDK v5 for secure, transparent transactions",
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: "Enterprise Ready",
    description:
      "PostgreSQL database with domain-driven architecture for scalability",
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: "User Focused",
    description:
      "Next.js 15 + React 19 frontend with mobile-first design",
  },
];
