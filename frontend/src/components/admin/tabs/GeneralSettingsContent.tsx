"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  DollarSign,
  Users,
  Calendar,
  Globe,
  Shield,
} from "lucide-react";
import {
  getPlatformSettings,
  updatePlatformSettings,
  toggleMaintenanceMode,
  PlatformSettings,
} from "@/services/api/admin";
import { toast } from "react-hot-toast";

export const GeneralSettingsContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      console.log('[GeneralSettings] Loading settings...');
      const data = await getPlatformSettings();
      console.log('[GeneralSettings] Received data:', data);

      if (data) {
        console.log('[GeneralSettings] Settings loaded successfully:', data);
        setSettings(data);
      } else {
        console.error('[GeneralSettings] No data returned from API');
        toast.error("Failed to load settings - no data returned");
      }
    } catch (error) {
      console.error("[GeneralSettings] Error loading settings:", error);
      toast.error(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PlatformSettings, value: string | number | boolean) => {
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
      const result = await updatePlatformSettings(settings);
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

  const handleToggleMaintenanceMode = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const newValue = !settings.maintenanceMode;
      const result = await toggleMaintenanceMode(newValue, settings.maintenanceMessage);

      if (result.success) {
        toast.success(result.message || "Maintenance mode updated");
        await loadSettings();
      } else {
        toast.error(result.message || "Failed to toggle maintenance mode");
      }
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      toast.error("Error toggling maintenance mode");
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
              Unable to retrieve platform settings. Please try refreshing the page.
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
          <h2 className="text-xl font-semibold text-[#FFCC00]">General Settings</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure platform-wide settings and preferences
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

      {/* Platform Information */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Platform Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Platform Name
            </label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => handleInputChange("platformName", e.target.value)}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Support Email
            </label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => handleInputChange("supportEmail", e.target.value)}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Support Phone
            </label>
            <input
              type="tel"
              value={settings.supportPhone}
              onChange={(e) => handleInputChange("supportPhone", e.target.value)}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Platform Description
            </label>
            <textarea
              value={settings.platformDescription}
              onChange={(e) => handleInputChange("platformDescription", e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 resize-none"
            />
          </div>
        </div>
      </div>

      {/* RCN Rewards & Customer Tiers */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">RCN Rewards & Customer Tiers</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Default RCN Reward Rate
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.defaultRcnRewardRate}
              onChange={(e) => handleInputChange("defaultRcnRewardRate", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Base RCN earned per service</p>
          </div>
        </div>

        <div className="border-t border-[#303236] pt-4">
          <h4 className="text-sm font-semibold text-white mb-4">Tier Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bronze Tier */}
            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-yellow-600 mb-3">Bronze Tier</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Threshold (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.bronzeTierThreshold}
                    onChange={(e) => handleInputChange("bronzeTierThreshold", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Bonus (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.bronzeBonus}
                    onChange={(e) => handleInputChange("bronzeBonus", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
              </div>
            </div>

            {/* Silver Tier */}
            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-gray-300 mb-3">Silver Tier</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Threshold (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.silverTierThreshold}
                    onChange={(e) => handleInputChange("silverTierThreshold", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Bonus (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.silverBonus}
                    onChange={(e) => handleInputChange("silverBonus", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
              </div>
            </div>

            {/* Gold Tier */}
            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-[#FFCC00] mb-3">Gold Tier</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Threshold (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.goldTierThreshold}
                    onChange={(e) => handleInputChange("goldTierThreshold", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Bonus (RCN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.goldBonus}
                    onChange={(e) => handleInputChange("goldBonus", parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#303236] rounded text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Program */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Referral Program</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Referrer Reward (RCN)
            </label>
            <input
              type="number"
              min="0"
              value={settings.referrerReward}
              onChange={(e) => handleInputChange("referrerReward", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">RCN given to the person who refers</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Referee Reward (RCN)
            </label>
            <input
              type="number"
              min="0"
              value={settings.refereeReward}
              onChange={(e) => handleInputChange("refereeReward", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">RCN given to the new user</p>
          </div>
        </div>
      </div>

      {/* Booking Settings */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Booking Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Cancellation Window (hours)
            </label>
            <input
              type="number"
              min="0"
              value={settings.defaultCancellationWindow}
              onChange={(e) => handleInputChange("defaultCancellationWindow", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum hours before appointment to cancel</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Default Deposit (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.defaultDepositPercentage}
              onChange={(e) => handleInputChange("defaultDepositPercentage", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Default deposit percentage for bookings</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Max Advance Booking (days)
            </label>
            <input
              type="number"
              min="1"
              value={settings.maxAdvanceBookingDays}
              onChange={(e) => handleInputChange("maxAdvanceBookingDays", parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">How far in advance can customers book</p>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">System Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => handleInputChange("timezone", e.target.value)}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            >
              <option value="America/Toronto">America/Toronto (EST/EDT)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
              <option value="America/Denver">America/Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => handleInputChange("currency", e.target.value)}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Maintenance Mode</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${settings.maintenanceMode ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
              <div>
                <p className="text-sm font-medium text-white">
                  Maintenance Mode: {settings.maintenanceMode ? 'ENABLED' : 'DISABLED'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {settings.maintenanceMode
                    ? 'Platform is currently in maintenance mode'
                    : 'Platform is operational'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleMaintenanceMode}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.maintenanceMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {settings.maintenanceMode ? 'Disable' : 'Enable'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Maintenance Message
            </label>
            <textarea
              value={settings.maintenanceMessage}
              onChange={(e) => handleInputChange("maintenanceMessage", e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 resize-none"
              placeholder="Message displayed to users during maintenance"
            />
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
