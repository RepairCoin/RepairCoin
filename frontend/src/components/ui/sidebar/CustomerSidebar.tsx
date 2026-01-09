"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Settings,
  LogOut,
  MapPin,
  Gift,
  ShoppingBag,
  Receipt,
  UserPlus,
  CheckCircle,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { SettingsIcon, LogoutIcon } from "@/components/icon";
import { BaseSidebar, SidebarMenuItem } from "./BaseSidebar";
import { useSidebar, SidebarItem } from "./useSidebar";

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
  const {
    isCollapsed,
    handleCollapseToggle,
    handleItemClick,
    handleSubItemClick,
    isItemActive,
    hasActiveSubItem,
    isExpanded,
    navigateToHome,
  } = useSidebar({
    userRole: "customer",
    activeTab,
    onTabChange,
    onCollapseChange,
  });

  const menuItems: SidebarItem[] = [
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
      title: "Messages",
      href: "/customer?tab=messages",
      icon: <MessageSquare className="w-5 h-5" />,
      tabId: "messages",
    },
    {
      title: "Appointments",
      href: "/customer?tab=appointments",
      icon: <Calendar className="w-5 h-5" />,
      tabId: "appointments",
    },
    {
      title: "Referrals",
      href: "/customer?tab=referrals",
      icon: <UserPlus className="w-5 h-5" />,
      tabId: "referrals",
    },
    {
      title: "Approvals",
      href: "/customer?tab=approvals",
      icon: <CheckCircle className="w-5 h-5" />,
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

  const bottomMenuItems: SidebarItem[] = [
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
      {/* Main Navigation */}
      <nav className="py-3 sm:py-4">
        <ul className="space-y-1 px-2 sm:px-3">
          {menuItems.map((item) => (
            <SidebarMenuItem
              key={item.href}
              item={item}
              isActive={isItemActive(item)}
              isCollapsed={isCollapsed}
              hasSubItems={false}
              isExpanded={isExpanded(item)}
              hasActiveSubItem={hasActiveSubItem(item)}
              onClick={(e) => handleItemClick(item, e)}
              onSubItemClick={handleSubItemClick}
            />
          ))}
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
                    flex items-center ${isCollapsed ? "justify-center" : "space-x-3"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
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

export default CustomerSidebar;
