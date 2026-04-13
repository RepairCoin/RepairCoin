"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Bell,
  Mail,
  Smartphone,
  Clock,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Users,
  FileText,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  NotificationSettings,
} from "@/services/api/admin";
import { toast } from "react-hot-toast";

export const NotificationSettingsContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      console.log('[NotificationSettings] Loading settings...');
      const data = await getNotificationSettings();
      console.log('[NotificationSettings] Received data:', data);

      if (data) {
        console.log('[NotificationSettings] Settings loaded successfully:', data);
        setSettings(data);
      } else {
        console.error('[NotificationSettings] No data returned from API');
        toast.error("Failed to load settings - no data returned");
      }
    } catch (error) {
      console.error("[NotificationSettings] Error loading settings:", error);
      toast.error(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = (field: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [field]: value,
    });
    setHasChanges(true);
  };

  const handleInputChange = (field: keyof NotificationSettings, value: string | number) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [field]: value,
    });
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const result = await updateNotificationSettings(settings);
      if (result.success) {
        toast.success(result.message || "Settings saved successfully");
        setHasChanges(false);
        await loadSettings(); // Reload to get updated metadata
      } else {
        toast.error(result.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm("Are you sure you want to discard all changes?")) {
      loadSettings();
      setHasChanges(false);
      toast.success("Changes discarded");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#FFCC00] animate-spin" />
        <span className="ml-3 text-gray-400">Loading settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-red-400 mb-1">
              Failed to Load Settings
            </h4>
            <p className="text-sm text-red-300">
              Unable to retrieve notification settings. Please try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#FFCC00]">Notification Settings</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure how and when you receive platform notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleResetSettings}
              disabled={saving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Discard Changes
            </button>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-300">
              You have unsaved changes. Click "Save Changes" to apply them.
            </p>
          </div>
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Email Notifications</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Choose which events trigger email notifications to your admin email address
        </p>

        <div className="space-y-4">
          {/* New Shops */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">New Shop Registrations</p>
                <p className="text-xs text-gray-400">When a new shop creates an account</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNewShops}
                onChange={(e) => handleToggleChange("emailNewShops", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Disputes */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-sm font-medium text-white">Disputes & Conflicts</p>
                <p className="text-xs text-gray-400">When customers or shops raise disputes</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailDisputes}
                onChange={(e) => handleToggleChange("emailDisputes", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Reports */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium text-white">Issue Reports</p>
                <p className="text-xs text-gray-400">When shops submit issue reports to admins</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailReports}
                onChange={(e) => handleToggleChange("emailReports", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Low Treasury */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">Low Treasury Balance</p>
                <p className="text-xs text-gray-400">When treasury balance falls below threshold</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailLowTreasury}
                onChange={(e) => handleToggleChange("emailLowTreasury", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Failed Transactions */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">Failed Transactions</p>
                <p className="text-xs text-gray-400">When transaction failures exceed threshold</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailFailedTransactions}
                onChange={(e) => handleToggleChange("emailFailedTransactions", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* System Errors */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">System Errors</p>
                <p className="text-xs text-gray-400">When system errors exceed threshold</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailSystemErrors}
                onChange={(e) => handleToggleChange("emailSystemErrors", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">In-App Notifications</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Configure which events show notifications in the admin dashboard
        </p>

        <div className="space-y-4">
          {/* New Shops */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">New Shop Registrations</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppNewShops}
                onChange={(e) => handleToggleChange("inAppNewShops", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Disputes */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-sm font-medium text-white">Disputes & Conflicts</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppDisputes}
                onChange={(e) => handleToggleChange("inAppDisputes", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Reports */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium text-white">Issue Reports</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppReports}
                onChange={(e) => handleToggleChange("inAppReports", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Low Treasury */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">Low Treasury Balance</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppLowTreasury}
                onChange={(e) => handleToggleChange("inAppLowTreasury", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* Failed Transactions */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">Failed Transactions</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppFailedTransactions}
                onChange={(e) => handleToggleChange("inAppFailedTransactions", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          {/* System Errors */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">System Errors</p>
                <p className="text-xs text-gray-400">Show in-app notification badge</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppSystemErrors}
                onChange={(e) => handleToggleChange("inAppSystemErrors", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Notification Frequency */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Notification Frequency</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Choose how often you receive notification digests
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Instant */}
          <div
            onClick={() => handleInputChange("notificationFrequency", "instant")}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
              settings.notificationFrequency === "instant"
                ? "border-[#FFCC00] bg-[#FFCC00]/10"
                : "border-[#303236] bg-[#101010] hover:border-[#FFCC00]/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Bell className={`w-5 h-5 ${settings.notificationFrequency === "instant" ? "text-[#FFCC00]" : "text-gray-400"}`} />
              <p className={`text-sm font-semibold ${settings.notificationFrequency === "instant" ? "text-[#FFCC00]" : "text-white"}`}>
                Instant
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Receive notifications immediately as events occur
            </p>
          </div>

          {/* Daily */}
          <div
            onClick={() => handleInputChange("notificationFrequency", "daily")}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
              settings.notificationFrequency === "daily"
                ? "border-[#FFCC00] bg-[#FFCC00]/10"
                : "border-[#303236] bg-[#101010] hover:border-[#FFCC00]/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Bell className={`w-5 h-5 ${settings.notificationFrequency === "daily" ? "text-[#FFCC00]" : "text-gray-400"}`} />
              <p className={`text-sm font-semibold ${settings.notificationFrequency === "daily" ? "text-[#FFCC00]" : "text-white"}`}>
                Daily Digest
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Receive a summary once per day
            </p>
          </div>

          {/* Weekly */}
          <div
            onClick={() => handleInputChange("notificationFrequency", "weekly")}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
              settings.notificationFrequency === "weekly"
                ? "border-[#FFCC00] bg-[#FFCC00]/10"
                : "border-[#303236] bg-[#101010] hover:border-[#FFCC00]/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Bell className={`w-5 h-5 ${settings.notificationFrequency === "weekly" ? "text-[#FFCC00]" : "text-gray-400"}`} />
              <p className={`text-sm font-semibold ${settings.notificationFrequency === "weekly" ? "text-[#FFCC00]" : "text-white"}`}>
                Weekly Digest
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Receive a summary once per week
            </p>
          </div>
        </div>

        {/* Digest Time (only show for daily/weekly) */}
        {(settings.notificationFrequency === "daily" || settings.notificationFrequency === "weekly") && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Digest Delivery Time
            </label>
            <input
              type="time"
              value={settings.digestTime}
              onChange={(e) => handleInputChange("digestTime", e.target.value)}
              className="w-full md:w-64 px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Time when digest emails are sent (24-hour format)</p>
          </div>
        )}
      </div>

      {/* Alert Thresholds */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Alert Thresholds</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Set thresholds for automated alerts
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Treasury Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Treasury Balance (USD)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={settings.treasuryBalanceThreshold}
              onChange={(e) => handleInputChange("treasuryBalanceThreshold", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Alert when treasury falls below this amount</p>
          </div>

          {/* Failed Transactions */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Failed Transactions (per hour)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.failedTransactionThreshold}
              onChange={(e) => handleInputChange("failedTransactionThreshold", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Alert when failures exceed this count</p>
          </div>

          {/* System Errors */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              System Errors (per hour)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.systemErrorThreshold}
              onChange={(e) => handleInputChange("systemErrorThreshold", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Alert when errors exceed this count</p>
          </div>
        </div>
      </div>

      {/* Settings Metadata */}
      {settings.lastModified && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-300">
              <p>
                Last modified: {new Date(settings.lastModified).toLocaleString()}
                {settings.modifiedBy && ` by ${settings.modifiedBy}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
