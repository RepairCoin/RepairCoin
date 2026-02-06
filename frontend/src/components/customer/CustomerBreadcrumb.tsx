"use client";

import React from "react";
import {
  Home,
  ChevronRight,
  LayoutGrid,
  ShoppingBag,
  Receipt,
  Calendar,
  UserPlus,
  Gift,
  MapPin,
  CheckCircle,
  Settings,
  MessageSquare,
  HelpCircle,
} from "lucide-react";

interface TabMeta {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const TAB_META: Record<string, TabMeta> = {
  overview: {
    title: "Overview",
    description: "Your dashboard overview at a glance.",
    icon: <LayoutGrid className="w-5 h-5 text-[#FFCC00]" />,
  },
  marketplace: {
    title: "Marketplace",
    description: "Discover and book services from local businesses.",
    icon: <ShoppingBag className="w-5 h-5 text-[#FFCC00]" />,
  },
  orders: {
    title: "My Bookings",
    description:
      "View your booked services, payment status, and real-time progress updates from shops.",
    icon: <Receipt className="w-5 h-5 text-[#FFCC00]" />,
  },
  appointments: {
    title: "My Appointments",
    description:
      "View all upcoming appointments you booked with RepairCoin partner shops.",
    icon: <Calendar className="w-5 h-5 text-[#FFCC00]" />,
  },
  messages: {
    title: "Messages",
    description: "Your conversations and support messages.",
    icon: <MessageSquare className="w-5 h-5 text-[#FFCC00]" />,
  },
  referrals: {
    title: "Referrals",
    description: "Invite friends and earn RCN rewards.",
    icon: <UserPlus className="w-5 h-5 text-[#FFCC00]" />,
  },
  gifting: {
    title: "Gift Tokens",
    description:
      "Send RCN tokens to family and friends. They can redeem them at any participating shop.",
    icon: <Gift className="w-5 h-5 text-[#FFCC00]" />,
  },
  findshop: {
    title: "Find Shop",
    description:
      "Find trusted partner shops, book services, and earn RepairCoin every time you visit.",
    icon: <MapPin className="w-5 h-5 text-[#FFCC00]" />,
  },
  approvals: {
    title: "Approvals",
    description:
      "Approve or reject redemption requests from partner shops and manage how your RCN tokens are used.",
    icon: <CheckCircle className="w-5 h-5 text-[#FFCC00]" />,
  },
  settings: {
    title: "Settings",
    description: "Manage your account settings and preferences.",
    icon: <Settings className="w-5 h-5 text-[#FFCC00]" />,
  },
  faq: {
    title: "FAQ & Help",
    description: "Frequently asked questions and help.",
    icon: <HelpCircle className="w-5 h-5 text-[#FFCC00]" />,
  },
};

interface CustomerBreadcrumbProps {
  activeTab: string;
  description?: string;
}

export function CustomerBreadcrumb({
  activeTab,
  description,
}: CustomerBreadcrumbProps) {
  const meta = TAB_META[activeTab];

  if (!meta) return null;

  return (
    <div className="mb-6">
      {/* Breadcrumb Row */}
      <div className="flex items-center gap-2 text-sm">
        <Home className="w-5 h-5 text-gray-400" />
        <ChevronRight className="w-4 h-4 text-gray-600" />
        <div className="flex items-center gap-2">
          {meta.icon}
          <span className="text-white font-medium">{meta.title}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-500 text-sm mt-1">
        {description || meta.description}
      </p>
    </div>
  );
}
