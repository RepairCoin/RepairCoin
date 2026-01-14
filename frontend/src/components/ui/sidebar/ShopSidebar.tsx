"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings,
  LogOut,
  Search,
  BarChart3,
  ChevronDown,
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
  MessageCircle,
  RefreshCw,
  User,
} from "lucide-react";
import {
  IssueRewardsIcon,
  RedeemIcon,
  OverviewIcon,
  CustomerIcon,
  BuyRcnIcon,
  LookupIcon,
} from "@/components/icon";
import { BaseSidebar, SectionHeader, SectionMenuItem } from "./BaseSidebar";
import { useSidebar, SidebarItem, SidebarSection } from "./useSidebar";
import Image from "next/image";

interface ShopSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

const ShopSidebar: React.FC<ShopSidebarProps> = ({
  isOpen = false,
  onToggle,
  activeTab,
  onTabChange,
  onCollapseChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    isCollapsed,
    handleCollapseToggle,
    handleItemClick,
    isItemActive,
    toggleSection,
    isSectionExpanded,
    navigateToHome,
  } = useSidebar({
    userRole: "shop",
    activeTab,
    onTabChange,
    onCollapseChange,
    defaultExpandedSections: ["settings"],
  });

  // Shop sections definition
  const shopSections: SidebarSection[] = [
    {
      id: "dashboard",
      title: "DASHBOARD",
      items: [
        {
          title: "Overview",
          href: "/shop?tab=overview",
          icon: <HouseIcon width={24} height={24} />,
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
          icon: <HeartHandshakeIcon className="w-5 h-5" />,
          tabId: "services",
        },
        {
          title: "Bookings",
          href: "/shop?tab=bookings",
          icon: <ClipboardCheckIcon className="w-5 h-5" />,
          tabId: "bookings",
        },
        {
          title: "Analytics",
          href: "/shop?tab=service-analytics",
          icon: <BarChart3 className="w-5 h-5" />,
          tabId: "service-analytics",
        },
        {
          title: "Appointments",
          href: "/shop?tab=appointments",
          icon: <Calendar className="w-5 h-5" />,
          tabId: "appointments",
        },
        {
          title: "Reschedules",
          href: "/shop?tab=reschedules",
          icon: <RefreshCw className="w-5 h-5" />,
          tabId: "reschedules",
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
          icon: <GemIcon className="w-5 h-5" />,
          tabId: "issue-rewards",
        },
        {
          title: "Redeem",
          href: "/shop?tab=redeem",
          icon: <ShoppingBagIcon className="w-5 h-5" />,
          tabId: "redeem",
        },
        {
          title: "Promo Codes",
          href: "/shop?tab=promo-codes",
          icon: <TagIcon className="w-5 h-5" />,
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
          icon: <UsersIcon className="w-5 h-5" />,
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
      title: "SHOP MANAGEMENT",
      items: [
        {
          title: "Profile",
          href: "/shop?tab=profile",
          icon: <User className="w-5 h-5" />,
          tabId: "profile",
        },
        {
          title: "Marketing",
          href: "/shop?tab=marketing",
          icon: (
            <Image
              src={"/img/megaphone.png"}
              width={32}
              height={32}
              alt={"megaphone icon"}
            />
          ),
          tabId: "marketing",
        },
        {
          title: "Affiliate Groups",
          href: "/shop/groups",
          icon: <GlobeIcon className="w-5 h-5" />,
          tabId: "groups",
        },
        {
          title: "Shop Location",
          href: "/shop?tab=shop-location",
          icon: <MapPinnedIcon className="w-5 h-5" />,
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

  const bottomMenuItems: SidebarItem[] = [
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
  ];

  return (
    <BaseSidebar
      isOpen={isOpen}
      onToggle={onToggle}
      isCollapsed={isCollapsed}
      onCollapseToggle={handleCollapseToggle}
      onNavigateHome={navigateToHome}
      userRole="shop"
    >
      {/* Search Box */}
      {!isCollapsed && (
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
        {!isCollapsed ? (
          /* Shop Sidebar with Sections */
          <div className="space-y-4 px-2 sm:px-3">
            {shopSections.map((section) => {
              const sectionExpanded = isSectionExpanded(section.id);

              return (
                <div key={section.id}>
                  {/* Section Header */}
                  <SectionHeader
                    title={section.title}
                    isExpanded={sectionExpanded}
                    onToggle={() => toggleSection(section.id)}
                  />

                  {/* Section Items */}
                  {sectionExpanded && (
                    <ul className="space-y-1 mt-2">
                      {section.items.map((item) => {
                        const isActive = isItemActive(item);

                        // Check if this is a direct page route (not a tab route)
                        const isDirectPageRoute = !item.href.includes("?tab=");

                        const handleClick = (e: React.MouseEvent) => {
                          // For direct page routes, let the Link navigate normally
                          if (isDirectPageRoute) {
                            return;
                          }
                          // For tab routes, prevent default and use onTabChange
                          if (item.tabId && onTabChange) {
                            e.preventDefault();
                            onTabChange(item.tabId);
                          }
                        };

                        return (
                          <SectionMenuItem
                            key={item.href}
                            item={item}
                            isActive={isActive}
                            onClick={handleClick}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Collapsed state - show icons only */
          <ul className="space-y-1 px-2 sm:px-3">
            {shopSections.flatMap((section) =>
              section.items.map((item) => {
                const isActive = isItemActive(item);

                // Check if this is a direct page route (not a tab route)
                const isDirectPageRoute = !item.href.includes("?tab=");

                const handleClick = (e: React.MouseEvent) => {
                  // For direct page routes, let the Link navigate normally
                  if (isDirectPageRoute) {
                    return;
                  }
                  // For tab routes, prevent default and use onTabChange
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
                        flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                      title={item.title}
                    >
                      {React.isValidElement(item.icon)
                        ? React.cloneElement(
                            item.icon as React.ReactElement<any>,
                            {
                              className: `w-4 h-4 sm:w-5 sm:h-5 ${
                                isActive ? "text-gray-900" : ""
                              }`,
                            }
                          )
                        : item.icon}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </nav>

      {/* Settings Section */}
      <div className="border-t border-gray-800 p-3 sm:p-4">
        {!isCollapsed && (
          <button
            onClick={() => toggleSection("settings")}
            className="flex items-center justify-between w-full px-2 py-2 text-[#FFCC00] text-xs font-semibold tracking-wider hover:opacity-80 transition-opacity mb-2"
          >
            <span>SETTINGS</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isSectionExpanded("settings") ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        {/* Show items if: collapsed, OR section is expanded */}
        {(isCollapsed || isSectionExpanded("settings")) && (
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
                      <span className="text-sm sm:text-base">{item.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BaseSidebar>
  );
};

export default ShopSidebar;
