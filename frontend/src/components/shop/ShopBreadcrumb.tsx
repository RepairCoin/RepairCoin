"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRCGBalance } from "@/hooks/useRCGBalance";
import { CartIcon } from "@/components/ui/CartIcon";
import { MessageIcon } from "@/components/messaging/MessageIcon";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HeaderVoiceMic } from "@/components/voice/HeaderVoiceMic";
import { UnifiedAssistantLauncher } from "@/components/shop/unified/UnifiedAssistantLauncher";
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
  AlertTriangle,
  User,
  CreditCard,
  Package,
  Wrench,
  FileBarChart,
  LifeBuoy,
  Wallet,
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
  inventory: {
    title: "Inventory",
    icon: <ShoppingBagIcon className="w-5 h-5" />,
    description: "Manage your inventory items and stock levels",
  },
  "purchase-orders": {
    title: "Purchase Orders",
    icon: <Package className="w-5 h-5" />,
    description: "Manage your inventory purchase orders",
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
  disputes: {
    title: "No-Show Disputes",
    icon: <AlertTriangle className="w-5 h-5" />,
    description: "Review and respond to customer no-show dispute requests",
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
  tools: {
    title: "Tools",
    icon: <Wrench className="w-5 h-5" />,
    description: "Manage rewards, redemptions, and promotional codes",
  },
  customers: {
    title: "Customers",
    icon: <UsersIcon className="w-5 h-5" />,
    description: "Your complete overview of customers, their tiers, and lifetime RCN performance.",
  },
  team: {
    title: "Team Management",
    icon: <UsersIcon className="w-5 h-5" />,
    description: "Invite staff and assign roles with granular permissions.",
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
  locations: {
    title: "Locations",
    icon: <MapPinnedIcon className="w-5 h-5" />,
    description: "Manage your business locations and set your primary address",
  },
  staking: {
    title: "Stake RCG",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "Stake your RCG tokens to earn rewards from platform revenue sharing",
  },
  subscription: {
    title: "Subscription",
    icon: <Settings className="w-5 h-5" />,
    description: "Manage your shop subscription plan",
  },
  plans: {
    title: "Plans & Billing",
    icon: <CreditCard className="w-5 h-5" />,
    description: "Your plan, add-ons, and billing in one place",
  },
  "payment-methods": {
    title: "Payment Methods",
    icon: <CreditCard className="w-5 h-5" />,
    description: "Add, remove, and set your default card",
  },
  marketing: {
    title: "Marketing",
    icon: <MegaphoneIcon className="w-5 h-5" />,
    description: "Promote your shop and reach more customers",
  },
  reports: {
    title: "Reports",
    icon: <FileBarChart className="w-5 h-5" />,
    description: "Stay informed with automated email reports about your shop's performance. Choose which reports you want to receive and when.",
  },
  settings: {
    title: "Settings",
    icon: <Settings className="w-5 h-5" />,
    description: "Configure your shop settings and preferences",
  },
  support: {
    title: "Support",
    icon: <LifeBuoy className="w-5 h-5" />,
    description: "Get help from our support team",
  },
  "wallet-payouts": {
    title: "Wallet & Payouts",
    icon: <Wallet className="w-5 h-5" />,
    description: "Manage your wallet and payout settings",
  },
  // groups: {
  //   title: "Affiliate Groups",
  //   icon: <GlobeIcon className="w-5 h-5" />,
  //   description: "Manage affiliate group memberships and collaborations",
  // },
  profile: {
    title: "Shop Profile",
    icon: <User className="w-5 h-5" />,
    description: "Manage your shop profile and how it appears to customers",
  },
};

const DEFAULT_TAB = {
  title: "Dashboard",
  icon: <HouseIcon className="w-5 h-5" />,
  description: "Manage your shop and take action with AI-powered business insights.",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface ShopBreadcrumbProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ShopBreadcrumb: React.FC<ShopBreadcrumbProps> = ({
  activeTab,
  onTabChange,
}) => {
  const name = useAuthStore((s) => s.userProfile?.name);
  const profileFirstName = useAuthStore((s) => s.userProfile?.firstName);
  const avatarUrl = useAuthStore((s) => s.userProfile?.avatarUrl);
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { rcgInfo } = useRCGBalance(shopId);
  const [avatarError, setAvatarError] = useState(false);

  const tabConfig = TAB_CONFIG[activeTab] || DEFAULT_TAB;
  const isHome = activeTab === "overview";
  // Greet the person, not the shop: owners carry firstName/lastName; team members
  // carry their own name. Fall back to the shop name, then "there".
  const personName = profileFirstName || name;
  const firstName = (personName || "there").split(" ")[0];
  const tier =
    rcgInfo?.tier && rcgInfo.tier !== "none" ? capitalize(rcgInfo.tier) : null;
  const showAvatar = avatarUrl && !avatarError;

  const handleHomeClick = () => {
    onTabChange("overview");
  };

  return (
    <div className="px-2 lg:px-0 pb-4 mb-6 flex items-start justify-between gap-4">
      {/* Page title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {!isHome && (
            <>
              <button
                onClick={handleHomeClick}
                className="p-1 rounded hover:bg-[#303236] transition-colors"
                title="Go to Overview"
              >
                <Home className="w-5 h-5 text-white hover:text-[#FFCC00] transition-colors" />
              </button>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </>
          )}
          <span className="text-[#FFCC00]">{tabConfig.icon}</span>
          <span className="text-base font-medium text-[#FFCC00]">{tabConfig.title}</span>
        </div>
        <p className="text-sm text-[#ddd]">{tabConfig.description}</p>
      </div>

      {/* Actions + user — desktop only; mobile uses the floating cluster */}
      <div className="hidden lg:flex flex-shrink-0 items-center gap-2.5">
        <CartIcon variant="subtle" />
        <MessageIcon variant="subtle" />
        <NotificationBell variant="subtle" />
        <HeaderVoiceMic variant="subtle" />
        <UnifiedAssistantLauncher variant="subtle" />

        <div className="ml-6 flex items-center gap-2.5">
          {showAvatar ? (
            <img
              src={avatarUrl}
              alt={firstName}
              onError={() => setAvatarError(true)}
              className="h-9 w-9 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFCC00] text-sm font-bold text-[#101010]">
              {firstName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="leading-tight">
            <p className="text-sm font-medium text-white">Hi, {firstName}</p>
            {tier && <p className="text-xs text-[#FFCC00]">{tier} Tier</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopBreadcrumb;
