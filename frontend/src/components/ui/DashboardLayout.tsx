"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "customer" | "shop" | "admin";
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isSuperAdmin?: boolean;
  adminPermissions?: string[];
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  userRole = "customer",
  activeTab,
  onTabChange,
  isSuperAdmin = false,
  adminPermissions = []
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCollapseChange = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={toggleSidebar}
        userRole={userRole}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCollapseChange={handleCollapseChange}
        isSuperAdmin={isSuperAdmin}
        adminPermissions={adminPermissions}
      />
      
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