"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { performSwitchAccount } from "@/utils/switchAccount";
import { rememberAccount, type SavedAccount } from "@/utils/savedAccounts";
import { SavedAccountsMenuSection } from "@/components/account/SavedAccountsMenuSection";
import { SHOP_TAB_PERMISSIONS } from "@/config/shopTabPermissions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  LogOut,
  RefreshCw,
  ChevronDown,
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
  const memberName = useAuthStore((s) => s.userProfile?.memberName);
  const profileFirstName = useAuthStore((s) => s.userProfile?.firstName);
  const avatarUrl = useAuthStore((s) => s.userProfile?.avatarUrl);
  const walletAddress = useAuthStore((s) => s.userProfile?.address);
  const profileEmail = useAuthStore((s) => s.userProfile?.email);
  const resetAuth = useAuthStore((s) => s.resetAuth);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  // Staff management lives in this menu now; hide it from members who can't manage the team.
  const canManageTeam = hasPermission(SHOP_TAB_PERMISSIONS.team);
  // Header badge shows the SUBSCRIPTION plan (Starter/Growth/Business) — the tier
  // that governs feature access — not the RCG governance-token tier (which is a
  // blockchain concept and is hidden in DB-only mode).
  const { tier: planTier } = useFeatureAccess();
  const [avatarError, setAvatarError] = useState(false);

  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const handleSwitchAccount = useCallback(
    (targetAccount?: SavedAccount) =>
      performSwitchAccount({ wallet, disconnect, resetAuth, targetAccount }),
    [resetAuth, wallet, disconnect]
  );


  const tabConfig = TAB_CONFIG[activeTab] || DEFAULT_TAB;
  const isHome = activeTab === "overview";
  // Greet the person, not the shop: team members carry their own name (memberName),
  // owners carry firstName/lastName. Fall back to the shop name, then "there".
  const personName = memberName || profileFirstName || name;
  const firstName = (personName || "there").split(" ")[0];
  const tier = planTier ? capitalize(planTier) : null;
  const showAvatar = avatarUrl && !avatarError;

  // Remember this account so it appears in the "Switch to" list next time.
  useEffect(() => {
    if (!walletAddress) return;
    rememberAccount({
      address: walletAddress,
      name: personName || undefined,
      email: profileEmail || undefined,
      avatarUrl: avatarUrl || undefined,
      role: "shop",
    });
  }, [walletAddress, personName, profileEmail, avatarUrl]);

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="ml-6 flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-[#303236] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCC00]/50 data-[state=open]:bg-[#303236]"
            >
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
              <div className="leading-tight text-left">
                <p className="text-sm font-medium text-white">Hi, {firstName}</p>
                {tier && <p className="text-xs text-[#FFCC00]">{tier} Plan</p>}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 border border-gray-800 bg-[#1A1A1A] text-white"
          >
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-white">Hi, {firstName}</p>
              {tier && <p className="text-xs text-[#FFCC00]">{tier} Plan</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-800" />

            {canManageTeam && (
              <DropdownMenuItem
                onSelect={() => onTabChange("team")}
                className="cursor-pointer focus:bg-[#262626] focus:text-white"
              >
                <UsersIcon className="h-4 w-4" />
                Team
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => onTabChange("settings")}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => router.push("/register/shop/payouts")}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <Wallet className="h-4 w-4" />
              Payouts (Stripe)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onTabChange("support")}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <LifeBuoy className="h-4 w-4" />
              Support
            </DropdownMenuItem>

            <SavedAccountsMenuSection
              currentAddress={walletAddress}
              onSelect={(account) => handleSwitchAccount(account)}
            />

            <DropdownMenuSeparator className="bg-gray-800" />

            <DropdownMenuItem
              onSelect={() => handleSwitchAccount()}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Add another account
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleSwitchAccount()}
              className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default ShopBreadcrumb;
