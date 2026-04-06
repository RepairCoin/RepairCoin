"use client";

import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { CustomerSidebar, ShopSidebar, AdminSidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageIcon } from "@/components/messaging/MessageIcon";
import { CartIcon } from "@/components/ui/CartIcon";
import { useNotifications } from "@/hooks/useNotifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  activeSubTab?: string;
  onTabChange?: (tab: string) => void;
  isSuperAdmin?: boolean;
  adminRole?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  userRole = "customer",
  activeTab,
  activeSubTab,
  onTabChange,
  isSuperAdmin = false,
  adminRole = ""
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Initialize notification system for all users
  // Admins need WebSocket for subscription status change events
  useNotifications({ enabled: true });

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
    <div className="min-h-screen bg-[#101010]">
      {renderSidebar()}

      {/* Mobile header bar — hamburger only */}
      {/* z-20 ensures header stays above content but below icons */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 bg-[#1e1f22] flex items-center justify-between px-4 transition-all duration-300 ease-in-out pt-2 pb-2 z-20 ${
        isScrolled ? "top-0" : "top-8"
      }`}>
        <button
          onClick={toggleSidebar}
          className="p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-colors"
        >
          {isSidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Icons — rendered once, repositioned via responsive classes */}
      {/* Mobile: top-right inside header area | Desktop: fixed top-right */}
      {userRole !== "admin" && (
        <div className={`fixed right-4 z-[1001] flex items-center gap-3 pt-2 pb-2 transition-all duration-300 ease-in-out ${
          isScrolled ? "top-0 lg:top-0" : "top-8 lg:top-6"
        }`}>
          {userRole === "shop" && <CartIcon />}
          <MessageIcon />
          <NotificationBell />
        </div>
      )}

      {/* Main Content Area */}
      <div className={`
        transition-all duration-300 ease-in-out
        pt-[76px] lg:pt-0
        ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}
      `}>
        <main>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;