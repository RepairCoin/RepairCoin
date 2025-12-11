"use client";

import React, { useState } from "react";
import { CustomerSidebar, ShopSidebar, AdminSidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
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

  // Initialize notification system (only for customers and shops, not admins)
  useNotifications({ enabled: userRole !== "admin" });

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
    <div className="min-h-screen bg-[#0D0D0D]">
      {renderSidebar()}

      {/* Notification Bell - Absolute Position (only for customers and shops) */}
      {userRole !== "admin" && (
        <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:right-4" : "lg:right-4"
        }`}>
          <NotificationBell />
        </div>
      )}

      {/* Main Content Area */}
      <div className={`
        transition-all duration-300 ease-in-out
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