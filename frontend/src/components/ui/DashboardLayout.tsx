"use client";

import React, { useState } from "react";
import { CustomerSidebar, ShopSidebar, AdminSidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageIcon } from "@/components/messaging/MessageIcon";
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

  // Initialize notification system for all users
  // Admins need WebSocket for subscription status change events
  useNotifications({ enabled: true });

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
    <div className="min-h-screen bg-[#1e1f22]">
      {renderSidebar()}

      {/* Message Icon & Notification Bell - Absolute Position (only for customers and shops) */}
      {/* z-[1001] ensures icons stay above Leaflet map layers (which use z-index 400-1000 internally) */}
      {userRole !== "admin" && (
        <div className={`fixed top-4 right-4 z-[1001] transition-all duration-300 ease-in-out flex items-center gap-2 ${
          isSidebarCollapsed ? "lg:right-4" : "lg:right-4"
        }`}>
          <MessageIcon />
          <NotificationBell />
        </div>
      )}

      {/* Main Content Area */}
      <div className={`
        transition-all duration-300 ease-in-out
        pt-14 lg:pt-0
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