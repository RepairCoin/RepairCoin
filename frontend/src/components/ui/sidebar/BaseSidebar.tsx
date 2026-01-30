"use client";

import React from "react";
import Link from "next/link";
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { SidebarItem } from "./useSidebar";

interface BaseSidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  onNavigateHome: () => void;
  userRole: "customer" | "shop" | "admin";
  children: React.ReactNode;
}

export const BaseSidebar: React.FC<BaseSidebarProps> = ({
  isOpen,
  onToggle,
  isCollapsed,
  onCollapseToggle,
  onNavigateHome,
  userRole,
  children,
}) => {
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
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs sm:text-sm">
                    RC
                  </span>
                </div>
              )}
            </button>
            {/* Collapse Toggle Button - Only visible on desktop */}
            <button
              onClick={onCollapseToggle}
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
            {children}
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
          flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
          transition-colors duration-200
          ${
            isActive
              ? "bg-yellow-400 text-gray-900 font-medium"
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
                      ? "text-gray-900"
                      : hasActiveSubItem
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
              isExpanded ? "rotate-180" : ""
            } ${
              isActive
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
                        ? "bg-[#FFCC00] text-gray-900 font-medium"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }
                  `}
                >
                  <span className={subIsActive ? "text-gray-900" : ""}>
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

// Reusable SectionHeader component
interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  isExpanded,
  onToggle,
}) => {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-2 py-2 text-[#FFCC00] text-xs font-semibold tracking-wider hover:opacity-80 transition-opacity"
    >
      <span>{title}</span>
      <ChevronDown
        className={`w-4 h-4 transition-transform duration-200 ${
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
            flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg flex-1
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
          <span className="text-sm sm:text-base">{item.title}</span>
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
