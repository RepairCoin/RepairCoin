"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, Shield, Users, Store, User, Unlock, ClipboardList, CreditCard, BarChart3, Coins, Tag, Lock, LifeBuoy, AlertTriangle, Bug, Bot, Megaphone, ShieldAlert, ShieldCheck, ScrollText, DollarSign, Webhook, Gem, Share2 } from "lucide-react";
import { SettingsIcon } from "@/components/icon";
import { BaseSidebar, SidebarMenuItem } from "./BaseSidebar";
import { useSidebar, SidebarItem } from "./useSidebar";

interface AdminSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  activeTab?: string;
  activeSubTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  isSuperAdmin?: boolean;
  adminRole?: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen = false,
  onToggle,
  activeTab,
  activeSubTab,
  onTabChange,
  onCollapseChange,
  isSuperAdmin = false,
  adminRole = "",
}) => {
  const {
    isCollapsed,
    expandedItems,
    handleCollapseToggle,
    handleItemClick,
    handleSubItemClick,
    handleLogout,
    isItemActive,
    hasActiveSubItem,
    isExpanded,
    navigateToHome,
    setExpandedItems,
  } = useSidebar({
    userRole: "admin",
    activeTab,
    onTabChange,
    onCollapseChange,
  });

  // Collapsed-state hover flyout: which group is open + its vertical anchor
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  // Auto-collapse/expand subtabs when switching tabs
  useEffect(() => {
    // Use a single setExpandedItems call to avoid multiple state updates
    setExpandedItems((prev) => {
      let newItems = [...prev];

      // If activeTab is "customers", expand it; otherwise collapse it
      if (activeTab === "customers") {
        if (!newItems.includes("customers")) {
          newItems = [...newItems, "customers"];
        }
      } else if (activeTab) {
        newItems = newItems.filter((id) => id !== "customers");
      }

      // If activeTab is "shops-management", expand it; otherwise collapse it
      if (activeTab === "shops-management") {
        if (!newItems.includes("shops-management")) {
          newItems = [...newItems, "shops-management"];
        }
      } else if (activeTab) {
        newItems = newItems.filter((id) => id !== "shops-management");
      }

      return newItems;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Build menu items based on admin role, grouped into labeled categories.
  const getMenuItems = (): SidebarItem[] => {
    const isSuper = isSuperAdmin === true || adminRole === "super_admin";
    const adsEnabled = process.env.NEXT_PUBLIC_ADS_DASHBOARD_ENABLED === "true";

    // Non-clickable category header row (detected in the render by tabId).
    const section = (title: string): SidebarItem => ({
      title,
      href: `#section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      tabId: "__section",
      icon: null,
    });

    const customers: SidebarItem = {
      title: "Customers",
      href: "/admin?tab=customers",
      icon: <Users className="w-5 h-5" />,
      tabId: "customers",
      subItems: [
        { title: "Grouped by Shop", href: "/admin?tab=customers&view=grouped", icon: <Store className="w-4 h-4" />, tabId: "customers-grouped" },
        { title: "All Customers", href: "/admin?tab=customers&view=all", icon: <User className="w-4 h-4" />, tabId: "customers-all" },
        { title: "Unsuspend Requests", href: "/admin?tab=customers&view=unsuspend", icon: <Unlock className="w-4 h-4" />, tabId: "customers-unsuspend" },
      ],
    };

    const shops: SidebarItem = {
      title: "Shops",
      href: "/admin?tab=shops-management",
      icon: <Store className="w-5 h-5" />,
      tabId: "shops-management",
      subItems: [
        { title: "All Shops", href: "/admin?tab=shops-management&view=all", icon: <ClipboardList className="w-4 h-4" />, tabId: "shops-all" },
        { title: "Unsuspend Requests", href: "/admin?tab=shops-management&view=unsuspend", icon: <Unlock className="w-4 h-4" />, tabId: "shops-unsuspend" },
      ],
    };

    const items: SidebarItem[] = [
      { title: "Overview", href: "/admin?tab=overview", icon: <LayoutDashboard className="w-5 h-5" />, tabId: "overview" },

      section("Users & Shops"),
      customers,
      shops,
      { title: "Subscriptions", href: "/admin?tab=subscriptions", icon: <CreditCard className="w-5 h-5" />, tabId: "subscriptions" },
      { title: "Waitlist", href: "/admin?tab=waitlist", icon: <ClipboardList className="w-5 h-5" />, tabId: "waitlist" },

      section("Finance & Tokens"),
      { title: "Treasury", href: "/admin?tab=treasury", icon: <Coins className="w-5 h-5" />, tabId: "treasury" },
      { title: "Revenue", href: "/admin?tab=revenue", icon: <DollarSign className="w-5 h-5" />, tabId: "revenue" },
      { title: "RCG", href: "/admin?tab=rcg", icon: <Gem className="w-5 h-5" />, tabId: "rcg" },
      { title: "Promo Codes", href: "/admin?tab=promo-codes", icon: <Tag className="w-5 h-5" />, tabId: "promo-codes" },

      section("Growth & Analytics"),
      { title: "Analytics", href: "/admin?tab=analytics", icon: <BarChart3 className="w-5 h-5" />, tabId: "analytics" },
      { title: "Marketplace", href: "/admin?tab=marketplace", icon: <BarChart3 className="w-5 h-5" />, tabId: "marketplace" },
      { title: "Referrals", href: "/admin?tab=referrals", icon: <Share2 className="w-5 h-5" />, tabId: "referrals" },
      ...(adsEnabled ? [{ title: "Ads", href: "/admin?tab=ads", icon: <Megaphone className="w-5 h-5" />, tabId: "ads" }] : []),

      section("AI Tools"),
      { title: "Platform Copilot", href: "/admin?tab=copilot", icon: <Bot className="w-5 h-5" />, tabId: "copilot" },
      { title: "AI Agent", href: "/admin?tab=ai-agent", icon: <Bot className="w-5 h-5" />, tabId: "ai-agent" },
      { title: "Content Moderation", href: "/admin?tab=content-moderation", icon: <ShieldCheck className="w-5 h-5" />, tabId: "content-moderation" },

      section("Trust & Safety"),
      { title: "Trust & Safety", href: "/admin?tab=fraud", icon: <ShieldAlert className="w-5 h-5" />, tabId: "fraud" },
      { title: "Disputes", href: "/admin?tab=disputes", icon: <AlertTriangle className="w-5 h-5" />, tabId: "disputes" },
      { title: "Bug Reports", href: "/admin?tab=bug-reports", icon: <Bug className="w-5 h-5" />, tabId: "bug-reports" },

      section("Communication"),
      { title: "Announcements", href: "/admin?tab=announcements", icon: <Megaphone className="w-5 h-5" />, tabId: "announcements" },
      { title: "Support", href: "/admin?tab=support", icon: <LifeBuoy className="w-5 h-5" />, tabId: "support" },

      section("System"),
      ...(isSuper ? [{ title: "Admins", href: "/admin?tab=admins", icon: <Shield className="w-5 h-5" />, tabId: "admins" }] : []),
      { title: "Sessions", href: "/admin?tab=sessions", icon: <Lock className="w-5 h-5" />, tabId: "sessions" },
      { title: "Audit Log", href: "/admin?tab=audit-log", icon: <ScrollText className="w-5 h-5" />, tabId: "audit-log" },
      { title: "Webhooks", href: "/admin?tab=webhooks", icon: <Webhook className="w-5 h-5" />, tabId: "webhooks" },
    ];

    return items;
  };

  const menuItems = getMenuItems();

  // Settings stays pinned at the very bottom; everything else is categorized above.
  const bottomMenuItems: SidebarItem[] = [
    {
      title: "Settings",
      href: "/admin?tab=settings",
      icon: <SettingsIcon width={24} height={24} />,
      tabId: "settings",
    },
  ];

  // Renders a group as a single icon with a hover flyout of its items (collapsed mode)
  const renderCollapsedGroup = (opts: {
    id: string;
    title: string;
    icon: React.ReactNode;
    items: SidebarItem[];
    iconHref: string;
    groupActive: boolean;
    itemActive: (item: SidebarItem) => boolean;
    onItemClick: (item: SidebarItem, e: React.MouseEvent) => void;
  }) => {
    const { id, title, icon, items, iconHref, groupActive, itemActive, onItemClick } = opts;
    const isOpen = hoveredGroup === id;
    const hasFlyout = items.length > 1;
    const triggerClass = `p-2 rounded-lg transition-colors ${
      groupActive
        ? "bg-[#FFCC00] text-[#101010]"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;
    const iconEl = React.isValidElement(icon)
      ? React.cloneElement(icon as React.ReactElement<any>, {
          className: `w-5 h-5 ${groupActive ? "text-[#101010]" : ""}`,
        })
      : icon;
    return (
      <div
        key={id}
        className="relative flex justify-center"
        onMouseEnter={(e) => {
          setHoveredGroup(id);
          setFlyoutTop(e.currentTarget.getBoundingClientRect().top);
        }}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        {hasFlyout ? (
          <button
            type="button"
            title={title}
            onClick={() => setHoveredGroup(id)}
            className={triggerClass}
          >
            {iconEl}
          </button>
        ) : (
          <Link
            href={iconHref}
            onClick={(e) => onItemClick(items[0], e)}
            title={title}
            className={triggerClass}
          >
            {iconEl}
          </Link>
        )}
        {hasFlyout && isOpen && (
          <div
            style={{ position: "fixed", top: flyoutTop, left: 80 }}
            className="z-[60] min-w-[190px] bg-[#1c1c1c] border border-gray-800 rounded-lg shadow-xl py-2 before:content-[''] before:absolute before:top-0 before:-left-2 before:h-full before:w-2"
          >
            <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-gray-400">
              {title}
            </p>
            {items.map((item) => {
              const active = itemActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    onItemClick(item, e);
                    setHoveredGroup(null);
                  }}
                  className={`block px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-gray-800 text-[#FFCC00]"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseSidebar
      isOpen={isOpen}
      onToggle={onToggle}
      isCollapsed={isCollapsed}
      onCollapseToggle={handleCollapseToggle}
      onNavigateHome={navigateToHome}
      onLogout={handleLogout}
      userRole="admin"
    >
      {/* Main Navigation */}
      <nav className="pt-3 sm:pt-4 pb-0">
        <ul className="space-y-1 px-2 sm:px-3">
          {menuItems.map((item) => {
            // Category header row (non-clickable). Collapsed → thin divider.
            if (item.tabId === "__section") {
              return isCollapsed ? (
                <li key={item.href} className="mx-2 my-2 border-t border-gray-800/70" aria-hidden />
              ) : (
                <li
                  key={item.href}
                  className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 select-none"
                >
                  {item.title}
                </li>
              );
            }

            const hasSubItems = item.subItems && item.subItems.length > 0;
            const itemExpanded = isExpanded(item);
            const hasActiveSub = hasActiveSubItem(item);
            const isDirectlyActive = isItemActive(item);

            const handleClick = (e: React.MouseEvent) => {
              handleItemClick(item, e);
            };

            // Collapsed + has sub-items → hover flyout (other items unchanged)
            if (isCollapsed && hasSubItems) {
              return (
                <li key={item.href}>
                  {renderCollapsedGroup({
                    id: item.tabId || item.href,
                    title: item.title,
                    icon: item.icon,
                    items: item.subItems!,
                    iconHref: item.href,
                    groupActive: isDirectlyActive || hasActiveSub,
                    itemActive: (sub) => activeSubTab === sub.tabId,
                    onItemClick: (sub, e) => handleSubItemClick(sub, e),
                  })}
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleClick}
                  className={`
                    flex items-center ${
                      isCollapsed ? "justify-center" : "justify-between"
                    } px-3 sm:px-4 py-2 rounded-lg
                    transition-colors duration-200
                    ${
                      isDirectlyActive
                        ? "bg-[#FFCC00] text-[#101010] font-medium"
                        : hasActiveSub
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
                                ? "text-[#101010]"
                                : hasActiveSub
                                ? "text-yellow-400"
                                : ""
                            }`,
                          }
                        )
                      : item.icon}
                    {!isCollapsed && (
                      <span className="text-[13px] sm:text-sm">{item.title}</span>
                    )}
                  </div>
                  {!isCollapsed && hasSubItems && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        itemExpanded ? "rotate-180" : ""
                      } ${
                        isDirectlyActive
                          ? "text-[#101010]"
                          : hasActiveSub
                          ? "text-yellow-400"
                          : "text-gray-400"
                      }`}
                    />
                  )}
                </Link>

                {/* Sub Items */}
                {!isCollapsed && hasSubItems && itemExpanded && (
                  <ul className="mt-1 ml-4 space-y-1">
                    {item.subItems?.map((subItem) => {
                      const subIsActive = activeSubTab === subItem.tabId;

                      const handleSubClick = (e: React.MouseEvent) => {
                        handleSubItemClick(subItem, e);
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
                                  ? "bg-[#FFCC00] text-[#101010] font-medium"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              }
                            `}
                          >
                            <span
                              className={subIsActive ? "text-[#101010]" : ""}
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
      </nav>

      {/* Settings Section */}
      <div className="px-2 sm:px-3 pt-2 pb-3">
        <ul className="space-y-1">
          {bottomMenuItems.map((item) => {
            const isActive = item.tabId ? activeTab === item.tabId : false;

            const handleClick = (e: React.MouseEvent) => {
              handleItemClick(item, e);
            };

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleClick}
                  className={`
                    flex items-center ${
                      isCollapsed ? "justify-center" : "space-x-3"
                    } px-3 sm:px-4 py-2 rounded-lg
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
                    ? React.cloneElement(item.icon as React.ReactElement<any>, {
                        className: `w-4 h-4 sm:w-5 sm:h-5 ${
                          isActive ? "text-[#101010]" : ""
                        }`,
                      })
                    : item.icon}
                  {!isCollapsed && (
                    <span className="text-[13px] sm:text-sm">{item.title}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </BaseSidebar>
  );
};

export default AdminSidebar;
