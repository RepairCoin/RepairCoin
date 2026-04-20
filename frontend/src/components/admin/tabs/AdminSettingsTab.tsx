"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Bell,
  Shield,
  Database,
  Mail,
} from "lucide-react";
import { GeneralSettingsContent } from "./GeneralSettingsContent";
import { NotificationSettingsContent } from "./NotificationSettingsContent";
import { SecuritySettingsContent } from "./SecuritySettingsContent";
import { SystemConfigurationContent } from "./SystemConfigurationContent";
import { EmailTemplatesContent } from "./EmailTemplatesContent";

export const AdminSettingsTab: React.FC = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    | "general"
    | "notifications"
    | "security"
    | "system"
    | "email-templates"
  >("general");

  // Handle section parameter from URL
  useEffect(() => {
    const section = searchParams?.get('section');
    if (section && (
      section === "general" ||
      section === "notifications" ||
      section === "security" ||
      section === "system" ||
      section === "email-templates"
    )) {
      setActiveTab(section as typeof activeTab);
    }
  }, [searchParams]);

  // Tab menu items configuration
  const mainTabs = [
    { id: "general" as const, label: "General Settings", icon: Settings },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
  ];

  const accessTabs = [
    { id: "security" as const, label: "Security & Access", icon: Shield },
    { id: "system" as const, label: "System Configuration", icon: Database },
    { id: "email-templates" as const, label: "Email Templates", icon: Mail },
  ];

  return (
    <div className="bg-[#101010] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white border-b border-[#303236]">
        <p className="text-base sm:text-lg md:text-xl text-[#FFCC00] font-semibold">
          <Settings className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
          Admin Settings
        </p>
      </div>

      {/* Main Content - Sidebar + Content */}
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 xl:w-72 border-b lg:border-b-0 lg:border-r border-[#303236] p-4">
          {/* Main Tabs */}
          <nav className="space-y-1">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-[#FFCC00] text-black"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Access Section */}
          <div className="mt-6">
            <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Access
            </p>
            <nav className="space-y-1 mt-1">
              {accessTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[#FFCC00] text-black"
                      : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* General Settings Tab Content */}
          {activeTab === "general" && <GeneralSettingsContent />}

          {/* Notifications Tab Content */}
          {activeTab === "notifications" && <NotificationSettingsContent />}

          {/* Security & Access Tab Content */}
          {activeTab === "security" && <SecuritySettingsContent />}

          {/* System Configuration Tab Content */}
          {activeTab === "system" && <SystemConfigurationContent />}

          {/* Email Templates Tab Content */}
          {activeTab === "email-templates" && <EmailTemplatesContent />}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsTab;
