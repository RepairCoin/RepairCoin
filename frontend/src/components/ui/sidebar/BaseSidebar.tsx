"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, Lock } from "lucide-react";
import { SidebarItem } from "./useSidebar";
import { useAuthStore } from "@/stores/authStore";

interface BaseSidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  onNavigateHome: () => void;
  onLogout?: () => void;
  userRole: "customer" | "shop" | "admin";
  children: React.ReactNode;
}

const getInitials = (name?: string, address?: string) => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
  if (address) return address.slice(2, 4).toUpperCase();
  return "RC";
};

export const BaseSidebar: React.FC<BaseSidebarProps> = ({
  isOpen,
  onToggle,
  isCollapsed,
  onCollapseToggle,
  onNavigateHome,
  onLogout,
  userRole,
  children,
}) => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const [avatarError, setAvatarError] = React.useState(false);
  const avatarUrl = userProfile?.avatarUrl;

  // Reset the error flag whenever the avatar URL changes, so a transient
  // empty/late value during login doesn't permanently fall back to initials.
  React.useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  const displayName =
    userProfile?.name?.trim() ||
    (userProfile?.address
      ? `${userProfile.address.slice(0, 6)}…${userProfile.address.slice(-4)}`
      : `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)} Account`);
  const displayEmail =
    userProfile?.email?.trim() ||
    (userProfile?.address ? `${userProfile.address.slice(0, 12)}…` : "");
  const initials = getInitials(userProfile?.name, userProfile?.address);
  return (
    <>
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
          <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex-shrink-0">
            <button
              onClick={onNavigateHome}
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
                <img
                  src="/img/landing/fixflow-icon.png"
                  alt="Fixflow"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain"
                />
              )}
            </button>
            {/* Collapse Toggle Button - Only visible on desktop */}
            <button
              onClick={onCollapseToggle}
              className="hidden lg:flex absolute -right-3 top-5 bg-[#1c1c1c] hover:bg-gray-800 text-white rounded-md p-1 sm:p-1.5 shadow-lg border border-gray-700 transition-colors"
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
            {children}
          </div>

          {/* Account footer — Logout + profile card */}
          <div className="flex-shrink-0 border-t border-gray-800 p-3 sm:p-4">
            {onLogout && (
              <button
                onClick={onLogout}
                title="Logout Account"
                className={`flex items-center ${
                  isCollapsed ? "justify-center" : "space-x-3"
                } w-full px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors`}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-[13px] sm:text-sm font-medium">
                    Logout Account
                  </span>
                )}
              </button>
            )}

            <div
              className={`mt-2 flex items-center ${
                isCollapsed ? "justify-center" : "gap-3"
              }`}
            >
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={() => setAvatarError(true)}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full bg-[#FFCC00] text-[#101010] flex items-center justify-center text-sm font-bold">
                  {initials}
                </div>
              )}
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {displayName}
                  </p>
                  {displayEmail && (
                    <p className="text-xs text-gray-400 truncate">
                      {displayEmail}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Reusable SidebarMenuItem component
interface SidebarMenuItemProps {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed: boolean;
  hasSubItems: boolean;
  isExpanded: boolean;
  hasActiveSubItem: boolean;
  onClick: (e: React.MouseEvent) => void;
  onSubItemClick: (subItem: SidebarItem, e: React.MouseEvent) => void;
  activeSubTab?: string;
}

export const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
  item,
  isActive,
  isCollapsed,
  hasSubItems,
  isExpanded,
  hasActiveSubItem,
  onClick,
  onSubItemClick,
  activeSubTab,
}) => {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        className={`
          flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 sm:px-4 py-2 rounded-lg
          transition-colors duration-200
          ${
            isActive
              ? "bg-[#FFCC00] text-[#101010] font-medium"
              : hasActiveSubItem
              ? "bg-gray-800 text-yellow-400 font-medium border border-yellow-400 border-opacity-30"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }
        `}
        title={isCollapsed ? item.title : undefined}
      >
        <div className={`flex items-center ${isCollapsed ? "" : "space-x-3"}`}>
          {React.isValidElement(item.icon)
            ? React.cloneElement(
                item.icon as React.ReactElement<
                  React.HTMLAttributes<HTMLElement>
                >,
                {
                  className: `w-4 h-4 sm:w-5 sm:h-5 ${
                    isActive
                      ? "text-[#101010]"
                      : hasActiveSubItem
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
              isExpanded ? "rotate-180" : ""
            } ${
              isActive
                ? "text-[#101010]"
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
            const subIsActive = subItem.tabId
              ? activeSubTab === subItem.tabId
              : false;

            return (
              <li key={subItem.href}>
                <Link
                  href={subItem.href}
                  onClick={(e) => onSubItemClick(subItem, e)}
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
                  <span className={subIsActive ? "text-[#101010]" : ""}>
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
};

// Reusable SectionHeader component — styled as a full menu row with an icon
interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  hasActiveItem?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  isExpanded,
  onToggle,
  icon,
  hasActiveItem = false,
}) => {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between w-full px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 ${
        hasActiveItem
          ? "text-[#FFCC00]"
          : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0">
        <span className="flex-shrink-0">
          {React.isValidElement(icon)
            ? React.cloneElement(
                icon as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
                { className: "w-4 h-4 sm:w-5 sm:h-5" }
              )
            : icon}
        </span>
        <span className="text-[13px] sm:text-sm font-medium capitalize whitespace-nowrap">
          {title.toLowerCase()}
        </span>
      </div>
      <ChevronDown
        className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-200 ${
          isExpanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
};

// Simple menu item for section items (shop sidebar)
interface SectionMenuItemProps {
  item: SidebarItem;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export const SectionMenuItem: React.FC<SectionMenuItemProps> = ({
  item,
  isActive,
  onClick,
}) => {
  return (
    <li>
      <div className="flex items-center gap-1">
        <Link
          href={item.href}
          onClick={onClick}
          className={`
            flex items-center space-x-3 px-3 sm:px-4 py-2 rounded-lg flex-1
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
                  item.icon as React.ReactElement<
                    React.HTMLAttributes<HTMLElement>
                  >,
                  {
                    className: `w-5 h-5 ${isActive ? "text-[#101010]" : ""}`,
                  }
                )
              : item.icon}
          </div>
          <span className="text-[13px] sm:text-sm">{item.title}</span>
          {item.badge && item.badge.count > 0 && (
            <span className={`ml-auto px-2 py-0.5 text-xs font-bold rounded-full ${
              item.badge.variant === 'danger' ? 'bg-red-500 text-white' :
              item.badge.variant === 'warning' ? 'bg-yellow-500 text-black' :
              'bg-blue-500 text-white'
            }`}>
              {item.badge.count > 99 ? '99+' : item.badge.count}
            </span>
          )}
          {/* WS2: tier-locked tab — a lock hint (content shows the upgrade prompt on click) */}
          {item.locked && !isActive && (
            <Lock className="ml-auto w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-label="Upgrade to unlock" />
          )}
        </Link>

        {/* Action Button */}
        {item.actionButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              item.actionButton?.onClick();
            }}
            title={item.actionButton.tooltip}
            className="p-2 rounded-lg bg-[#FFCC00] hover:bg-[#e6b800] text-[#101010] transition-colors"
          >
            {item.actionButton.icon}
          </button>
        )}
      </div>
    </li>
  );
};
