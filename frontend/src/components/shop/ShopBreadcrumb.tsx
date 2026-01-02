"use client";

import React from "react";
import {
  Home,
  ChevronRight,
  Settings,
  BarChart3,
  HouseIcon,
  HeartHandshakeIcon,
  ClipboardCheckIcon,
  GemIcon,
  ShoppingBagIcon,
  TagIcon,
  UsersIcon,
  MegaphoneIcon,
  GlobeIcon,
  MapPinnedIcon,
  Calendar,
  Search,
  ShoppingCart,
  TrendingUp,
  MessageCircle,
} from "lucide-react";

// Tab configuration with icons, titles, and descriptions
const TAB_CONFIG: Record<string, {
  title: string;
  icon: React.ReactNode;
  description: string;
}> = {
  overview: {
    title: "Overview",
    icon: <HouseIcon className="w-5 h-5" />,
    description: "View your shop's performance and key metrics at a glance",
  },
  services: {
    title: "Services",
    icon: <HeartHandshakeIcon className="w-5 h-5" />,
    description: "Manage your service offerings and pricing",
  },
  messages: {
    title: "Messages",
    icon: <MessageCircle className="w-5 h-5" />,
    description: "Communicate with customers about bookings and services",
  },
  bookings: {
    title: "Bookings",
    icon: <ClipboardCheckIcon className="w-5 h-5" />,
    description: "View and manage customer service bookings",
  },
  "service-analytics": {
    title: "Service Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Analyze your service performance and trends",
  },
  appointments: {
    title: "Appointments",
    icon: <Calendar className="w-5 h-5" />,
    description: "Manage your appointment schedule and availability",
  },
  purchase: {
    title: "Buy Credits",
    icon: <ShoppingCart className="w-5 h-5" />,
    description: "Purchase RCN credits to issue rewards to your customers",
  },
  bonuses: {
    title: "Tier Bonuses",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "View tier bonus statistics and history",
  },
  analytics: {
    title: "Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Detailed analytics and reporting for your shop",
  },
  redeem: {
    title: "Redeem",
    icon: <ShoppingBagIcon className="w-5 h-5" />,
    description: "Process customer RCN redemptions",
  },
  "issue-rewards": {
    title: "Issue Rewards",
    icon: <GemIcon className="w-5 h-5" />,
    description: "Issue RCN rewards to your customers",
  },
  customers: {
    title: "Customers",
    icon: <UsersIcon className="w-5 h-5" />,
    description: "Your complete overview of customers, their tiers, and lifetime RCN performance.",
  },
  lookup: {
    title: "Lookup",
    icon: <Search className="w-5 h-5" />,
    description: "Look up customers to view their RCN balance, history, and activity.",
  },
  "promo-codes": {
    title: "Promo Codes",
    icon: <TagIcon className="w-5 h-5" />,
    description: "Create and manage promotional codes",
  },
  "shop-location": {
    title: "Shop Location",
    icon: <MapPinnedIcon className="w-5 h-5" />,
    description: "Set your shop's location for accurate delivery and customer navigation",
  },
  subscription: {
    title: "Subscription",
    icon: <Settings className="w-5 h-5" />,
    description: "Manage your shop subscription plan",
  },
  marketing: {
    title: "Marketing",
    icon: <MegaphoneIcon className="w-5 h-5" />,
    description: "Promote your shop and reach more customers",
  },
  settings: {
    title: "Settings",
    icon: <Settings className="w-5 h-5" />,
    description: "Configure your shop settings and preferences",
  },
  groups: {
    title: "Affiliate Groups",
    icon: <GlobeIcon className="w-5 h-5" />,
    description: "Manage affiliate group memberships and collaborations",
  },
};

interface ShopBreadcrumbProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ShopBreadcrumb: React.FC<ShopBreadcrumbProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabConfig = TAB_CONFIG[activeTab];

  // Don't show breadcrumb for overview tab
  if (activeTab === "overview" || !tabConfig) {
    return null;
  }

  const handleHomeClick = () => {
    onTabChange("overview");
  };

  return (
    <div className="border-b border-[#303236] pb-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleHomeClick}
          className="p-1 rounded hover:bg-[#303236] transition-colors"
          title="Go to Overview"
        >
          <Home className="w-5 h-5 text-white hover:text-[#FFCC00] transition-colors" />
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="text-[#FFCC00]">{tabConfig.icon}</span>
        <span className="text-base font-medium text-[#FFCC00]">{tabConfig.title}</span>
      </div>
      <p className="text-sm text-[#ddd]">{tabConfig.description}</p>
    </div>
  );
};

export default ShopBreadcrumb;
