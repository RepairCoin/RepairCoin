"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Zap,
  Database,
  Activity,
  HardDrive,
  Link,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getSystemSettings,
  updateSystemSettings,
  SystemSettings,
} from "@/services/api/admin";

// Tooltip component
const Tooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block ml-1">
      <Info
        className="w-4 h-4 text-gray-400 hover:text-[#FFCC00] cursor-help inline"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div className="absolute z-50 left-0 top-6 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-xs text-gray-300 leading-relaxed">
          {text}
          <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export const SystemConfigurationContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newBypassIp, setNewBypassIp] = useState("");
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      console.log("[SystemConfiguration] Loading settings...");
      const data = await getSystemSettings();
      console.log("[SystemConfiguration] Received data:", data);

      if (data) {
        console.log("[SystemConfiguration] Settings loaded successfully:", data);
        setSettings(data);
      } else {
        console.error("[SystemConfiguration] No data returned from API");
        toast.error("Failed to load settings - no data returned");
      }
    } catch (error) {
      console.error("[SystemConfiguration] Error loading settings:", error);
      toast.error(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: string | number | boolean | string[]) => {
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
      const result = await updateSystemSettings(settings);
      if (result.success) {
        toast.success(result.message || "Settings saved successfully");
        setHasChanges(false);
        await loadSettings();
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

  const handleAddBypassIp = () => {
    if (!settings) return;

    if (!newBypassIp.trim()) {
      toast.error("Please enter an IP address");
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newBypassIp.trim())) {
      toast.error("Invalid IP address format");
      return;
    }

    const currentList = settings.rateLimitBypassIps || [];

    if (currentList.includes(newBypassIp.trim())) {
      toast.error("IP address already exists in the bypass list");
      return;
    }

    setSettings({
      ...settings,
      rateLimitBypassIps: [...currentList, newBypassIp.trim()],
    });
    setNewBypassIp("");
    setHasChanges(true);
    toast.success("IP address added to bypass list");
  };

  const handleRemoveBypassIp = (ip: string) => {
    if (!settings) return;

    const currentList = settings.rateLimitBypassIps || [];

    setSettings({
      ...settings,
      rateLimitBypassIps: currentList.filter((item) => item !== ip),
    });
    setHasChanges(true);
    toast.success("IP address removed from bypass list");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#FFCC00] animate-spin" />
        <span className="ml-3 text-gray-400">Loading system configuration...</span>
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
              Unable to retrieve system configuration. Please try refreshing the page.
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
          <h2 className="text-xl font-semibold text-[#FFCC00]">System Configuration</h2>
          <p className="text-sm text-gray-400 mt-1">
            Database, API, and system maintenance settings
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

      {/* API Rate Limiting */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            API Rate Limiting
            <Tooltip text="Rate limiting prevents API abuse by limiting how many requests can be made in a time window. This protects your server from being overwhelmed." />
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">
                Enable Rate Limiting
                <Tooltip text="When enabled, API requests will be limited based on the settings below. Disable only during testing or maintenance." />
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Protect API from excessive requests
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableRateLimiting}
                onChange={(e) => handleInputChange("enableRateLimiting", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Time Window (milliseconds)
                <Tooltip text="The time period for counting requests. 60000ms = 1 minute. Shorter windows are stricter." />
              </label>
              <input
                type="number"
                min="1000"
                max="3600000"
                step="1000"
                value={settings.rateLimitWindowMs}
                onChange={(e) => handleInputChange("rateLimitWindowMs", parseInt(e.target.value))}
                disabled={!settings.enableRateLimiting}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">{(settings.rateLimitWindowMs / 1000).toFixed(0)} seconds</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Requests
                <Tooltip text="Maximum number of requests allowed within the time window. Lower numbers are more restrictive." />
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={settings.rateLimitMaxRequests}
                onChange={(e) => handleInputChange("rateLimitMaxRequests", parseInt(e.target.value))}
                disabled={!settings.enableRateLimiting}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Per time window</p>
            </div>
          </div>

          {/* Bypass IPs */}
          <div className="border-t border-[#303236] pt-4">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter IP address to bypass rate limiting (e.g., 192.168.1.1)"
                value={newBypassIp}
                onChange={(e) => setNewBypassIp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBypassIp()}
                disabled={!settings.enableRateLimiting}
                className="flex-1 px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] disabled:opacity-50"
              />
              <button
                onClick={handleAddBypassIp}
                disabled={!settings.enableRateLimiting}
                className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Bypass IPs ({settings.rateLimitBypassIps?.length || 0})
                <Tooltip text="These IP addresses will not be subject to rate limiting. Use for trusted services or internal servers." />
              </h4>
              <div className="bg-[#101010] rounded-lg border border-[#303236] p-3 min-h-[120px] max-h-[200px] overflow-y-auto">
                {!settings.rateLimitBypassIps || settings.rateLimitBypassIps.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">No bypass IPs configured</p>
                ) : (
                  <div className="space-y-2">
                    {settings.rateLimitBypassIps.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded border border-[#303236]"
                      >
                        <span className="text-sm text-white font-mono">{ip}</span>
                        <button
                          onClick={() => handleRemoveBypassIp(ip)}
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

      {/* Database Backup */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            Database Backup
            <Tooltip text="Automated backups ensure you can recover data in case of system failure or data corruption. Regular backups are critical for business continuity." />
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">
                Enable Automatic Backups
                <Tooltip text="When enabled, the database will be backed up automatically according to the schedule below." />
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Schedule regular database backups
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableAutoBackup}
                onChange={(e) => handleInputChange("enableAutoBackup", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Backup Frequency
                <Tooltip text="How often backups should run. More frequent = more up-to-date recovery points but more storage usage." />
              </label>
              <select
                value={settings.backupFrequency}
                onChange={(e) => handleInputChange("backupFrequency", e.target.value as SystemSettings["backupFrequency"])}
                disabled={!settings.enableAutoBackup}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              >
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Retention Period (days)
                <Tooltip text="How long to keep old backups before deleting them. Longer retention requires more storage space." />
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.backupRetentionDays}
                onChange={(e) => handleInputChange("backupRetentionDays", parseInt(e.target.value))}
                disabled={!settings.enableAutoBackup}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Days to keep backups</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Backup Time
                <Tooltip text="For daily/weekly backups, when should they run? Choose a low-traffic time to minimize performance impact." />
              </label>
              <input
                type="time"
                value={settings.backupTime}
                onChange={(e) => handleInputChange("backupTime", e.target.value)}
                disabled={!settings.enableAutoBackup || settings.backupFrequency === 'hourly'}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">24-hour format</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Health Monitoring */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            System Health Monitoring
            <Tooltip text="Monitor server resources (CPU, memory, disk) and get alerted when thresholds are exceeded. Helps prevent outages before they happen." />
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div>
              <p className="text-sm font-medium text-white">
                Enable Health Monitoring
                <Tooltip text="When enabled, system resources will be checked regularly and alerts sent if thresholds are exceeded." />
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Monitor system resources and performance
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableHealthMonitoring}
                onChange={(e) => handleInputChange("enableHealthMonitoring", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Check Interval (minutes)
                <Tooltip text="How often to check system health. More frequent checks catch issues faster but use more resources." />
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.healthCheckInterval}
                onChange={(e) => handleInputChange("healthCheckInterval", parseInt(e.target.value))}
                disabled={!settings.enableHealthMonitoring}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Minutes between checks</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                CPU Threshold (%)
                <Tooltip text="Alert when CPU usage exceeds this percentage. Typical warning level is 80-90%." />
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.cpuThreshold}
                onChange={(e) => handleInputChange("cpuThreshold", parseInt(e.target.value))}
                disabled={!settings.enableHealthMonitoring}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Alert above this percentage</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Memory Threshold (%)
                <Tooltip text="Alert when memory usage exceeds this percentage. Typical warning level is 80-90%." />
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.memoryThreshold}
                onChange={(e) => handleInputChange("memoryThreshold", parseInt(e.target.value))}
                disabled={!settings.enableHealthMonitoring}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Alert above this percentage</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Disk Threshold (%)
                <Tooltip text="Alert when disk usage exceeds this percentage. Typical warning level is 85-90%." />
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.diskThreshold}
                onChange={(e) => handleInputChange("diskThreshold", parseInt(e.target.value))}
                disabled={!settings.enableHealthMonitoring}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Alert above this percentage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Limits */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            Storage Limits
            <Tooltip text="Control maximum file sizes for uploads to prevent abuse and manage storage costs. Files exceeding these limits will be rejected." />
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Max Image Size (MB)
              <Tooltip text="Maximum size for image uploads (shop photos, service images, etc.). Larger sizes allow better quality but use more storage and bandwidth." />
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={settings.maxImageSize}
              onChange={(e) => handleInputChange("maxImageSize", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Megabytes per image</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Max Document Size (MB)
              <Tooltip text="Maximum size for document uploads (PDFs, receipts, reports). Larger sizes accommodate more detailed documents but use more storage." />
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxDocumentSize}
              onChange={(e) => handleInputChange("maxDocumentSize", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Megabytes per document</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Max Log File Size (MB)
              <Tooltip text="Maximum size for individual log files before rotation. Larger files mean less frequent rotation but slower to search through." />
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxLogSize}
              onChange={(e) => handleInputChange("maxLogSize", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Megabytes per log file</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Total Storage Limit (GB)
              <Tooltip text="Overall storage limit for the entire platform. When reached, new uploads will be blocked until space is freed." />
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={settings.totalStorageLimit}
              onChange={(e) => handleInputChange("totalStorageLimit", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Gigabytes total</p>
          </div>
        </div>
      </div>

      {/* Blockchain Connection Settings */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <Link className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            Blockchain Connection
            <Tooltip text="Configure how the platform connects to the blockchain network. RPC endpoints are used for all blockchain operations (token transfers, minting, etc.)." />
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Primary RPC Endpoint
              <Tooltip text="The main blockchain RPC endpoint URL. This is used for all blockchain operations. Example: https://base-sepolia.g.alchemy.com/v2/YOUR-API-KEY" />
            </label>
            <input
              type="url"
              value={settings.rpcEndpoint}
              onChange={(e) => handleInputChange("rpcEndpoint", e.target.value)}
              placeholder="https://base-sepolia.g.alchemy.com/v2/YOUR-API-KEY"
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Primary endpoint for blockchain operations</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Backup RPC Endpoint
              <Tooltip text="Fallback endpoint used if the primary fails. Having a backup ensures continuous service even if one provider has issues." />
            </label>
            <input
              type="url"
              value={settings.rpcBackupEndpoint}
              onChange={(e) => handleInputChange("rpcBackupEndpoint", e.target.value)}
              placeholder="https://base-sepolia.infura.io/v3/YOUR-API-KEY"
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Failover endpoint for redundancy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Gas Limit
                <Tooltip text="Maximum gas allowed per transaction. Higher values allow more complex operations but cost more. Default: 500000" />
              </label>
              <input
                type="number"
                min="21000"
                max="10000000"
                value={settings.gasLimit}
                onChange={(e) => handleInputChange("gasLimit", parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-1">Gas units</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Gas Price (gwei)
                <Tooltip text="Maximum gas price to pay for transactions. Transactions exceeding this will fail. Protects against unexpected high gas costs." />
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={settings.maxGasPrice}
                onChange={(e) => handleInputChange("maxGasPrice", parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-1">Gwei (1 gwei = 0.000000001 ETH)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Block Confirmations
                <Tooltip text="Number of blocks to wait before considering a transaction final. More confirmations = more secure but slower. Typical: 1-6 blocks." />
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.blockConfirmations}
                onChange={(e) => handleInputChange("blockConfirmations", parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-1">Blocks to wait</p>
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
