"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutGrid,
  Receipt,
  DollarSign,
  Users,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
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
  onCollapseChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onToggle,
  userRole = "customer",
  activeTab,
  onTabChange,
  onCollapseChange,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const logout = useAuthStore((state) => state.logout);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const handleLogout = async () => {
    // Clear auth store state
    logout();
    
    // Disconnect wallet
    if (wallet && disconnect) {
      await disconnect(wallet);
      localStorage.clear();
    }
    
    // Redirect to home page
    router.push("/");
  };

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
        {
          title: "Overview",
          href: "/customer",
          icon: <LayoutGrid className="w-5 h-5" />,
          tabId: "overview",
        },
        {
          title: "Transactions",
          href: "/customer?tab=transactions",
          icon: <DollarSign className="w-5 h-5" />,
          tabId: "transactions",
        },
        {
          title: "Referrals",
          href: "/customer?tab=referrals",
          icon: <Users className="w-5 h-5" />,
          tabId: "referrals",
        },
        {
          title: "Approvals",
          href: "/customer?tab=approvals",
          icon: <Users className="w-5 h-5" />,
          tabId: "approvals",
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
          title: "Buy Credits",
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
  ] : userRole === "customer" ? [
    {
      title: "Settings",
      href: "/customer?tab=settings",
      icon: <SettingsIcon width={24} height={24} />,
      tabId: "settings",
    },
    {
      title: "Logout",
      href: "/logout",
      icon: <LogoutIcon width={24} height={24} />,
    }
  ] : [
    {
      title: "Settings",
      href: `/${userRole}?tab=settings`,
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
        className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50 p-1.5 sm:p-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800"
      >
        {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
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
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "w-20" : "w-64"} border-r border-gray-800
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand with Collapse Button */}
          <div className="relative p-4 sm:p-6 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              {!isCollapsed && (
                <img
                  src="/img/nav-logo.png"
                  alt="RepairCoin Logo"
                  className="w-auto"
                />
              )}
              {isCollapsed && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs sm:text-sm">RC</span>
                </div>
              )}
            </div>
            {/* Collapse Toggle Button - Only visible on desktop */}
            <button
              onClick={handleCollapseToggle}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-gray-900 hover:bg-gray-800 text-yellow-400 rounded-full p-1 sm:p-1.5 shadow-lg border border-gray-700 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 sm:py-4">
            <ul className="space-y-1 px-2 sm:px-3">
              {menuItems.map((item) => {
                const isActive = (userRole === "shop" || userRole === "customer") && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href ||
                    (item.href !== `/${userRole}` &&
                      pathname.startsWith(item.href));

                const handleClick = (e: React.MouseEvent) => {
                  if (item.href === "/logout") {
                    e.preventDefault();
                    handleLogout();
                  } else if ((userRole === "shop" || userRole === "customer") && item.tabId && onTabChange) {
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
                        flex items-center ${isCollapsed ? "justify-center" : "space-x-3"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                      title={isCollapsed ? item.title : undefined}
                    >
                      {React.isValidElement(item.icon) 
                        ? React.cloneElement(item.icon as React.ReactElement<any>, {
                            className: `w-4 h-4 sm:w-5 sm:h-5 ${isActive ? "text-gray-900" : ""}`
                          })
                        : item.icon
                      }
                      {!isCollapsed && <span className="text-sm sm:text-base">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom Navigation */}
          <div className="border-t border-gray-800 p-3 sm:p-4">
            <ul className="space-y-1">
              {bottomMenuItems.map((item) => {
                const isActive = (userRole === "shop" || userRole === "customer") && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href;

                const handleClick = (e: React.MouseEvent) => {
                  if (item.href === "/logout") {
                    e.preventDefault();
                    handleLogout();
                  } else if ((userRole === "shop" || userRole === "customer") && item.tabId && onTabChange) {
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
                        flex items-center ${isCollapsed ? "justify-center" : "space-x-3"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                      title={isCollapsed ? item.title : undefined}
                    >
                      {React.isValidElement(item.icon) 
                        ? React.cloneElement(item.icon as React.ReactElement<any>, {
                            className: `w-4 h-4 sm:w-5 sm:h-5 ${isActive ? "text-gray-900" : ""}`
                          })
                        : item.icon
                      }
                      {!isCollapsed && <span className="text-sm sm:text-base">{item.title}</span>}
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
