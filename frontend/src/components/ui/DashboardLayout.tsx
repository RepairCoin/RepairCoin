"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "customer" | "shop" | "admin";
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  userRole = "customer" 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={toggleSidebar}
        userRole={userRole}
      />
      
      {/* Main Content Area */}
      <div className={`
        transition-all duration-300 ease-in-out
        lg:ml-64
      `}>
        <main>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;