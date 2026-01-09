"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SettingsIcon, LogoutIcon } from "@/components/icon";
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

  // Build menu items based on admin role
  const getMenuItems = (): SidebarItem[] => {
    const adminItems: SidebarItem[] = [];

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
  };

  const menuItems = getMenuItems();

  const bottomMenuItems: SidebarItem[] = [
    {
      title: "Settings",
      href: "/admin?tab=settings",
      icon: <SettingsIcon width={24} height={24} />,
    },
    {
      title: "Logout",
      href: "/logout",
      icon: <LogoutIcon width={24} height={24} />,
    },
  ];

  return (
    <BaseSidebar
      isOpen={isOpen}
      onToggle={onToggle}
      isCollapsed={isCollapsed}
      onCollapseToggle={handleCollapseToggle}
      onNavigateHome={navigateToHome}
      userRole="admin"
    >
      {/* Main Navigation */}
      <nav className="py-3 sm:py-4">
        <ul className="space-y-1 px-2 sm:px-3">
          {menuItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const itemExpanded = isExpanded(item);
            const hasActiveSub = hasActiveSubItem(item);
            const isDirectlyActive = isItemActive(item);

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
                      isCollapsed ? "justify-center" : "justify-between"
                    } px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                    transition-colors duration-200
                    ${
                      isDirectlyActive
                        ? "bg-yellow-400 text-gray-900 font-medium"
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
                                ? "text-gray-900"
                                : hasActiveSub
                                ? "text-yellow-400"
                                : ""
                            }`,
                          }
                        )
                      : item.icon}
                    {!isCollapsed && (
                      <span className="text-sm sm:text-base">{item.title}</span>
                    )}
                  </div>
                  {!isCollapsed && hasSubItems && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        itemExpanded ? "rotate-180" : ""
                      } ${
                        isDirectlyActive
                          ? "text-gray-900"
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
                                  ? "bg-[#FFCC00] text-gray-900 font-medium"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              }
                            `}
                          >
                            <span
                              className={subIsActive ? "text-gray-900" : ""}
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
      <div className="border-t border-gray-800 p-3 sm:p-4">
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
                    ? React.cloneElement(item.icon as React.ReactElement<any>, {
                        className: `w-4 h-4 sm:w-5 sm:h-5 ${
                          isActive ? "text-[#101010]" : ""
                        }`,
                      })
                    : item.icon}
                  {!isCollapsed && (
                    <span className="text-sm sm:text-base">{item.title}</span>
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
