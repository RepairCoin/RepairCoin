"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";

import {
  LayoutGrid,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Gift,
  Search,
  HelpCircle,
  Phone,
  Mail,
  MessageCircle,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import {
  IssueRewardsIcon,
  RedeemIcon,
  OverviewIcon,
  CustomerIcon,
  BuyRcnIcon,
  SettingsIcon,
  LogoutIcon,
  LookupIcon,
} from "../icon";
import { useAuthStore } from "@/stores/authStore";
import { logout } from "@/services/api/auth";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  tabId?: string;
  subItems?: SidebarItem[];
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
  id: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  activeSubTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  isSuperAdmin?: boolean;
  adminRole?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onToggle,
  userRole = "customer",
  activeTab,
  activeSubTab,
  onTabChange,
  onCollapseChange,
  isSuperAdmin = false,
  adminRole = "",
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { resetAuth } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "dashboard", "service",
    "rewards",
    "customers",
    "shop-tools",
    "settings",
  ]);

  // Auto-collapse subtabs when switching to a different main tab
  React.useEffect(() => {
    // If activeTab changes and it's not "customers", collapse the customers subtab
    if (activeTab && activeTab !== "customers") {
      setExpandedItems((prev) => prev.filter((id) => id !== "customers"));
    }
    // If activeTab changes and it's not "shops-management", collapse the shops subtab
    if (activeTab && activeTab !== "shops-management") {
      setExpandedItems((prev) =>
        prev.filter((id) => id !== "shops-management")
      );
    }
    // If activeTab changes and it's not "services" or "bookings", collapse the service subtab
    if (activeTab && activeTab !== "services" && activeTab !== "bookings") {
      setExpandedItems(prev => prev.filter(id => id !== "service"));
    }
    // Auto-expand customers when it becomes active
    if (activeTab === "customers" && !expandedItems.includes("customers")) {
      setExpandedItems((prev) => [...prev, "customers"]);
    }
    // Auto-expand shops when it becomes active
    if (
      activeTab === "shops-management" &&
      !expandedItems.includes("shops-management")
    ) {
      setExpandedItems((prev) => [...prev, "shops-management"]);
    }
    // Auto-expand service when services or bookings becomes active
    if ((activeTab === "services" || activeTab === "bookings") && !expandedItems.includes("service")) {
      setExpandedItems(prev => [...prev, "service"]);
    }
  }, [activeTab]);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const handleLogout = async () => {
    // Clear auth store state
    resetAuth();

    // Disconnect wallet
    if (wallet && disconnect) {
      disconnect(wallet);
      localStorage.clear();
    }

    // Call backend to clear httpOnly cookie and redirect
    await logout();
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
          href: "/customer?tab=overview",
          icon: <LayoutGrid className="w-5 h-5" />,
          tabId: "overview",
        },
        {
          title: "Marketplace",
          href: "/customer?tab=marketplace",
          icon: <ShoppingBag className="w-5 h-5" />,
          tabId: "marketplace",
        },
        {
          title: "My Bookings",
          href: "/customer?tab=orders",
          icon: <Receipt className="w-5 h-5" />,
          tabId: "orders",
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
        {
          title: "Find Shop",
          href: "/customer?tab=findshop",
          icon: <MapPin className="w-5 h-5" />,
          tabId: "findshop",
        },
        {
          title: "Gift Tokens",
          href: "/customer?tab=gifting",
          icon: <Gift className="w-5 h-5" />,
          tabId: "gifting",
        },
      ];
    }

    if (userRole === "shop") {
      return [
        {
          title: "Overview",
          href: "/shop?tab=overview",
          icon: (
            <OverviewIcon
              width={24}
              height={24}
              isActive={activeTab === "overview"}
            />
          ),
          tabId: "overview",
        },
        {
          title: "Service",
          href: "/shop?tab=services",
          icon: <ShoppingBag className="w-5 h-5" />,
          tabId: "service",
          subItems: [
            {
              title: "Services",
              href: "/shop?tab=services",
              icon: <ShoppingBag className="w-4 h-4" />,
              tabId: "services",
            },
            {
              title: "Bookings",
              href: "/shop?tab=bookings",
              icon: <Receipt className="w-4 h-4" />,
              tabId: "bookings",
            },
          ],
        },
        {
          title: "Issue Rewards",
          href: "/shop?tab=issue-rewards",
          icon: (
            <IssueRewardsIcon
              width={24}
              height={24}
              isActive={activeTab === "issue-rewards"}
            />
          ),
          tabId: "issue-rewards",
        },
        {
          title: "Redeem",
          href: "/shop?tab=redeem",
          icon: (
            <RedeemIcon
              width={24}
              height={24}
              isActive={activeTab === "redeem"}
            />
          ),
          tabId: "redeem",
        },
        {
          title: "Promo Codes",
          href: "/shop?tab=promo-codes",
          icon: <span className="text-xl">🏷️</span>,
          tabId: "promo-codes",
        },
        {
          title: "Customers",
          href: "/shop?tab=customers",
          icon: (
            <CustomerIcon
              width={24}
              height={24}
              isActive={activeTab === "customers"}
            />
          ),
          tabId: "customers",
        },
        {
          title: "Lookup",
          href: "/shop?tab=lookup",
          icon: (
            <LookupIcon
              width={24}
              height={24}
              isActive={activeTab === "lookup"}
            />
          ),
          tabId: "lookup",
        },
        {
          title: "Marketing",
          href: "/shop?tab=marketing",
          icon: <span className="text-xl">📢</span>,
          tabId: "marketing",
        },
        {
          title: "Affiliate Groups",
          href: "/shop/groups",
          icon: <Users className="w-5 h-5" />,
          tabId: "groups",
        },
        {
          title: "Shop Location",
          href: "/shop?tab=shop-location",
          icon: <MapPin className="w-5 h-5" />,
          tabId: "shop-location",
        },
        {
          title: "Buy Credits",
          href: "/shop?tab=purchase",
          icon: (
            <BuyRcnIcon
              width={24}
              height={24}
              isActive={activeTab === "purchase"}
            />
          ),
          tabId: "purchase",
        },
      ];
    }

    if (userRole === "admin") {
      const adminItems = [];

      // Role-based access control
      // Super Admin: All tabs
      // Admin: All tabs except Admins management
      // Moderator: Read-only (Overview only)

      // Overview is always visible for any admin
      adminItems.push({
        title: "Overview",
        href: "/admin?tab=overview",
        icon: <span className="text-xl">📊</span>,
        tabId: "overview",
      });

      // Check role for tab visibility
      const isSuper = isSuperAdmin === true || adminRole === "super_admin";

      // Only Super Admin can manage other admins
      if (isSuper) {
        adminItems.push({
          title: "Admins",
          href: "/admin?tab=admins",
          icon: <span className="text-xl">🛡️</span>,
          tabId: "admins",
        });
      }

      // These tabs are always visible for all admin roles
      adminItems.push(
        {
          title: "Customers",
          href: "/admin?tab=customers",
          icon: <span className="text-xl">👥</span>,
          tabId: "customers",
          subItems: [
            {
              title: "Grouped by Shop",
              href: "/admin?tab=customers&view=grouped",
              icon: <span className="text-sm">🏪</span>,
              tabId: "customers-grouped",
            },
            {
              title: "All Customers",
              href: "/admin?tab=customers&view=all",
              icon: <span className="text-sm">👤</span>,
              tabId: "customers-all",
            },
            {
              title: "Unsuspend Requests",
              href: "/admin?tab=customers&view=unsuspend",
              icon: <span className="text-sm">🔓</span>,
              tabId: "customers-unsuspend",
            },
          ],
        },
        {
          title: "Shops",
          href: "/admin?tab=shops-management",
          icon: <span className="text-xl">🏪</span>,
          tabId: "shops-management",
          subItems: [
            {
              title: "All Shops",
              href: "/admin?tab=shops-management&view=all",
              icon: <span className="text-sm">📋</span>,
              tabId: "shops-all",
            },
            {
              title: "Unsuspend Requests",
              href: "/admin?tab=shops-management&view=unsuspend",
              icon: <span className="text-sm">🔓</span>,
              tabId: "shops-unsuspend",
            },
          ],
        },
        {
          title: "Subscriptions",
          href: "/admin?tab=subscriptions",
          icon: <span className="text-xl">💳</span>,
          tabId: "subscriptions",
        },
        {
          title: "Analytics",
          href: "/admin?tab=analytics",
          icon: <span className="text-xl">📊</span>,
          tabId: "analytics",
        },
        {
          title: "Treasury",
          href: "/admin?tab=treasury",
          icon: <span className="text-xl">💰</span>,
          tabId: "treasury",
        },
        {
          title: "Promo Codes",
          href: "/admin?tab=promo-codes",
          icon: <span className="text-xl">🏷️</span>,
          tabId: "promo-codes",
        },
        {
          title: "Sessions",
          href: "/admin?tab=sessions",
          icon: <span className="text-xl">🔐</span>,
          tabId: "sessions",
        }
      );

      return adminItems;
    }

    return commonItems;
  };

  const menuItems = getMenuItems();

  // Get organized sections for shop sidebar
  const getShopSections = (): SidebarSection[] => {
    if (userRole !== "shop") return [];

    return [
      {
        id: "dashboard",
        title: "DASHBOARD",
        items: [
          {
            title: "Overview",
            href: "/shop?tab=overview",
            icon: (
              <OverviewIcon
                width={24}
                height={24}
                isActive={activeTab === "overview"}
              />
            ),
            tabId: "overview",
          },
        ],
      },
      {
        id: "service",
        title: "SERVICE",
        items: [
          {
            title: "Services",
            href: "/shop?tab=services",
            icon: <ShoppingBag className="w-5 h-5" />,
            tabId: "services",
          },
          {
            title: "Bookings",
            href: "/shop?tab=bookings",
            icon: <Receipt className="w-5 h-5" />,
            tabId: "bookings",
          },
        ],
      },
      {
        id: "rewards",
        title: "REWARDS MANAGEMENT",
        items: [
          {
            title: "Issue Rewards",
            href: "/shop?tab=issue-rewards",
            icon: (
              <IssueRewardsIcon
                width={24}
                height={24}
                isActive={activeTab === "issue-rewards"}
              />
            ),
            tabId: "issue-rewards",
          },
          {
            title: "Redeem",
            href: "/shop?tab=redeem",
            icon: (
              <RedeemIcon
                width={24}
                height={24}
                isActive={activeTab === "redeem"}
              />
            ),
            tabId: "redeem",
          },
          {
            title: "Promo Codes",
            href: "/shop?tab=promo-codes",
            icon: <span className="text-xl">🏷️</span>,
            tabId: "promo-codes",
          },
        ],
      },
      {
        id: "customers",
        title: "CUSTOMERS",
        items: [
          {
            title: "Customers",
            href: "/shop?tab=customers",
            icon: (
              <CustomerIcon
                width={24}
                height={24}
                isActive={activeTab === "customers"}
              />
            ),
            tabId: "customers",
          },
          {
            title: "Lookup",
            href: "/shop?tab=lookup",
            icon: (
              <LookupIcon
                width={24}
                height={24}
                isActive={activeTab === "lookup"}
              />
            ),
            tabId: "lookup",
          },
        ],
      },
      {
        id: "shop-tools",
        title: "SHOP TOOLS",
        items: [
          {
            title: "Marketing",
            href: "/shop?tab=marketing",
            icon: <span className="text-xl">📢</span>,
            tabId: "marketing",
          },
          {
            title: "Affiliate Groups",
            href: "/shop/groups",
            icon: <Users className="w-5 h-5" />,
            tabId: "groups",
          },
          {
            title: "Shop Location",
            href: "/shop?tab=shop-location",
            icon: <MapPin className="w-5 h-5" />,
            tabId: "shop-location",
          },
          {
            title: "Buy Credits",
            href: "/shop?tab=purchase",
            icon: (
              <BuyRcnIcon
                width={24}
                height={24}
                isActive={activeTab === "purchase"}
              />
            ),
            tabId: "purchase",
          },
        ],
      },
    ];
  };

  const shopSections = getShopSections();

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const bottomMenuItems: SidebarItem[] =
    userRole === "shop"
      ? [
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
        ]
      : userRole === "customer"
      ? [
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
          },
        ]
      : [
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
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
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
          <div className="relative p-4 sm:p-6 border-b border-gray-800 flex-shrink-0">
            <button
              onClick={() => {
                const destination = `/${userRole}?tab=overview`;
                router.push(destination);
              }}
              className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity w-full"
              title={`Go to ${userRole} homepage`}
            >
              {!isCollapsed && (
                <img
                  src="/img/nav-logo.png"
                  alt="RepairCoin Logo"
                  className="w-auto"
                />
              )}
              {isCollapsed && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs sm:text-sm">
                    RC
                  </span>
                </div>
              )}
            </button>
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

          {/* Scrollable Content Area - Hidden scrollbar */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Search Box - Only for shop */}
            {!isCollapsed && userRole === "shop" && (
              <div className="px-4 pt-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Main Navigation */}
            <nav className="py-3 sm:py-4">
              {userRole === "shop" && !isCollapsed ? (
                /* Shop Sidebar with Sections */
                <div className="space-y-4 px-2 sm:px-3">
                  {shopSections.map((section) => {
                    const isSectionExpanded = expandedSections.includes(
                      section.id
                    );

                    return (
                      <div key={section.id}>
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex items-center justify-between w-full px-2 py-2 text-[#FFCC00] text-xs font-semibold tracking-wider hover:opacity-80 transition-opacity"
                        >
                          <span>{section.title}</span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isSectionExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Section Items */}
                        {isSectionExpanded && (
                          <ul className="space-y-1 mt-2">
                            {section.items.map((item) => {
                              const isActive = item.tabId
                                ? activeTab === item.tabId
                                : pathname === item.href;

                              const handleClick = (e: React.MouseEvent) => {
                                if (item.tabId && onTabChange) {
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
                                    flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                                    transition-colors duration-200
                                    ${
                                      isActive
                                        ? "bg-[#FFCC00] text-[#101010] font-medium"
                                        : "text-white hover:bg-gray-800 hover:text-white"
                                    }
                                  `}
                                  >
                                    <div className="w-5 h-5 flex items-center justify-center">
                                      {React.isValidElement(item.icon)
                                        ? React.cloneElement(
                                            item.icon as React.ReactElement<any>,
                                            {
                                              className: `w-5 h-5 ${
                                                isActive ? "text-[#101010]" : ""
                                              }`,
                                            }
                                          )
                                        : item.icon}
                                    </div>
                                    <span className="text-sm sm:text-base">
                                      {item.title}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Regular Sidebar for other roles or collapsed state */
                <ul className="space-y-1 px-2 sm:px-3">
                  {menuItems.map((item) => {
                    const hasSubItems =
                      item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedItems.includes(
                      item.tabId || item.href
                    );
                    const hasActiveSubItem =
                      hasSubItems &&
                      item.subItems?.some((sub) => activeTab === sub.tabId);
                    const isDirectlyActive =
                      (userRole === "shop" ||
                        userRole === "customer" ||
                        userRole === "admin") &&
                      item.tabId
                        ? activeTab === item.tabId
                        : pathname === item.href ||
                          (item.href !== `/${userRole}` &&
                            pathname.startsWith(item.href));

                    const handleClick = (e: React.MouseEvent) => {
                      if (item.href === "/logout") {
                        e.preventDefault();
                        handleLogout();
                      } else if (hasSubItems) {
                        e.preventDefault();
                        const itemId = item.tabId || item.href;
                        setExpandedItems((prev) =>
                          prev.includes(itemId)
                            ? prev.filter((id) => id !== itemId)
                            : [...prev, itemId]
                        );
                        // Still navigate to main tab when clicking parent
                        if (
                          (userRole === "shop" ||
                            userRole === "customer" ||
                            userRole === "admin") &&
                          item.tabId &&
                          onTabChange
                        ) {
                          onTabChange(item.tabId);
                        }
                      } else if (
                        (userRole === "shop" ||
                          userRole === "customer" ||
                          userRole === "admin") &&
                        item.tabId &&
                        onTabChange
                      ) {
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
                          flex items-center ${
                            isCollapsed ? "justify-center" : "justify-between"
                          } px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                          transition-colors duration-200
                          ${
                            isDirectlyActive
                              ? "bg-yellow-400 text-gray-900 font-medium"
                              : hasActiveSubItem
                              ? "bg-gray-800 text-yellow-400 font-medium border border-yellow-400 border-opacity-30"
                              : "text-gray-300 hover:bg-gray-800 hover:text-white"
                          }
                        `}
                          title={isCollapsed ? item.title : undefined}
                        >
                          <div
                            className={`flex items-center ${
                              isCollapsed ? "" : "space-x-3"
                            }`}
                          >
                            {React.isValidElement(item.icon)
                              ? React.cloneElement(
                                  item.icon as React.ReactElement<any>,
                                  {
                                    className: `w-4 h-4 sm:w-5 sm:h-5 ${
                                      isDirectlyActive
                                        ? "text-gray-900"
                                        : hasActiveSubItem
                                        ? "text-yellow-400"
                                        : ""
                                    }`,
                                  }
                                )
                              : item.icon}
                            {!isCollapsed && (
                              <span className="text-sm sm:text-base">
                                {item.title}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && hasSubItems && (
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              } ${
                                isDirectlyActive
                                  ? "text-gray-900"
                                  : hasActiveSubItem
                                  ? "text-yellow-400"
                                  : "text-gray-400"
                              }`}
                            />
                          )}
                        </Link>

                        {/* Sub Items */}
                        {!isCollapsed && hasSubItems && isExpanded && (
                          <ul className="mt-1 ml-4 space-y-1">
                            {item.subItems?.map((subItem) => {
                              const subIsActive =
                                (userRole === "shop" ||
                                  userRole === "customer" ||
                                  userRole === "admin") &&
                                subItem.tabId
                                  ? activeSubTab === subItem.tabId
                                  : pathname === subItem.href;

                              const handleSubClick = (e: React.MouseEvent) => {
                                if (
                                  (userRole === "shop" ||
                                    userRole === "customer" ||
                                    userRole === "admin") &&
                                  subItem.tabId &&
                                  onTabChange
                                ) {
                                  e.preventDefault();
                                  onTabChange(subItem.tabId);
                                }
                              };

                              return (
                                <li key={subItem.href}>
                                  <Link
                                    href={subItem.href}
                                    onClick={handleSubClick}
                                    className={`
                                    flex items-center space-x-2 px-3 py-2 rounded-lg
                                    transition-colors duration-200 text-sm
                                    ${
                                      subIsActive
                                        ? "bg-[#FFCC00] text-gray-900 font-medium"
                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                    }
                                  `}
                                  >
                                    <span
                                      className={
                                        subIsActive ? "text-gray-900" : ""
                                      }
                                    >
                                      {subItem.icon}
                                    </span>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>

            {/* Settings Section */}
            <div className="border-t border-gray-800 p-3 sm:p-4">
              {!isCollapsed && userRole === "shop" && (
                <button
                  onClick={() => toggleSection("settings")}
                  className="flex items-center justify-between w-full px-2 py-2 text-[#FFCC00] text-xs font-semibold tracking-wider hover:opacity-80 transition-opacity mb-2"
                >
                  <span>SETTINGS</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      expandedSections.includes("settings") ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}

              {/* Show items if: not collapsed, OR not shop role, OR section is expanded */}
              {(isCollapsed ||
                userRole !== "shop" ||
                expandedSections.includes("settings")) && (
                <ul className="space-y-1">
                  {bottomMenuItems.map((item) => {
                    const isActive =
                      (userRole === "shop" ||
                        userRole === "customer" ||
                        userRole === "admin") &&
                      item.tabId
                        ? activeTab === item.tabId
                        : pathname === item.href;

                    const handleClick = (e: React.MouseEvent) => {
                      if (item.href === "/logout") {
                        e.preventDefault();
                        handleLogout();
                      } else if (
                        (userRole === "shop" ||
                          userRole === "customer" ||
                          userRole === "admin") &&
                        item.tabId &&
                        onTabChange
                      ) {
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
                            flex items-center ${
                              isCollapsed ? "justify-center" : "space-x-3"
                            } px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                            transition-colors duration-200
                            ${
                              isActive
                                ? "bg-[#FFCC00] text-[#101010] font-medium"
                                : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            }
                          `}
                          title={isCollapsed ? item.title : undefined}
                        >
                          {React.isValidElement(item.icon)
                            ? React.cloneElement(
                                item.icon as React.ReactElement<any>,
                                {
                                  className: `w-4 h-4 sm:w-5 sm:h-5 ${
                                    isActive ? "text-[#101010]" : ""
                                  }`,
                                }
                              )
                            : item.icon}
                          {!isCollapsed && (
                            <span className="text-sm sm:text-base">
                              {item.title}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Help Card - Part of scrollable area at the bottom */}
            {!isCollapsed && userRole === "shop" && (
              <div className="p-4">
                <div className="bg-gradient-to-br from-[#FFCC00] to-[#FFB800] rounded-2xl p-4 relative overflow-hidden min-h-[176px]">
                  {/* Bottom shadow gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-black/80 via-black/60 to-transparent rounded-b-2xl pointer-events-none z-[5]" />

                  {/* Background person image */}
                  {/*  <div className="absolute bottom-0 right-0 w-[140px] h-full pointer-events-none">
                    <img
                      src="/shop/need-help-person.png"
                      alt=""
                      className="w-full h-2/3 object-scale-down object-bottom absolute bottom-0 right-0 opacity-40"
                      onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div> */}

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Help Icon */}
                    <div className="bg-white rounded-xl p-2 w-9 h-9 flex items-center justify-center mb-3">
                      <HelpCircle className="w-5 h-5 text-[#0075FF]" />
                    </div>

                    {/* Text */}
                    <h3 className="text-[#101010] font-bold text-sm mb-1 p-1">
                      Need help?
                    </h3>
                    <p className="text-[#101010] text-xs mb-3 opacity-90">
                      We&apos;re just a message away.
                    </p>

                    {/* Contact Icons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open("tel:+1234567890", "_self")}
                        className="bg-black rounded-full p-2 hover:bg-gray-800 transition-colors"
                        title="Call us"
                      >
                        <Phone className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() =>
                          window.open("mailto:support@repaircoin.com", "_blank")
                        }
                        className="bg-[#EBEFF5] rounded-full p-2 hover:bg-gray-300 transition-colors"
                        title="Email us"
                      >
                        <Mail className="w-4 h-4 text-black" />
                      </button>
                      <button
                        onClick={() =>
                          window.open("https://wa.me/1234567890", "_blank")
                        }
                        className="bg-[#EBEFF5] rounded-full p-2 hover:bg-gray-300 transition-colors"
                        title="Chat with us"
                      >
                        <MessageCircle className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
