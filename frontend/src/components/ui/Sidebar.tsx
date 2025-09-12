"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAuth } from "@/hooks/useAuth";

import {
  LayoutGrid,
  Receipt,
  DollarSign,
  Users,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { 
  IssueRewardsIcon, 
  RedeemIcon, 
  OverviewIcon,
  CustomerIcon,
  LookupIcon,
  BuyRcnIcon,
  TransactionIcon,
  BonusesIcon,
  AnalyticsIcon,
  SettingsIcon,
  LogoutIcon
} from "../icon";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  tabId?: string;
  subItems?: SidebarItem[];
}

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  activeSubTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  isSuperAdmin?: boolean;
  adminPermissions?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onToggle,
  userRole = "customer",
  activeTab,
  activeSubTab,
  onTabChange,
  onCollapseChange,
  isSuperAdmin = false,
  adminPermissions = [],
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Auto-collapse subtabs when switching to a different main tab
  React.useEffect(() => {
    // If activeTab changes and it's not "customers", collapse the customers subtab
    if (activeTab && activeTab !== "customers") {
      setExpandedItems(prev => prev.filter(id => id !== "customers"));
    }
    // If activeTab changes and it's not "shops-management", collapse the shops subtab
    if (activeTab && activeTab !== "shops-management") {
      setExpandedItems(prev => prev.filter(id => id !== "shops-management"));
    }
    // Auto-expand customers when it becomes active
    if (activeTab === "customers" && !expandedItems.includes("customers")) {
      setExpandedItems(prev => [...prev, "customers"]);
    }
    // Auto-expand shops when it becomes active
    if (activeTab === "shops-management" && !expandedItems.includes("shops-management")) {
      setExpandedItems(prev => [...prev, "shops-management"]);
    }
  }, [activeTab]);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const handleLogout = () => {
    // Clear auth store state
    logout();
    
    // Disconnect wallet
    if (wallet && disconnect) {
      disconnect(wallet);
      localStorage.clear();
    }
    
    // Redirect to home page
    router.push("/");
  };

  const getMenuItems = (): SidebarItem[] => {
    const commonItems: SidebarItem[] = [
      {
        title: "Overview",
        href: `/${userRole}`,
        icon: <LayoutGrid className="w-5 h-5" />,
      },
    ];

    if (userRole === "customer") {
      return [
        {
          title: "Overview",
          href: "/customer",
          icon: <LayoutGrid className="w-5 h-5" />,
          tabId: "overview",
        },
        {
          title: "Referrals",
          href: "/customer?tab=referrals",
          icon: <Users className="w-5 h-5" />,
          tabId: "referrals",
        },
        {
          title: "Approvals",
          href: "/customer?tab=approvals",
          icon: <Users className="w-5 h-5" />,
          tabId: "approvals",
        },
      ];
    }

    if (userRole === "shop") {
      return [
        {
          title: "Overview",
          href: "/shop?tab=overview",
          icon: <OverviewIcon width={24} height={24} />,
          tabId: "overview",
        },
        {
          title: "Issue Rewards",
          href: "/shop?tab=issue-rewards",
          icon: <IssueRewardsIcon width={24} height={24} />,
          tabId: "issue-rewards",
        },
        {
          title: "Redeem",
          href: "/shop?tab=redeem",
          icon: <RedeemIcon width={24} height={24} />,
          tabId: "redeem",
        },
        {
          title: "Customers",
          href: "/shop?tab=customers",
          icon: <CustomerIcon width={24} height={24} />,
          tabId: "customers",
        },
        {
          title: "Lookup",
          href: "/shop?tab=lookup",
          icon: <LookupIcon width={24} height={24} />,
          tabId: "lookup",
        },
        {
          title: "Buy Credits",
          href: "/shop?tab=purchase",
          icon: <BuyRcnIcon width={24} height={24} />,
          tabId: "purchase",
        },
        {
          title: "Subscription",
          href: "/shop?tab=subscription",
          icon: <span className="text-xl">💳</span>,
          tabId: "subscription",
        },
        {
          title: "Bonuses",
          href: "/shop?tab=bonuses",
          icon: <BonusesIcon width={24} height={24} />,
          tabId: "bonuses",
        },
        {
          title: "Analytics",
          href: "/shop?tab=analytics",
          icon: <AnalyticsIcon width={24} height={24} />,
          tabId: "analytics",
        },
      ];
    }

    if (userRole === "admin") {
      const adminItems = [];
      
      // Debug logging
      console.log("Sidebar rendering for admin");
      console.log("Sidebar - isSuperAdmin:", isSuperAdmin);
      console.log("Sidebar - adminPermissions:", adminPermissions);
      
      // Super admin (from env) gets all tabs
      // Regular admins get tabs based on their permissions
      const isFullAccess = isSuperAdmin === true || adminPermissions.includes('*');
      console.log("Sidebar - isFullAccess:", isFullAccess);
      
      // Overview is always visible for any admin
      adminItems.push({
        title: "Overview",
        href: "/admin?tab=overview",
        icon: <span className="text-xl">📊</span>,
        tabId: "overview",
      });
      
      // If super admin, show ALL tabs
      if (isFullAccess) {
        console.log("Super admin detected - showing all tabs");
        adminItems.push(
          {
            title: "Admins",
            href: "/admin?tab=admins",
            icon: <span className="text-xl">🛡️</span>,
            tabId: "admins",
          },
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
            title: "Treasury",
            href: "/admin?tab=treasury",
            icon: <span className="text-xl">💰</span>,
            tabId: "treasury",
          },
          {
            title: "Analytics",
            href: "/admin?tab=analytics",
            icon: <span className="text-xl">📈</span>,
            tabId: "analytics",
          }
        );
      } else {
        // Regular admin - show tabs based on specific permissions
        console.log("Regular admin - checking individual permissions");
        
        // Only show Admins tab if they have manage_admins permission
        if (adminPermissions.includes('manage_admins')) {
          adminItems.push({
            title: "Admins",
            href: "/admin?tab=admins",
            icon: <span className="text-xl">🛡️</span>,
            tabId: "admins",
          });
        }
        
        // Show Customers tab if user has manage_customers permission
        if (adminPermissions.includes('manage_customers')) {
          adminItems.push({
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
          });
        }
        
        // Show Shops tab if user has manage_shops permission
        if (adminPermissions.includes('manage_shops')) {
          adminItems.push({
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
          });
          
          // Also add Subscriptions if they can manage shops
          adminItems.push({
            title: "Subscriptions",
            href: "/admin?tab=subscriptions",
            icon: <span className="text-xl">💳</span>,
            tabId: "subscriptions",
          });
        }
        
        // Show Treasury tab if user has manage_treasury permission
        if (adminPermissions.includes('manage_treasury')) {
          adminItems.push({
            title: "Treasury",
            href: "/admin?tab=treasury",
            icon: <span className="text-xl">💰</span>,
            tabId: "treasury",
          });
        }
        
        // Show Analytics tab if user has view_analytics permission
        if (adminPermissions.includes('view_analytics')) {
          adminItems.push({
            title: "Analytics",
            href: "/admin?tab=analytics",
            icon: <span className="text-xl">📈</span>,
            tabId: "analytics",
          });
        }
      }
      
      return adminItems;
    }

    return commonItems;
  };

  const menuItems = getMenuItems();

  const bottomMenuItems: SidebarItem[] = userRole === "shop" ? [
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
  ] : userRole === "customer" ? [
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
    }
  ] : [
    {
      title: "Settings",
      href: `/${userRole}?tab=settings`,
      icon: <SettingsIcon width={24} height={24} />,
    },
    {
      title: "Logout",
      href: "/logout",
      icon: <LogoutIcon width={24} height={24} />,
    },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50 p-1.5 sm:p-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800"
      >
        {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
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
          <div className="relative p-4 sm:p-6 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              {!isCollapsed && (
                <img
                  src="/img/nav-logo.png"
                  alt="RepairCoin Logo"
                  className="w-auto"
                />
              )}
              {isCollapsed && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs sm:text-sm">RC</span>
                </div>
              )}
            </div>
            {/* Collapse Toggle Button - Only visible on desktop */}
            <button
              onClick={handleCollapseToggle}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-gray-900 hover:bg-gray-800 text-yellow-400 rounded-full p-1 sm:p-1.5 shadow-lg border border-gray-700 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 sm:py-4">
            <ul className="space-y-1 px-2 sm:px-3">
              {menuItems.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = expandedItems.includes(item.tabId || item.href);
                const hasActiveSubItem = hasSubItems && item.subItems?.some(sub => activeTab === sub.tabId);
                const isDirectlyActive = (userRole === "shop" || userRole === "customer" || userRole === "admin") && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href ||
                    (item.href !== `/${userRole}` &&
                      pathname.startsWith(item.href));

                const handleClick = (e: React.MouseEvent) => {
                  if (item.href === "/logout") {
                    e.preventDefault();
                    handleLogout();
                  } else if (hasSubItems) {
                    e.preventDefault();
                    const itemId = item.tabId || item.href;
                    setExpandedItems(prev =>
                      prev.includes(itemId)
                        ? prev.filter(id => id !== itemId)
                        : [...prev, itemId]
                    );
                    // Still navigate to main tab when clicking parent
                    if ((userRole === "shop" || userRole === "customer" || userRole === "admin") && item.tabId && onTabChange) {
                      onTabChange(item.tabId);
                    }
                  } else if ((userRole === "shop" || userRole === "customer" || userRole === "admin") && item.tabId && onTabChange) {
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
                        flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isDirectlyActive
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
                          ? React.cloneElement(item.icon as React.ReactElement<any>, {
                              className: `w-4 h-4 sm:w-5 sm:h-5 ${
                                isDirectlyActive ? "text-gray-900" : hasActiveSubItem ? "text-yellow-400" : ""
                              }`
                            })
                          : item.icon
                        }
                        {!isCollapsed && <span className="text-sm sm:text-base">{item.title}</span>}
                      </div>
                      {!isCollapsed && hasSubItems && (
                        <ChevronDown 
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          } ${
                            isDirectlyActive ? "text-gray-900" : hasActiveSubItem ? "text-yellow-400" : "text-gray-400"
                          }`}
                        />
                      )}
                    </Link>
                    
                    {/* Sub Items */}
                    {!isCollapsed && hasSubItems && isExpanded && (
                      <ul className="mt-1 ml-4 space-y-1">
                        {item.subItems?.map((subItem) => {
                          const subIsActive = (userRole === "shop" || userRole === "customer" || userRole === "admin") && subItem.tabId
                            ? activeSubTab === subItem.tabId
                            : pathname === subItem.href;

                          const handleSubClick = (e: React.MouseEvent) => {
                            if ((userRole === "shop" || userRole === "customer" || userRole === "admin") && subItem.tabId && onTabChange) {
                              e.preventDefault();
                              onTabChange(subItem.tabId);
                            }
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
                                <span className={subIsActive ? "text-gray-900" : ""}>{subItem.icon}</span>
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

          {/* Bottom Navigation */}
          <div className="border-t border-gray-800 p-3 sm:p-4">
            <ul className="space-y-1">
              {bottomMenuItems.map((item) => {
                const isActive = (userRole === "shop" || userRole === "customer" || userRole === "admin") && item.tabId
                  ? activeTab === item.tabId
                  : pathname === item.href;

                const handleClick = (e: React.MouseEvent) => {
                  if (item.href === "/logout") {
                    e.preventDefault();
                    handleLogout();
                  } else if ((userRole === "shop" || userRole === "customer" || userRole === "admin") && item.tabId && onTabChange) {
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
                        flex items-center ${isCollapsed ? "justify-center" : "space-x-3"} px-3 sm:px-4 py-2 sm:py-3 rounded-lg
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-yellow-400 text-gray-900 font-medium"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                      title={isCollapsed ? item.title : undefined}
                    >
                      {React.isValidElement(item.icon) 
                        ? React.cloneElement(item.icon as React.ReactElement<any>, {
                            className: `w-4 h-4 sm:w-5 sm:h-5 ${isActive ? "text-gray-900" : ""}`
                          })
                        : item.icon
                      }
                      {!isCollapsed && <span className="text-sm sm:text-base">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
