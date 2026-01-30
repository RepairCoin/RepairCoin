"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  LogOut,
  MapPin,
  Gift,
  ShoppingBag,
  Receipt,
  UserPlus,
  CheckCircle,
  Calendar,
  Search,
  ChevronDown,
  Settings,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { BaseSidebar, SectionHeader, SectionMenuItem } from "./BaseSidebar";
import { useSidebar, SidebarItem, SidebarSection } from "./useSidebar";

interface CustomerSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({
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
    userRole: "customer",
    activeTab,
    onTabChange,
    onCollapseChange,
    defaultExpandedSections: ["dashboard", "services", "rewards", "discovery", "account", "settings"],
  });

  // Customer sections definition - organized to match Figma design
  const customerSections: SidebarSection[] = [
    {
      id: "dashboard",
      title: "DASHBOARD",
      items: [
        {
          title: "Overview",
          href: "/customer?tab=overview",
          icon: <LayoutGrid className="w-5 h-5" />,
          tabId: "overview",
        },
      ],
    },
    {
      id: "services",
      title: "SERVICES & BOOKINGS",
      items: [
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
          title: "Appointments",
          href: "/customer?tab=appointments",
          icon: <Calendar className="w-5 h-5" />,
          tabId: "appointments",
        },
      ],
    },
    {
      id: "rewards",
      title: "REWARDS & REFERRALS",
      items: [
        {
          title: "Referrals",
          href: "/customer?tab=referrals",
          icon: <UserPlus className="w-5 h-5" />,
          tabId: "referrals",
        },
        {
          title: "Gift Tokens",
          href: "/customer?tab=gifting",
          icon: <Gift className="w-5 h-5" />,
          tabId: "gifting",
        },
      ],
    },
    {
      id: "discovery",
      title: "DISCOVERY",
      items: [
        {
          title: "Find Shop",
          href: "/customer?tab=findshop",
          icon: <MapPin className="w-5 h-5" />,
          tabId: "findshop",
        },
      ],
    },
    {
      id: "account",
      title: "ACCOUNT",
      items: [
        {
          title: "Approvals",
          href: "/customer?tab=approvals",
          icon: <CheckCircle className="w-5 h-5" />,
          tabId: "approvals",
        },
      ],
    },
  ];

  const bottomMenuItems: SidebarItem[] = [
    {
      title: "Settings",
      href: "/customer?tab=settings",
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
      userRole="customer"
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
          /* Customer Sidebar with Sections */
          <div className="space-y-4 px-2 sm:px-3">
            {customerSections.map((section) => {
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

                        const handleClick = (e: React.MouseEvent) => {
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
            {customerSections.flatMap((section) =>
              section.items.map((item) => {
                const isActive = isItemActive(item);

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
                            item.icon as React.ReactElement<
                              React.HTMLAttributes<HTMLElement>
                            >,
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
                          item.icon as React.ReactElement<
                            React.HTMLAttributes<HTMLElement>
                          >,
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

export default CustomerSidebar;
