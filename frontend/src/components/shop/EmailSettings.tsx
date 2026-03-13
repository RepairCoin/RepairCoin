"use client";

import React, { useState, useEffect } from "react";
import { Save, X, AlertCircle, CheckCircle, Mail, Bell, Clock, Settings } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { EmailPreferences, getShopEmailPreferences, updateShopEmailPreferences } from "@/services/api/emailPreferences";

export const EmailSettings: React.FC = () => {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [originalPreferences, setOriginalPreferences] = useState<EmailPreferences | null>(null);

  // Load preferences from backend
  useEffect(() => {
    const loadPreferences = async () => {
      console.log('📧 [EmailSettings Frontend] useEffect triggered');
      console.log('📧 [EmailSettings Frontend] shopId:', shopId);
      console.log('📧 [EmailSettings Frontend] userProfile:', userProfile);

      if (!shopId) {
        console.warn('⚠️ [EmailSettings Frontend] No shopId available, aborting');
        setError("No shop ID found. Please ensure you're logged in as a shop owner.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        console.log('📧 [EmailSettings Frontend] Calling API for shopId:', shopId);
        const fetchedPreferences = await getShopEmailPreferences(shopId);
        console.log('✅ [EmailSettings Frontend] Preferences loaded successfully:', fetchedPreferences);
        setPreferences(fetchedPreferences);
        setOriginalPreferences(fetchedPreferences);
      } catch (err) {
        console.error("❌ [EmailSettings Frontend] Error loading preferences:", err);
        console.error("❌ [EmailSettings Frontend] Error details:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          response: (err as any)?.response?.data
        });
        setError("Failed to load email preferences: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [shopId]);

  // Track changes
  useEffect(() => {
    if (!preferences || !originalPreferences) {
      setHasChanges(false);
      return;
    }

    const changed = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
    setHasChanges(changed);
  }, [preferences, originalPreferences]);

  const handleUpdate = <K extends keyof EmailPreferences>(
    field: K,
    value: EmailPreferences[K]
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [field]: value });
    setError("");
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!preferences || !shopId) return;

    try {
      setSaving(true);
      setError("");

      const updatedPreferences = await updateShopEmailPreferences(shopId, preferences);

      setPreferences(updatedPreferences);
      setOriginalPreferences(updatedPreferences);
      setSuccess(true);
      setHasChanges(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalPreferences) return;
    setPreferences({ ...originalPreferences });
    setHasChanges(false);
    setError("");
    setSuccess(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400">Failed to load email preferences</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> Email preferences are saved to the database and synced across all your devices.
              Changes take effect immediately for future notifications.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Email Notifications</h2>
          <p className="text-sm text-gray-400">
            Configure which email notifications you want to receive
          </p>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 inline mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400">Email preferences saved successfully!</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Booking & Appointment Notifications */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Booking & Appointments</h3>
            <p className="text-sm text-gray-400">
              Stay updated on customer bookings and appointments
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: "newBooking" as const, label: "New Booking", description: "When a customer books a service" },
            { key: "bookingCancellation" as const, label: "Booking Cancellation", description: "When a customer cancels their booking" },
            { key: "bookingReschedule" as const, label: "Booking Reschedule", description: "When a customer requests to reschedule" },
            { key: "appointmentReminder" as const, label: "Appointment Reminder", description: "24 hours before upcoming appointments" },
            { key: "noShowAlert" as const, label: "No-Show Alert", description: "When a customer doesn't show up for appointment" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Customer Activity */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Customer Activity</h3>
            <p className="text-sm text-gray-400">
              Notifications about customer interactions
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: "newCustomer" as const, label: "New Customer", description: "When someone books for the first time" },
            { key: "customerReview" as const, label: "Customer Review", description: "When a customer leaves a review" },
            { key: "customerMessage" as const, label: "Customer Message", description: "When a customer sends you a message" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Financial Notifications */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Financial & Subscription</h3>
            <p className="text-sm text-gray-400">
              Payment and subscription-related notifications
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: "paymentReceived" as const, label: "Payment Received", description: "When you receive payment for a service" },
            { key: "refundProcessed" as const, label: "Refund Processed", description: "When a refund is issued to a customer" },
            { key: "subscriptionRenewal" as const, label: "Subscription Renewal", description: "When your subscription renews" },
            { key: "subscriptionExpiring" as const, label: "Subscription Expiring", description: "7 days before subscription expires" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Digest & Reports */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Digest & Reports</h3>
            <p className="text-sm text-gray-400">
              Periodic summaries and performance reports
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Daily Digest */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  Daily Digest
                </p>
                <p className="text-xs text-gray-500">Daily summary of bookings and activity</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.dailyDigest}
                  onChange={(e) => handleUpdate("dailyDigest", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>

            {preferences.dailyDigest && (
              <div className="ml-4 pl-4 border-l-2 border-gray-700">
                <label className="block text-sm text-gray-400 mb-2">Delivery Time</label>
                <select
                  value={preferences.digestTime}
                  onChange={(e) => handleUpdate("digestTime", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                >
                  <option value="morning">Morning (8:00 AM)</option>
                  <option value="afternoon">Afternoon (2:00 PM)</option>
                  <option value="evening">Evening (6:00 PM)</option>
                </select>
              </div>
            )}
          </div>

          {/* Weekly Report */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  Weekly Report
                </p>
                <p className="text-xs text-gray-500">Weekly performance summary</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.weeklyReport}
                  onChange={(e) => handleUpdate("weeklyReport", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>

            {preferences.weeklyReport && (
              <div className="ml-4 pl-4 border-l-2 border-gray-700">
                <label className="block text-sm text-gray-400 mb-2">Delivery Day</label>
                <select
                  value={preferences.weeklyReportDay}
                  onChange={(e) => handleUpdate("weeklyReportDay", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                >
                  <option value="monday">Monday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>
            )}
          </div>

          {/* Monthly Report */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  Monthly Report
                </p>
                <p className="text-xs text-gray-500">Monthly business insights and trends</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.monthlyReport}
                  onChange={(e) => handleUpdate("monthlyReport", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>

            {preferences.monthlyReport && (
              <div className="ml-4 pl-4 border-l-2 border-gray-700">
                <label className="block text-sm text-gray-400 mb-2">Day of Month</label>
                <select
                  value={preferences.monthlyReportDay}
                  onChange={(e) => handleUpdate("monthlyReportDay", parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                >
                  <option value="1">1st of the month</option>
                  <option value="15">15th of the month</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Marketing & Updates */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Marketing & Updates</h3>
            <p className="text-sm text-gray-400">
              Platform news and promotional content
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: "featureAnnouncements" as const, label: "Feature Announcements", description: "New features and improvements" },
            { key: "marketingUpdates" as const, label: "Marketing Tips", description: "Tips to grow your business" },
            { key: "platformNews" as const, label: "Platform News", description: "RepairCoin updates and newsletters" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <p className="text-sm font-medium text-white group-hover:text-[#FFCC00] transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button (Mobile) */}
      {hasChanges && (
        <div className="md:hidden flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 inline mr-2" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
};
