"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
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

  // Initialize notification system
  useNotifications();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCollapseChange = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        userRole={userRole}
        activeTab={activeTab}
        activeSubTab={activeSubTab}
        onTabChange={onTabChange}
        onCollapseChange={handleCollapseChange}
        isSuperAdmin={isSuperAdmin}
        adminRole={adminRole}
      />

      {/* Notification Bell - Absolute Position */}
      <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? "lg:right-4" : "lg:right-4"
      }`}>
        <NotificationBell />
      </div>

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