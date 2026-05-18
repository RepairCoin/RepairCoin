"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type {
  LowStockAlertSettings,
  LowStockItem,
  LowStockAlertResult,
} from "@/types/inventory";
import { toast } from "react-hot-toast";
import {
  Bell,
  BellOff,
  Mail,
  Calendar,
  AlertTriangle,
  Package,
  Play,
  CheckCircle,
  X,
  Clock,
  CalendarDays,
  Info,
} from "lucide-react";

interface LowStockAlertsTabProps {
  shopId: string;
}

export function LowStockAlertsTab({ shopId }: LowStockAlertsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [settings, setSettings] = useState<LowStockAlertSettings>({
    enabled: true,
    email: "",
    frequency: "daily",
    digestMode: "daily",
    digestDayOfWeek: 1,
    digestDayOfMonth: 1,
    digestTime: "09:00",
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [lastCheckResult, setLastCheckResult] = useState<LowStockAlertResult | null>(null);

  useEffect(() => {
    loadData();
  }, [shopId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, itemsData] = await Promise.all([
        inventoryApi.getAlertSettings(shopId),
        inventoryApi.getLowStockItems(shopId),
      ]);
      setSettings(settingsData);
      setLowStockItems(itemsData);
    } catch (error) {
      console.error("Error loading alert data:", error);
      toast.error("Failed to load alert settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (settings.enabled && !settings.email) {
      toast.error("Please provide an email address for alerts");
      return;
    }

    try {
      setSaving(true);
      const updated = await inventoryApi.updateAlertSettings(shopId, settings);
      setSettings(updated);
      toast.success("Alert settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save alert settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCheck = async () => {
    try {
      setTriggering(true);
      const result = await inventoryApi.triggerAlertCheck(shopId);
      setLastCheckResult(result);

      if (result.emailSent) {
        toast.success(`Alert sent! ${result.itemsCount} items were reported.`);
      } else {
        toast.info(`Check completed. ${result.itemsCount} low stock items found, but no email was sent (cooldown period or no alert needed).`);
      }

      // Reload items
      const itemsData = await inventoryApi.getLowStockItems(shopId);
      setLowStockItems(itemsData);
    } catch (error) {
      console.error("Error triggering alert check:", error);
      toast.error("Failed to trigger alert check");
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Low Stock Alerts</h2>
        <p className="text-sm text-gray-600 mt-1">
          Get notified when inventory items reach low stock thresholds
        </p>
      </div>

      {/* Alert Status Banner */}
      <div
        className={`rounded-lg p-4 flex items-center gap-3 ${
          settings.enabled ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
        }`}
      >
        {settings.enabled ? (
          <>
            <Bell className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-900">Alerts are enabled</p>
              <p className="text-sm text-green-700">
                {settings.digestMode === "immediate"
                  ? "You'll receive immediate notifications when items are low on stock"
                  : settings.digestMode === "daily"
                  ? `Daily digest at ${settings.digestTime || "09:00"}`
                  : settings.digestMode === "weekly"
                  ? `Weekly digest on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][settings.digestDayOfWeek || 1]} at ${settings.digestTime || "09:00"}`
                  : `Monthly digest on day ${settings.digestDayOfMonth || 1} at ${settings.digestTime || "09:00"}`}
              </p>
            </div>
          </>
        ) : (
          <>
            <BellOff className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Alerts are disabled</p>
              <p className="text-sm text-gray-600">
                Enable alerts below to receive notifications
              </p>
            </div>
          </>
        )}
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Settings</h3>

        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Enable Low Stock Alerts</p>
                <p className="text-sm text-gray-600">
                  Receive email notifications for low stock items
                </p>
              </div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? "bg-[#FFCC00]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Alert Email Address
            </label>
            <input
              type="email"
              value={settings.email || ""}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="shop@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              disabled={!settings.enabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Low stock alerts will be sent to this email address
            </p>
          </div>

          {/* Digest Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Digest Mode
            </label>
            <select
              value={settings.digestMode || "daily"}
              onChange={(e) => setSettings({ ...settings, digestMode: e.target.value as "immediate" | "daily" | "weekly" | "monthly" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              disabled={!settings.enabled}
            >
              <option value="immediate">⚡ Immediate (as items go low)</option>
              <option value="daily">📅 Daily Summary</option>
              <option value="weekly">📆 Weekly Summary</option>
              <option value="monthly">🗓️ Monthly Summary</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose how you want to receive low stock alerts
            </p>
          </div>

          {/* Digest Scheduling (conditional based on mode) */}
          {settings.digestMode && settings.digestMode !== "immediate" && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-200">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock className="w-4 h-4" />
                Scheduling
              </div>

              {/* Day of Week (weekly mode) */}
              {settings.digestMode === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day of Week
                  </label>
                  <select
                    value={settings.digestDayOfWeek || 1}
                    onChange={(e) => setSettings({ ...settings, digestDayOfWeek: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
              )}

              {/* Day of Month (monthly mode) */}
              {settings.digestMode === "monthly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={settings.digestDayOfMonth || 1}
                    onChange={(e) => setSettings({ ...settings, digestDayOfMonth: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Day 1-28 (limited to 28 to ensure digest sends every month)
                  </p>
                </div>
              )}

              {/* Time (all scheduled modes) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time (24-hour format)
                </label>
                <input
                  type="time"
                  value={settings.digestTime || "09:00"}
                  onChange={(e) => setSettings({ ...settings, digestTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digest will be sent within 1 hour of this time
                </p>
              </div>

              {/* Next Digest Preview */}
              {settings.lastDigestSentAt && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    Last digest sent: {new Date(settings.lastDigestSentAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Panel for Digest Modes */}
          {settings.digestMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  {settings.digestMode === "immediate" && (
                    <>
                      <p className="font-medium mb-1">Immediate Mode</p>
                      <p className="text-blue-700">
                        Receive an email alert as soon as an item goes below its low stock threshold.
                        Each item has a 24-hour cooldown to prevent spam.
                      </p>
                    </>
                  )}
                  {settings.digestMode === "daily" && (
                    <>
                      <p className="font-medium mb-1">Daily Digest</p>
                      <p className="text-blue-700">
                        Receive one email per day at {settings.digestTime || "09:00"} with all low stock items.
                        Reduces email fatigue while keeping you informed.
                      </p>
                    </>
                  )}
                  {settings.digestMode === "weekly" && (
                    <>
                      <p className="font-medium mb-1">Weekly Digest</p>
                      <p className="text-blue-700">
                        Receive one email per week on {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][settings.digestDayOfWeek || 1]} at {settings.digestTime || "09:00"}.
                        Perfect for less critical inventory tracking.
                      </p>
                    </>
                  )}
                  {settings.digestMode === "monthly" && (
                    <>
                      <p className="font-medium mb-1">Monthly Digest</p>
                      <p className="text-blue-700">
                        Receive one email per month on day {settings.digestDayOfMonth || 1} at {settings.digestTime || "09:00"}.
                        Best for slow-moving inventory or periodic reviews.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Check */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Alert Check</h3>
            <p className="text-sm text-gray-600">
              Trigger an immediate check for low stock items and send an email alert
            </p>
            {lastCheckResult && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Last check: {lastCheckResult.emailSent ? "✓ Email sent" : "○ No email sent"} -
                  {lastCheckResult.itemsCount} items found
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleTriggerCheck}
            disabled={triggering || !settings.enabled || !settings.email}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {triggering ? "Checking..." : "Run Check Now"}
          </button>
        </div>
      </div>

      {/* Current Low Stock Items */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Current Low Stock Items ({lowStockItems.length})
        </h3>

        {lowStockItems.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No low stock items at the moment</p>
            <p className="text-sm text-gray-500 mt-1">All inventory levels are healthy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Low Stock Threshold</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                      {item.categoryName && (
                        <div className="text-xs text-gray-500">{item.categoryName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-medium ${
                          item.stockQuantity === 0 ? "text-red-600" : "text-orange-600"
                        }`}
                      >
                        {item.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-900">{item.lowStockThreshold}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === "out_of_stock"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {item.status === "out_of_stock" ? "OUT OF STOCK" : "LOW STOCK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How Email Digest Mode Works</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li><strong>Immediate:</strong> Get an alert as soon as an item goes low (24-hour cooldown per item)</li>
            <li><strong>Daily/Weekly/Monthly:</strong> Get one consolidated email with all low stock items</li>
            <li>Only items at or below their low stock threshold are included</li>
            <li>Digest emails include usage analytics and smart order quantity suggestions</li>
            <li>You can manually trigger an immediate check at any time</li>
            <li>Make sure your email address is correct to receive alerts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
