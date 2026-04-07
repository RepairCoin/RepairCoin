"use client";

import React from "react";
import { Settings, Bell, Shield, Database, Mail } from "lucide-react";

export const AdminSettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-[#FFCC00]" />
          <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        </div>
        <p className="text-gray-400">
          Manage platform settings, notifications, and administrative preferences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236] hover:border-[#FFCC00] transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFCC00]/10 rounded-lg">
              <Settings className="w-6 h-6 text-[#FFCC00]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                General Settings
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Configure platform-wide settings and preferences
              </p>
              <p className="text-gray-500 text-xs italic">
                Coming soon...
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236] hover:border-[#FFCC00] transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFCC00]/10 rounded-lg">
              <Bell className="w-6 h-6 text-[#FFCC00]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Notifications
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Manage email and in-app notification preferences
              </p>
              <p className="text-gray-500 text-xs italic">
                Coming soon...
              </p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236] hover:border-[#FFCC00] transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFCC00]/10 rounded-lg">
              <Shield className="w-6 h-6 text-[#FFCC00]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Security & Access
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Configure security policies and access controls
              </p>
              <p className="text-gray-500 text-xs italic">
                Coming soon...
              </p>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236] hover:border-[#FFCC00] transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFCC00]/10 rounded-lg">
              <Database className="w-6 h-6 text-[#FFCC00]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                System Configuration
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Database, API, and system maintenance settings
              </p>
              <p className="text-gray-500 text-xs italic">
                Coming soon...
              </p>
            </div>
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236] hover:border-[#FFCC00] transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FFCC00]/10 rounded-lg">
              <Mail className="w-6 h-6 text-[#FFCC00]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Email Templates
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Customize email templates for various notifications
              </p>
              <p className="text-gray-500 text-xs italic">
                Coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Planned Features Section */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-[#FFCC00]" />
          <h2 className="text-xl font-semibold text-white">Planned Features</h2>
        </div>

        <div className="space-y-6">
          {/* General Settings Features */}
          <div>
            <h3 className="text-sm font-semibold text-[#FFCC00] mb-2">General Settings</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Platform name and branding customization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Default RCN reward rates and tier thresholds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Service booking default settings (cancellation policy, deposit amounts)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Timezone and localization settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Maintenance mode toggle</span>
              </li>
            </ul>
          </div>

          {/* Notification Settings Features */}
          <div>
            <h3 className="text-sm font-semibold text-[#FFCC00] mb-2">Notifications</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Admin email notification preferences (new shops, disputes, reports)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Configure notification delivery methods (email, in-app, SMS)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Notification frequency controls (instant, daily digest, weekly summary)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Alert thresholds (treasury balance, failed transactions, system errors)</span>
              </li>
            </ul>
          </div>

          {/* Security Settings Features */}
          <div>
            <h3 className="text-sm font-semibold text-[#FFCC00] mb-2">Security & Access</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Admin role permissions management (view-only, standard, super admin)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Session timeout configuration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>IP whitelist/blacklist for admin access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Two-factor authentication settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Audit log retention policies</span>
              </li>
            </ul>
          </div>

          {/* System Configuration Features */}
          <div>
            <h3 className="text-sm font-semibold text-[#FFCC00] mb-2">System Configuration</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>API rate limiting controls</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Database backup scheduling and retention</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>System health monitoring thresholds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Storage limits (images, documents, logs)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Blockchain connection settings (RPC endpoints, gas limits)</span>
              </li>
            </ul>
          </div>

          {/* Email Templates Features */}
          <div>
            <h3 className="text-sm font-semibold text-[#FFCC00] mb-2">Email Templates</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Customize welcome emails for customers and shops</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Booking confirmation and reminder email templates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Transaction receipt email formatting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Shop approval/rejection notification templates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFCC00] mt-1">•</span>
                <span>Support ticket response templates</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-1">
              Settings Coming Soon
            </h4>
            <p className="text-sm text-blue-300">
              Admin settings functionality is under development. These features will allow you to configure platform-wide settings, manage notification preferences, and customize system behavior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsTab;
