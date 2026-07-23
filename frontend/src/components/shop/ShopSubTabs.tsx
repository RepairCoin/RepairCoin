"use client";

import React from "react";

/**
 * ShopSubTabs
 *
 * In-page tab bar for nav entries that were merged to keep the sidebar short.
 * Selecting a sub-tab just switches the dashboard's activeTab, so every tab
 * keeps its own guards, permissions, breadcrumb and deep links (/shop?tab=…)
 * exactly as before — only the sidebar got smaller.
 */

export interface ShopSubTab {
  tabId: string;
  label: string;
}

/** Merged nav groups: sidebar entry tabId -> the tabs it now fronts. */
export const SHOP_TAB_GROUPS: Record<string, ShopSubTab[]> = {
  bookings: [
    { tabId: "bookings", label: "Bookings" },
    { tabId: "appointments", label: "Appointments" },
    { tabId: "disputes", label: "Disputes" },
  ],
  inventory: [
    { tabId: "inventory", label: "Inventory" },
    { tabId: "purchase-orders", label: "Purchase Orders" },
  ],
  "service-analytics": [
    { tabId: "service-analytics", label: "Analytics" },
    { tabId: "customers", label: "Customers" },
  ],
};

/** The sub-tabs for a tab, or null when it isn't part of a merged group. */
export function getSubTabsFor(activeTab: string): ShopSubTab[] | null {
  const group = Object.values(SHOP_TAB_GROUPS).find((tabs) =>
    tabs.some((t) => t.tabId === activeTab)
  );
  return group ?? null;
}

interface ShopSubTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** Tabs the member may not view — rendered hidden rather than disabled. */
  canViewTab?: (tabId: string) => boolean;
}

export const ShopSubTabs: React.FC<ShopSubTabsProps> = ({
  activeTab,
  onTabChange,
  canViewTab,
}) => {
  const tabs = getSubTabsFor(activeTab);
  if (!tabs) return null;

  const visible = canViewTab ? tabs.filter((t) => canViewTab(t.tabId)) : tabs;
  // Nothing to switch between — don't render a one-tab bar.
  if (visible.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Section tabs"
      className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-gray-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {visible.map((tab) => {
        const isActive = tab.tabId === activeTab;
        return (
          <button
            key={tab.tabId}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => !isActive && onTabChange(tab.tabId)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? "border-[#FFCC00] text-[#FFCC00]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default ShopSubTabs;
