"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { CustomerSidebar, ShopSidebar, AdminSidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageIcon } from "@/components/messaging/MessageIcon";
import { CartIcon } from "@/components/ui/CartIcon";
import { UnifiedAssistantLauncher, UnifiedAssistantHost } from "@/components/shop/unified/UnifiedAssistantLauncher";
import { HeaderVoiceMic } from "@/components/voice/HeaderVoiceMic";
import { MobileBottomNavMic } from "@/components/voice/MobileBottomNavMic";
import { useNotifications } from "@/hooks/useNotifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  activeSubTab?: string;
  onTabChange?: (tab: string) => void;
  isSuperAdmin?: boolean;
  adminRole?: string;
  /**
   * Viewport-lock mode. When true, the wrapper takes exactly 100dvh and
   * the main content area becomes a flex column with overflow:hidden, so
   * descendants can use `flex-1 overflow-y-auto` to scroll a region
   * internally instead of scrolling the whole page. Used by the customer
   * Messages tab to deliver WhatsApp/Slack-style chat behavior (latest
   * message + input always visible, no page-scroll required). See
   * docs/tasks/strategy/messages-layout-viewport-lock.md.
   *
   * Defaults to false to preserve the existing scroll behavior for every
   * other tab and consumer.
   */
  fullHeight?: boolean;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  userRole = "customer",
  activeTab,
  activeSubTab,
  onTabChange,
  isSuperAdmin = false,
  adminRole = "",
  fullHeight = false,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  // Initialize notification system for all users
  // Admins need WebSocket for subscription status change events
  useNotifications({ enabled: true });

  // Close the mobile sidebar after navigating to a page or switching tabs.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname, activeTab]);

  // Track scroll position for header padding
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCollapseChange = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  // Render the appropriate sidebar based on user role
  const renderSidebar = () => {
    const commonProps = {
      isOpen: isSidebarOpen,
      onToggle: toggleSidebar,
      activeTab,
      onTabChange,
      onCollapseChange: handleCollapseChange,
    };

    switch (userRole) {
      case "admin":
        return (
          <AdminSidebar
            {...commonProps}
            activeSubTab={activeSubTab}
            isSuperAdmin={isSuperAdmin}
            adminRole={adminRole}
          />
        );
      case "shop":
        return <ShopSidebar {...commonProps} />;
      case "customer":
      default:
        return <CustomerSidebar {...commonProps} />;
    }
  };

  return (
    <div
      className={
        fullHeight
          ? "h-[100dvh] bg-[#101010] flex flex-col overflow-hidden"
          : "min-h-screen bg-[#101010]"
      }
    >
      {renderSidebar()}

      {/* Mobile header bar — hamburger only */}
      {/* z-20 ensures header stays above content but below icons */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-[#101010] flex items-center justify-between px-4 pt-4 pb-2 z-20">
        <button
          onClick={toggleSidebar}
          className={
            userRole === "shop"
              ? "p-2 rounded-full bg-[#1f1f1f] text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-colors"
              : "p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-colors"
          }
        >
          {isSidebarOpen ? (
            <X className={userRole === "shop" ? "w-5 h-5" : "w-6 h-6"} />
          ) : (
            <Menu className={userRole === "shop" ? "w-5 h-5" : "w-6 h-6"} />
          )}
        </button>
      </div>

      {/* Icons — rendered once, repositioned via responsive classes */}
      {/* Mobile: top-right inside header area | Desktop: fixed top-right */}
      {/* Floating top-right icons. For shops on desktop the icons live in the
          ShopBreadcrumb header bar, so this cluster is hidden there (lg:hidden)
          — except on the messages tab where the breadcrumb is hidden, so it
          stays visible as a fallback. Mobile always uses this floating cluster. */}
      {userRole !== "admin" && (
        <div className={`fixed right-4 z-[1001] flex items-center gap-3 pt-4 pb-2 lg:pt-2 transition-all duration-300 ease-in-out ${
          isScrolled ? "top-0 lg:top-0" : "top-0 lg:top-6"
        } ${activeTab !== "messages" ? "lg:hidden" : ""}`}>
          {userRole === "shop" && <CartIcon variant="subtle" />}
          <MessageIcon variant={userRole === "shop" ? "subtle" : "default"} />
          <NotificationBell variant={userRole === "shop" ? "subtle" : "default"} />
          {/* The Unified Assistant is the single AI "door" — the per-domain
              Insights / Marketing / Help launchers were retired into it
              (Help folded into the orchestrator's knowledge). The header mic
              is a quick voice trigger that opens this same assistant. */}
          {userRole === "shop" && <HeaderVoiceMic variant="subtle" />}
          {userRole === "shop" && <UnifiedAssistantLauncher variant="subtle" />}
        </div>
      )}

      {/* The ONE Unified Assistant panel — mounted exactly once here (shop only),
          decoupled from the trigger buttons. Every ✨ launcher / voice mic across
          the breadcrumb + floating clusters opens THIS single Sheet via the store,
          so there's never more than one panel (no double TTS / greeting race). */}
      {userRole === "shop" && <UnifiedAssistantHost />}

      {/* Voice AI Dispatcher Phase 4 — mobile bottom-nav mic. The
          component itself is lg:hidden, so this mount is a no-op on
          desktop. Shop-only mirrors the other voice surfaces. */}
      {userRole === "shop" && <MobileBottomNavMic />}

      {/* Main Content Area. In fullHeight mode, becomes a flex column that
          bounds children to the remaining viewport height — required for
          chat-style internal scroll. min-h-0 is the standard flex fix so
          children CAN shrink below their content height (without it the
          inner overflow-y-auto on the message list won't actually clip). */}
      <div className={`
        transition-all duration-300 ease-in-out
        pt-[76px] lg:pt-0
        ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}
        ${fullHeight ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""}
      `}>
        <main className={fullHeight ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;