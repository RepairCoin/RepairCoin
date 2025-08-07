"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Receipt,
  DollarSign,
  Users,
  Settings,
  CreditCard,
  TrendingUp,
  Gift,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { 
  IssueRewardsIcon, 
  RedeemIcon, 
  OverviewIcon,
  CustomerIcon,
  LookupIcon,
  BuyRcnIcon,
  TransactionIcon,
  BonusesIcon,
  AnalyticsIcon,
  SettingsIcon,
  LogoutIcon
} from "../icon";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  tabId?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onToggle,
  userRole = "customer",
  activeTab,
  onTabChange,
}) => {
  const pathname = usePathname();

  const getMenuItems = (): SidebarItem[] => {
    const commonItems: SidebarItem[] = [
      {
        title: "Overview",
        href: `/${userRole}`,
        icon: <LayoutGrid className="w-5 h-5" />,
      },
    ];

    if (userRole === "customer") {
      return [
        ...commonItems,
        {
          title: "Issue Rewards",
          href: "/customer/rewards",
          icon: <Receipt className="w-5 h-5" />,
        },
        {
          title: "Redeem",
          href: "/customer/redeem",
          icon: <DollarSign className="w-5 h-5" />,
        },
        {
          title: "Customers",
          href: "/customer/list",
          icon: <Users className="w-5 h-5" />,
        },
        {
          title: "Lookup",
          href: "/customer/lookup",
          icon: <CreditCard className="w-5 h-5" />,
        },
        {
          title: "Buy RCN",
          href: "/customer/buy",
          icon: <TrendingUp className="w-5 h-5" />,
        },
        {
          title: "Transactions",
          href: "/customer/transactions",
          icon: <BarChart3 className="w-5 h-5" />,
        },
        {
          title: "Bonuses",
          href: "/customer/bonuses",
          icon: <Gift className="w-5 h-5" />,
        },
        {
          title: "Analytics",
          href: "/customer/analytics",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ];
    }

    if (userRole === "shop") {
      return [
        {
          title: "Overview",
          href: "/shop?tab=overview",
          icon: <OverviewIcon width={24} height={24} />,
          tabId: "overview",
        },
        {
          title: "Issue Rewards",
          href: "/shop?tab=issue-rewards",
          icon: <IssueRewardsIcon width={24} height={24} />,
          tabId: "issue-rewards",
        },
        {
          title: "Redeem",
          href: "/shop?tab=redeem",
          icon: <RedeemIcon width={24} height={24} />,
          tabId: "redeem",
        },
        {
          title: "Customers",
          href: "/shop?tab=customers",
          icon: <CustomerIcon width={24} height={24} />,
          tabId: "customers",
        },
        {
          title: "Lookup",
          href: "/shop?tab=lookup",
          icon: <LookupIcon width={24} height={24} />,
          tabId: "lookup",
        },
        {
          title: "Buy RCN",
          href: "/shop?tab=purchase",
          icon: <BuyRcnIcon width={24} height={24} />,
          tabId: "purchase",
        },
        {
          title: "Transactions",
          href: "/shop?tab=transactions",
          icon: <TransactionIcon width={24} height={24} />,
          tabId: "transactions",
        },
        {
          title: "Bonuses",
          href: "/shop?tab=bonuses",
          icon: <BonusesIcon width={24} height={24} />,
          tabId: "bonuses",
        },
        {
          title: "Analytics",
          href: "/shop?tab=analytics",
          icon: <AnalyticsIcon width={24} height={24} />,
          tabId: "analytics",
        },
      ];
    }

    if (userRole === "admin") {
      return [
        ...commonItems,
        {
          title: "Customers",
          href: "/admin/customers",
          icon: <Users className="w-5 h-5" />,
        },
        {
          title: "Shops",
          href: "/admin/shops",
          icon: <Receipt className="w-5 h-5" />,
        },
        {
          title: "Treasury",
          href: "/admin/treasury",
          icon: <DollarSign className="w-5 h-5" />,
        },
        {
          title: "Transactions",
          href: "/admin/transactions",
          icon: <BarChart3 className="w-5 h-5" />,
        },
        {
          title: "Analytics",
          href: "/admin/analytics",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ];
    }

    return commonItems;
  };

  const menuItems = getMenuItems();

  const bottomMenuItems: SidebarItem[] = userRole === "shop" ? [
    {
      title: "Settings",
      href: "/shop?tab=settings",
      icon: <Settings className="w-5 h-5" />,
      tabId: "settings",
    },
    {
      title: "Logout",
      href: "/logout",
      icon: <LogOut className="w-5 h-5" />,
    },
  ] : [
    {
      title: "Settings",
      href: `/${userRole}/settings`,
      icon: <SettingsIcon width={24} height={24} />,
    },
    {
      title: "Logout",
      href: "/logout",
      icon: <LogoutIcon width={24} height={24} />,
    },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-[#101010] text-white z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          w-64 border-r border-gray-800
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-gray-800">
            <Link href="/" className="flex items-center space-x-2">
              <img
                src="/img/nav-logo.png"
                alt="RepairCoin Logo"
                className="w-auto"
              />
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {menuItems.map((item) => {
                const isActive = userRole === "shop" && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href ||
                    (item.href !== `/${userRole}` &&
                      pathname.startsWith(item.href));

                const handleClick = (e: React.MouseEvent) => {
                  if (userRole === "shop" && item.tabId && onTabChange) {
                    e.preventDefault();
                    onTabChange(item.tabId);
                  }
                };

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleClick}
                      className={`
                        flex items-center space-x-3 px-4 py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                    >
                      {React.cloneElement(item.icon as React.ReactElement, {
                        className: `w-5 h-5 ${isActive ? "text-gray-900" : ""}`,
                      })}
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom Navigation */}
          <div className="border-t border-gray-800 p-4">
            <ul className="space-y-1">
              {bottomMenuItems.map((item) => {
                const isActive = userRole === "shop" && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href;

                const handleClick = (e: React.MouseEvent) => {
                  if (userRole === "shop" && item.tabId && onTabChange) {
                    e.preventDefault();
                    onTabChange(item.tabId);
                  }
                };

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleClick}
                      className={`
                        flex items-center space-x-3 px-4 py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                    >
                      {React.cloneElement(item.icon as React.ReactElement, {
                        className: `w-5 h-5 ${isActive ? "text-gray-900" : ""}`,
                      })}
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
