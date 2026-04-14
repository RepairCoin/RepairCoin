"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Users,
  Key,
  FileText,
  Clock,
  Globe,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getSecuritySettings,
  updateSecuritySettings,
  SecuritySettings,
} from "@/services/api/admin";

export const SecuritySettingsContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const [ipListType, setIpListType] = useState<"whitelist" | "blacklist">("whitelist");
  const [settings, setSettings] = useState<SecuritySettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      console.log("[SecuritySettings] Loading settings...");
      const data = await getSecuritySettings();
      console.log("[SecuritySettings] Received data:", data);

      if (data) {
        console.log("[SecuritySettings] Settings loaded successfully:", data);
        setSettings(data);
      } else {
        console.error("[SecuritySettings] No data returned from API");
        toast.error("Failed to load settings - no data returned");
      }
    } catch (error) {
      console.error("[SecuritySettings] Error loading settings:", error);
      toast.error(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SecuritySettings, value: string | number | boolean | string[]) => {
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
      const result = await updateSecuritySettings(settings);
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

  const handleAddIpAddress = () => {
    if (!settings) return;

    if (!newIpAddress.trim()) {
      toast.error("Please enter an IP address");
      return;
    }

    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIpAddress.trim())) {
      toast.error("Invalid IP address format");
      return;
    }

    const listKey = ipListType === "whitelist" ? "ipWhitelist" : "ipBlacklist";
    const currentList = settings[listKey];

    if (currentList.includes(newIpAddress.trim())) {
      toast.error("IP address already exists in the list");
      return;
    }

    setSettings({
      ...settings,
      [listKey]: [...currentList, newIpAddress.trim()],
    });
    setNewIpAddress("");
    setHasChanges(true);
    toast.success(`IP address added to ${ipListType}`);
  };

  const handleRemoveIpAddress = (ip: string, type: "whitelist" | "blacklist") => {
    if (!settings) return;

    const listKey = type === "whitelist" ? "ipWhitelist" : "ipBlacklist";
    setSettings({
      ...settings,
      [listKey]: settings[listKey].filter((item) => item !== ip),
    });
    setHasChanges(true);
    toast.success(`IP address removed from ${type}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#FFCC00] animate-spin" />
        <span className="ml-3 text-gray-400">Loading security settings...</span>
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
              Unable to retrieve security settings. Please try refreshing the page.
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
          <h2 className="text-xl font-semibold text-[#FFCC00]">Security & Access</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure security policies and access controls
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
              You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
            </p>
          </div>
        </div>
      )}

      {/* Admin Role Permissions */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Admin Role Permissions</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">Enable Role-Based Permissions</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Control what different admin roles can access
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableRolePermissions}
                onChange={(e) => handleInputChange("enableRolePermissions", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Default Role for New Admins
            </label>
            <select
              value={settings.defaultRole}
              onChange={(e) => handleInputChange("defaultRole", e.target.value as SecuritySettings['defaultRole'])}
              disabled={!settings.enableRolePermissions}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
            >
              <option value="view-only">View Only</option>
              <option value="standard">Standard Admin</option>
              <option value="super-admin">Super Admin</option>
            </select>
          </div>

          {/* Role Permissions Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-yellow-600 mb-2">View Only</h5>
              <p className="text-xs text-gray-400 mb-3">Can only view data, no modifications</p>
              <div className="space-y-1">
                {settings.viewOnlyPermissions.slice(0, 3).map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{perm.replace(/_/g, " ")}</span>
                  </div>
                ))}
                {settings.viewOnlyPermissions.length > 3 && (
                  <p className="text-xs text-gray-500">+{settings.viewOnlyPermissions.length - 3} more</p>
                )}
              </div>
            </div>

            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-blue-400 mb-2">Standard Admin</h5>
              <p className="text-xs text-gray-400 mb-3">Can manage shops and customers</p>
              <div className="space-y-1">
                {settings.standardPermissions.slice(0, 3).map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{perm.replace(/_/g, " ")}</span>
                  </div>
                ))}
                {settings.standardPermissions.length > 3 && (
                  <p className="text-xs text-gray-500">+{settings.standardPermissions.length - 3} more</p>
                )}
              </div>
            </div>

            <div className="bg-[#101010] rounded-lg p-4 border border-[#303236]">
              <h5 className="text-sm font-semibold text-[#FFCC00] mb-2">Super Admin</h5>
              <p className="text-xs text-gray-400 mb-3">Full system access and control</p>
              <div className="space-y-1">
                {settings.superAdminPermissions.slice(0, 3).map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{perm.replace(/_/g, " ")}</span>
                  </div>
                ))}
                {settings.superAdminPermissions.length > 3 && (
                  <p className="text-xs text-gray-500">+{settings.superAdminPermissions.length - 3} more</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Session Management</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={settings.sessionTimeout}
              onChange={(e) => handleInputChange("sessionTimeout", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Auto logout after inactivity</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Max Concurrent Sessions
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.maxConcurrentSessions}
              onChange={(e) => handleInputChange("maxConcurrentSessions", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Number of simultaneous logins allowed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Remember Me Duration (days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.rememberMeDuration}
              onChange={(e) => handleInputChange("rememberMeDuration", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">How long &quot;Remember Me&quot; lasts</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">Auto Logout on Timeout</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Automatically logout inactive users
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoLogoutEnabled}
                onChange={(e) => handleInputChange("autoLogoutEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* IP Access Control */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">IP Access Control</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
              <div>
                <p className="text-sm font-medium text-white">Enable IP Whitelist</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Only allow specific IP addresses
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableIpWhitelist}
                  onChange={(e) => handleInputChange("enableIpWhitelist", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
              <div>
                <p className="text-sm font-medium text-white">Enable IP Blacklist</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Block specific IP addresses
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableIpBlacklist}
                  onChange={(e) => handleInputChange("enableIpBlacklist", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </label>
            </div>
          </div>

          {/* Add IP Address */}
          <div className="border-t border-[#303236] pt-4">
            <div className="flex gap-2 mb-4">
              <select
                value={ipListType}
                onChange={(e) => setIpListType(e.target.value as "whitelist" | "blacklist")}
                className="px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              >
                <option value="whitelist">Whitelist</option>
                <option value="blacklist">Blacklist</option>
              </select>
              <input
                type="text"
                placeholder="Enter IP address (e.g., 192.168.1.1)"
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddIpAddress()}
                className="flex-1 px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              />
              <button
                onClick={handleAddIpAddress}
                className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* IP Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Whitelist */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">
                  Whitelisted IPs ({settings.ipWhitelist.length})
                </h4>
                <div className="bg-[#101010] rounded-lg border border-[#303236] p-3 min-h-[120px] max-h-[200px] overflow-y-auto">
                  {settings.ipWhitelist.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No whitelisted IPs</p>
                  ) : (
                    <div className="space-y-2">
                      {settings.ipWhitelist.map((ip) => (
                        <div
                          key={ip}
                          className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded border border-[#303236]"
                        >
                          <span className="text-sm text-white font-mono">{ip}</span>
                          <button
                            onClick={() => handleRemoveIpAddress(ip, "whitelist")}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Blacklist */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">
                  Blacklisted IPs ({settings.ipBlacklist.length})
                </h4>
                <div className="bg-[#101010] rounded-lg border border-[#303236] p-3 min-h-[120px] max-h-[200px] overflow-y-auto">
                  {settings.ipBlacklist.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No blacklisted IPs</p>
                  ) : (
                    <div className="space-y-2">
                      {settings.ipBlacklist.map((ip) => (
                        <div
                          key={ip}
                          className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded border border-[#303236]"
                        >
                          <span className="text-sm text-white font-mono">{ip}</span>
                          <button
                            onClick={() => handleRemoveIpAddress(ip, "blacklist")}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Two-Factor Authentication</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">Require 2FA for All Admins</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Enforce two-factor authentication for all admin accounts
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require2FA}
                onChange={(e) => handleInputChange("require2FA", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">Allow 2FA Opt-Out</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Let admins choose to disable 2FA (not recommended)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow2FAOptOut}
                onChange={(e) => handleInputChange("allow2FAOptOut", e.target.checked)}
                disabled={settings.require2FA}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00] disabled:opacity-50"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Default 2FA Method
            </label>
            <select
              value={settings.twoFactorMethod}
              onChange={(e) => handleInputChange("twoFactorMethod", e.target.value as SecuritySettings["twoFactorMethod"])}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            >
              <option value="authenticator">Authenticator App (Google Authenticator, Authy)</option>
              <option value="sms">SMS Text Message</option>
              <option value="email">Email Verification</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Retention */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Audit Log Retention</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Retention Period (days)
            </label>
            <input
              type="number"
              min="7"
              max="3650"
              value={settings.auditLogRetention}
              onChange={(e) => handleInputChange("auditLogRetention", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">How long to keep audit logs before deletion</p>
          </div>

          <div className="border-t border-[#303236] pt-4">
            <h4 className="text-sm font-semibold text-white mb-3">Log Activity Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#303236]">
                <span className="text-sm text-white">Login Attempts</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.logLoginAttempts}
                    onChange={(e) => handleInputChange("logLoginAttempts", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#303236]">
                <span className="text-sm text-white">Settings Changes</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.logSettingsChanges}
                    onChange={(e) => handleInputChange("logSettingsChanges", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#303236]">
                <span className="text-sm text-white">Financial Transactions</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.logFinancialTransactions}
                    onChange={(e) => handleInputChange("logFinancialTransactions", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#303236]">
                <span className="text-sm text-white">Admin Actions</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.logAdminActions}
                    onChange={(e) => handleInputChange("logAdminActions", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
                </label>
              </div>
            </div>
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
