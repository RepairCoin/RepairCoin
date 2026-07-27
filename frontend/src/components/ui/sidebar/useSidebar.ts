"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAuthStore } from "@/stores/authStore";
import { logout } from "@/services/api/auth";

export interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  tabId?: string;
  /**
   * Extra tabIds that should also light this item up. Used when several tabs were
   * merged behind one nav entry and are now reached via in-page sub-tabs (e.g.
   * Bookings covers bookings/appointments/disputes), so the parent stays active.
   */
  matchTabIds?: string[];
  subItems?: SidebarItem[];
  actionButton?: {
    icon: React.ReactNode;
    onClick: () => void;
    tooltip?: string;
  };
  badge?: {
    count: number;
    variant?: 'danger' | 'warning' | 'info';
  };
  // WS2: the tab's content is gated to a higher plan tier — show a lock hint in the nav.
  locked?: boolean;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
  id: string;
  icon?: React.ReactNode;
}

export interface UseSidebarProps {
  userRole: "customer" | "shop" | "admin";
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  defaultExpandedSections?: string[];
}

export function useSidebar({
  userRole,
  activeTab,
  onTabChange,
  onCollapseChange,
  defaultExpandedSections = [],
}: UseSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { resetAuth } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>(defaultExpandedSections);

  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  }, [isCollapsed, onCollapseChange]);

  const handleLogout = useCallback(async () => {
    try {
      // Clear auth store state
      resetAuth();

      // Disconnect wallet (wrapped in try-catch as it can fail)
      if (wallet && disconnect) {
        try {
          disconnect(wallet);
        } catch (disconnectError) {
          console.warn('Wallet disconnect error (non-blocking):', disconnectError);
        }
      }

      // Clear auth-related localStorage keys (preserve user preferences like accessibility)
      const keysToPreserve = ['accessibility-storage'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Call backend to clear httpOnly cookie
      try {
        await logout();
      } catch (logoutError) {
        console.warn('Backend logout error (non-blocking):', logoutError);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always redirect to home page after logout
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, [resetAuth, wallet, disconnect]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  const toggleExpandedItem = useCallback((itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }, []);

  const handleItemClick = useCallback(
    (item: SidebarItem, e: React.MouseEvent) => {
      if (item.href === "/logout") {
        e.preventDefault();
        handleLogout();
      } else if (item.subItems && item.subItems.length > 0) {
        e.preventDefault();
        const itemId = item.tabId || item.href;
        toggleExpandedItem(itemId);
        // Still navigate to main tab when clicking parent
        if (item.tabId && onTabChange) {
          onTabChange(item.tabId);
        }
      } else if (item.tabId && onTabChange) {
        e.preventDefault();
        onTabChange(item.tabId);
      }
    },
    [handleLogout, toggleExpandedItem, onTabChange]
  );

  const handleSubItemClick = useCallback(
    (subItem: SidebarItem, e: React.MouseEvent) => {
      if (subItem.tabId && onTabChange) {
        e.preventDefault();
        onTabChange(subItem.tabId);
      }
    },
    [onTabChange]
  );

  const isItemActive = useCallback(
    (item: SidebarItem) => {
      // First check if pathname matches the href (for direct page routes like /shop/groups)
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return true;
      }
      // A merged entry stays active for any of the tabs it now fronts.
      if (activeTab && item.matchTabIds?.includes(activeTab)) {
        return true;
      }
      // Then check tabId for tab-based navigation
      return item.tabId ? activeTab === item.tabId : false;
    },
    [activeTab, pathname]
  );

  const isSubItemActive = useCallback(
    (subItem: SidebarItem, parentTabId?: string) => {
      // For admin sub-items, check if it matches the activeSubTab pattern
      return subItem.tabId ? activeTab === parentTabId : pathname === subItem.href;
    },
    [activeTab, pathname]
  );

  const hasActiveSubItem = useCallback(
    (item: SidebarItem): boolean => {
      return !!(
        item.subItems && item.subItems.some((sub) => activeTab === sub.tabId)
      );
    },
    [activeTab]
  );

  const isExpanded = useCallback(
    (item: SidebarItem) => {
      return expandedItems.includes(item.tabId || item.href);
    },
    [expandedItems]
  );

  const isSectionExpanded = useCallback(
    (sectionId: string) => {
      return expandedSections.includes(sectionId);
    },
    [expandedSections]
  );

  const navigateToHome = useCallback(() => {
    const destination = `/${userRole}?tab=overview`;
    router.push(destination);
  }, [userRole, router]);

  return {
    pathname,
    isCollapsed,
    expandedItems,
    expandedSections,
    handleCollapseToggle,
    handleLogout,
    toggleSection,
    toggleExpandedItem,
    handleItemClick,
    handleSubItemClick,
    isItemActive,
    isSubItemActive,
    hasActiveSubItem,
    isExpanded,
    isSectionExpanded,
    navigateToHome,
    setExpandedItems,
  };
}
