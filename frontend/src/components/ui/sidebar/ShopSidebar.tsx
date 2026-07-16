"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { appointmentsApi } from "@/services/api/appointments";
import { getAssignableMembers } from "@/services/api/team";
import { agencyApi } from "@/services/api/agency";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";
import {
  Settings,
  Search,
  BarChart3,
  ChevronDown,
  LogOut,
  HouseIcon,
  HeartHandshakeIcon,
  ClipboardCheckIcon,
  GemIcon,
  ShoppingBagIcon,
  TagIcon,
  UsersIcon,
  MessageCircle,
  GlobeIcon,
  MapPinnedIcon,
  Calendar,
  Store,
  TrendingUp,
  Wrench,
  LifeBuoy,
  AlertTriangle,
  Wallet,
  FileBarChart,
  Megaphone,
  Package,
  CreditCard,
  Percent,
} from "lucide-react";
import { BuyRcnIcon } from "@/components/icon";
import { BaseSidebar, SectionMenuItem } from "./BaseSidebar";
import { useSidebar, SidebarItem, SidebarSection } from "./useSidebar";
import { useAuthStore } from "@/stores/authStore";
import { SHOP_TAB_PERMISSIONS } from "@/config/shopTabPermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

// WS2: sidebar tabs whose content is tier-gated → the feature key that unlocks them.
// Mirrors the <TierGate feature="…"> wrappers on the tab content. A lock hint shows
// in the nav when the shop's plan doesn't include the feature (click still routes to
// the tab, where the upgrade prompt explains why).
const TAB_FEATURE: Record<string, string> = {
  inventory: "inventoryManagement",
  reports: "advancedReports",
  marketing: "campaignBuilder",
  team: "teamManagement",
  locations: "multiLocation",
};

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
  const [pendingRescheduleCount, setPendingRescheduleCount] = useState(0);
  // Whether the shop has staff commissions turned on — gates the Commissions nav item.
  const [commissionsEnabled, setCommissionsEnabled] = useState(false);
  // Whether this shop has activated the Agency Program add-on — gates the Agency nav item.
  const [hasAgency, setHasAgency] = useState(false);
  // Subscribe to userProfile so the nav re-filters when permissions load.
  const userProfile = useAuthStore((s) => s.userProfile);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  // WS2: plan-tier feature access — drives the nav lock hints (loading = no lock).
  const { can, loading: featureAccessLoading } = useFeatureAccess();
  // Collapsed-state hover flyout: which group is open + its vertical anchor
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  // RCG staking is a blockchain-only feature; hide its nav item in database-only mode
  const blockchainEnabled = useBlockchainEnabled();

  // Fetch pending reschedule count for badge
  const fetchPendingCount = useCallback(async () => {
    try {
      const count = await appointmentsApi.getShopRescheduleRequestCount();
      setPendingRescheduleCount(count);
    } catch (error) {
      // Silently fail - badge just won't show
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const handler = () => fetchPendingCount();
    window.addEventListener('reschedule-count-changed', handler);
    return () => window.removeEventListener('reschedule-count-changed', handler);
  }, [fetchPendingCount]);

  // The Commissions nav item only appears when the shop has commissions on. Re-checked when
  // the owner toggles it (CommissionSettings dispatches 'commissions-changed').
  const fetchCommissionsEnabled = useCallback(async () => {
    try {
      const data = await getAssignableMembers();
      setCommissionsEnabled(data.commissionsEnabled);
    } catch {
      setCommissionsEnabled(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissionsEnabled();
    const handler = () => fetchCommissionsEnabled();
    window.addEventListener('commissions-changed', handler);
    return () => window.removeEventListener('commissions-changed', handler);
  }, [fetchCommissionsEnabled]);

  // The Agency nav item only appears when this shop has activated the Agency Program add-on
  // (i.e. GET /agency/me resolves an agency for it).
  useEffect(() => {
    let active = true;
    agencyApi
      .getMe()
      .then(() => active && setHasAgency(true))
      .catch(() => active && setHasAgency(false));
    return () => {
      active = false;
    };
  }, []);

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
    defaultExpandedSections: ["dashboard", "service", "rewards", "customers", "shop-tools"],
  });

  // Shop sections definition
  const shopSectionsRaw: SidebarSection[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <HouseIcon className="w-5 h-5" />,
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
      title: "Service",
      icon: <HeartHandshakeIcon className="w-5 h-5" />,
      items: [
        {
          title: "Services",
          href: "/shop?tab=services",
          icon: <HeartHandshakeIcon className="w-5 h-5" />,
          tabId: "services",
        },
        {
          title: "Inventory",
          href: "/shop?tab=inventory",
          icon: <ShoppingBagIcon className="w-5 h-5" />,
          tabId: "inventory",
        },
        {
          title: "Purchase Orders",
          href: "/shop?tab=purchase-orders",
          icon: <Package className="w-5 h-5" />,
          tabId: "purchase-orders",
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
          badge: pendingRescheduleCount > 0 ? { count: pendingRescheduleCount, variant: 'danger' as const } : undefined,
        },
        {
          title: "Disputes",
          href: "/shop?tab=disputes",
          icon: <AlertTriangle className="w-5 h-5" />,
          tabId: "disputes",
        },
      ],
    },
    {
      id: "rewards",
      title: "Rewards",
      icon: <GemIcon className="w-5 h-5" />,
      items: [
        {
          title: "Tools",
          href: "/shop?tab=tools",
          icon: <Wrench className="w-5 h-5" />,
          tabId: "tools",
        },
      ],
    },
    {
      id: "customers",
      title: "Customers",
      icon: <UsersIcon className="w-5 h-5" />,
      items: [
        {
          title: "Customers",
          href: "/shop?tab=customers",
          icon: <UsersIcon className="w-5 h-5" />,
          tabId: "customers",
        },
        {
          title: "Messages",
          href: "/shop?tab=messages",
          icon: <MessageCircle className="w-5 h-5" />,
          tabId: "messages",
        },
        // Lookup tab hidden for now - re-enable when ready
        // {
        //   title: "Lookup",
        //   href: "/shop?tab=lookup",
        //   icon: <Search className="w-5 h-5" />,
        //   tabId: "lookup",
        // },
      ],
    },
    {
      id: "shop-tools",
      title: "Shop Management",
      icon: <Store className="w-5 h-5" />,
      items: [
        {
          title: "Shop Profile",
          href: "/shop?tab=profile",
          icon: <Store className="w-5 h-5" />,
          tabId: "profile",
        },
        {
          title: "Marketing",
          href: "/shop?tab=marketing",
          icon: <Megaphone className="w-5 h-5" />,
          tabId: "marketing",
        },
        {
          title: "Team",
          href: "/shop?tab=team",
          icon: <UsersIcon className="w-5 h-5" />,
          tabId: "team",
        },
        ...(commissionsEnabled
          ? [
              {
                title: "Commissions",
                href: "/shop?tab=commissions",
                icon: <Percent className="w-5 h-5" />,
                tabId: "commissions",
              },
            ]
          : []),
        ...(hasAgency
          ? [
              {
                title: "Agency",
                href: "/shop?tab=agency",
                icon: <Store className="w-5 h-5" />,
              },
            ]
          : []),
        // Ads is reached via the Plans & Billing hub (AI Ads card → ?tab=ads),
        // so the standalone sidebar link is removed to avoid a duplicate entry.
        {
          title: "Reports",
          href: "/shop?tab=reports",
          icon: <FileBarChart className="w-5 h-5" />,
          tabId: "reports",
        },
        // {
        //   title: "Affiliate Groups",
        //   href: "/shop/groups",
        //   icon: <GlobeIcon className="w-5 h-5" />,
        //   tabId: "groups",
        // },
        {
          title: "Locations",
          href: "/shop?tab=locations",
          icon: <MapPinnedIcon className="w-5 h-5" />,
          tabId: "locations",
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
        ...(blockchainEnabled
          ? [
              {
                title: "Stake RCG",
                href: "/shop?tab=staking",
                icon: <TrendingUp className="w-5 h-5" />,
                tabId: "staking",
              },
            ]
          : []),
      ],
    },
  ];

  const bottomMenuItemsRaw: SidebarItem[] = [
    {
      title: "Support",
      href: "/shop?tab=support",
      icon: <LifeBuoy className="w-5 h-5" />,
      tabId: "support",
    },
    ...(process.env.NEXT_PUBLIC_ADDON_HUB_ENABLED === "true"
      ? [
          {
            title: "Plans & Billing",
            href: "/shop?tab=plans",
            icon: <CreditCard className="w-5 h-5" />,
            tabId: "plans",
          },
        ]
      : []),
    // Wallet & Payouts is blockchain-only — hidden in database-only mode.
    ...(blockchainEnabled
      ? [{
          title: "Wallet & Payouts",
          href: "/shop?tab=wallet-payouts",
          icon: <Wallet className="w-5 h-5" />,
          tabId: "wallet-payouts",
        }]
      : []),
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

  // Hide tabs the current member lacks permission for. Owners/admins (permissions
  // '*' or absent) see everything; unmapped tabs are always visible.
  const canViewTab = (tabId?: string) => {
    if (!tabId) return true;
    const required = SHOP_TAB_PERMISSIONS[tabId];
    return !required || hasPermission(required);
  };
  // WS2: a tab is "locked" when it's tier-gated and the shop's plan doesn't include it.
  // Suppressed while feature access is loading so tabs don't flash a lock on first paint.
  const isTabLocked = (tabId?: string) => {
    if (featureAccessLoading || !tabId) return false;
    const feature = TAB_FEATURE[tabId];
    return !!feature && !can(feature);
  };
  const shopSections: SidebarSection[] = shopSectionsRaw
    .map((section) => ({
      ...section,
      items: section.items
        .filter((i) => canViewTab(i.tabId))
        .map((i) => ({ ...i, locked: isTabLocked(i.tabId) })),
    }))
    .filter((section) => section.items.length > 0);
  const bottomMenuItems: SidebarItem[] = bottomMenuItemsRaw.filter((i) => canViewTab(i.tabId));

  const settingsItems = bottomMenuItems.filter(
    (item) => item.href !== "/logout"
  );
  const logoutItem = bottomMenuItems.find((item) => item.href === "/logout");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const matchesQuery = (text: string) =>
    text.toLowerCase().includes(normalizedQuery);

  const filteredSections = isSearching
    ? shopSections
        .map((section) => ({
          ...section,
          items: matchesQuery(section.title)
            ? section.items
            : section.items.filter((item) => matchesQuery(item.title)),
        }))
        .filter((section) => section.items.length > 0)
    : shopSections;

  const filteredBottomItems = isSearching
    ? bottomMenuItems.filter((item) => matchesQuery(item.title))
    : bottomMenuItems;

  const hasResults =
    filteredSections.length > 0 || filteredBottomItems.length > 0;

  // Renders a group as a single icon with a hover flyout of its items (collapsed mode)
  const renderCollapsedGroup = (opts: {
    id: string;
    title: string;
    icon: React.ReactNode;
    items: SidebarItem[];
    onItemClick: (item: SidebarItem, e: React.MouseEvent) => void;
  }) => {
    const { id, title, icon, items, onItemClick } = opts;
    const groupActive = items.some((item) => isItemActive(item));
    const isOpen = hoveredGroup === id;
    const first = items[0];
    const hasSubItems = items.length > 1;
    const triggerClass = `p-2 rounded-lg transition-colors ${
      groupActive
        ? "bg-[#FFCC00] text-[#101010]"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;
    const iconEl = React.isValidElement(icon)
      ? React.cloneElement(
          icon as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
          { className: `w-5 h-5 ${groupActive ? "text-[#101010]" : ""}` }
        )
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
        {hasSubItems ? (
          // Multi-item group: clicking only opens the flyout (no navigation)
          <button
            type="button"
            title={title}
            onClick={() => setHoveredGroup(id)}
            className={triggerClass}
          >
            {iconEl}
          </button>
        ) : (
          // Single item: navigate directly on click
          <Link
            href={first.href}
            onClick={(e) => onItemClick(first, e)}
            title={title}
            className={triggerClass}
          >
            {iconEl}
          </Link>
        )}
        {isOpen && (
          <div
            style={{ position: "fixed", top: flyoutTop, left: 80 }}
            className="z-[60] min-w-[190px] bg-[#1c1c1c] border border-gray-800 rounded-lg shadow-xl py-2 before:content-[''] before:absolute before:top-0 before:-left-2 before:h-full before:w-2"
          >
            <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-gray-400">
              {title}
            </p>
            {items.map((item) => {
              const active = isItemActive(item);
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
      userRole="shop"
    >
      {/* Search Box */}
      {!isCollapsed ? (
        <div className="px-4 pt-1 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-transparent rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#FFCC00] transition-colors"
            />
          </div>
        </div>
      ) : (
        <div className="px-2 pt-2 pb-0 flex justify-center">
          <button
            onClick={handleCollapseToggle}
            title="Search"
            className="p-2 rounded-full bg-[#1c1c1c] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className={`${isCollapsed ? "pt-2" : "pt-1"} pb-0`}>
        {!isCollapsed ? (
          /* Shop Sidebar with Sections */
          <div className="px-2 sm:px-3">
            {isSearching && !hasResults && (
              <p className="px-2 py-3 text-sm text-gray-400">
                No results for &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            )}
            {filteredSections.map((section) => {
              const sectionExpanded = isSearching || isSectionExpanded(section.id);

              return (
                <div
                  key={section.id}
                  className="border-b border-gray-800 py-2"
                >
                  {/* Section Header — gray label + chevron, no icon */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center justify-between w-full px-2 py-2 text-xs font-medium tracking-wide text-gray-400 hover:text-white transition-colors"
                  >
                    <span>{section.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        sectionExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Section Items */}
                  {sectionExpanded && (
                    <ul className="space-y-1 mt-1">
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
          /* Collapsed state - group icons with hover flyouts */
          <div className="px-2">
            <div className="space-y-1">
              {shopSections.map((section) =>
                renderCollapsedGroup({
                  id: section.id,
                  title: section.title,
                  icon: section.icon,
                  items: section.items,
                  onItemClick: (item, e) => {
                    const isDirectPageRoute = !item.href.includes("?tab=");
                    if (isDirectPageRoute) return;
                    if (item.tabId && onTabChange) {
                      e.preventDefault();
                      onTabChange(item.tabId);
                    }
                  },
                })
              )}
            </div>

            <div className="border-t border-gray-800 my-2" />

            {/* Settings group */}
            {renderCollapsedGroup({
              id: "settings",
              title: "Settings",
              icon: <Settings className="w-5 h-5" />,
              items: settingsItems,
              onItemClick: (item, e) => handleItemClick(item, e),
            })}

            {logoutItem && (
              <>
                <div className="border-t border-gray-800 my-2" />
                <div className="flex justify-center">
                  <button
                    onClick={(e) => handleItemClick(logoutItem, e)}
                    title="Logout"
                    className="p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Settings Section — static, always expanded (collapsed handled in nav) */}
      {!isCollapsed && (!isSearching || filteredBottomItems.length > 0) && (
      <div className="px-2 sm:px-3 pt-2 pb-3">
        {!isSearching && (
          <p className="px-2 py-2 text-xs font-medium tracking-wide text-gray-400">
            Settings
          </p>
        )}

        {/* Settings items are always shown (non-collapsible) */}
        {(filteredBottomItems.length > 0) && (
          <ul
            className={`space-y-1 ${isSearching ? "" : "mt-1"}`}
          >
            {filteredBottomItems.map((item) => {
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
                      <span className="text-[13px] sm:text-sm">{item.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
    </BaseSidebar>
  );
};

export default ShopSidebar;
