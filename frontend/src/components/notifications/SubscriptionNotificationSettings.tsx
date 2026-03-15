"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertCircle, Loader2, CreditCard, Mail, AlertTriangle } from "lucide-react";
import { notificationsApi } from "@/services/api/notifications";
import type { GeneralNotificationPreferences, UpdateGeneralNotificationPreferences } from "@/constants/types";

interface SubscriptionNotificationSettingsProps {
  userType?: 'customer' | 'shop' | 'admin';
}

export function SubscriptionNotificationSettings({ userType = 'shop' }: SubscriptionNotificationSettingsProps) {
  const [preferences, setPreferences] = useState<GeneralNotificationPreferences | null>(null);
  const [localPreferences, setLocalPreferences] = useState<Partial<GeneralNotificationPreferences>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationsApi.getGeneralNotificationPreferences();
      setPreferences(data);
      setLocalPreferences({
        paymentReminders: data.paymentReminders,
        paymentFailureAlerts: data.paymentFailureAlerts,
        subscriptionRenewalNotices: data.subscriptionRenewalNotices,
        subscriptionExpirationWarnings: data.subscriptionExpirationWarnings,
        paymentMethodExpiring: data.paymentMethodExpiring,
        billingReceiptNotifications: data.billingReceiptNotifications,
      });
    } catch (err) {
      console.error("Error loading subscription notification preferences:", err);
      setError("Failed to load notification preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field: keyof UpdateGeneralNotificationPreferences) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updates: UpdateGeneralNotificationPreferences = {
        paymentReminders: localPreferences.paymentReminders,
        paymentFailureAlerts: localPreferences.paymentFailureAlerts,
        subscriptionRenewalNotices: localPreferences.subscriptionRenewalNotices,
        subscriptionExpirationWarnings: localPreferences.subscriptionExpirationWarnings,
        paymentMethodExpiring: localPreferences.paymentMethodExpiring,
        billingReceiptNotifications: localPreferences.billingReceiptNotifications,
      };

      await notificationsApi.updateGeneralNotificationPreferences(updates);

      // Reload to get fresh data from server
      await loadPreferences();

      setSuccessMessage("Subscription notification preferences updated successfully!");
      setHasUnsavedChanges(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error saving subscription notification preferences:", err);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setLocalPreferences({
        paymentReminders: preferences.paymentReminders,
        paymentFailureAlerts: preferences.paymentFailureAlerts,
        subscriptionRenewalNotices: preferences.subscriptionRenewalNotices,
        subscriptionExpirationWarnings: preferences.subscriptionExpirationWarnings,
        paymentMethodExpiring: preferences.paymentMethodExpiring,
        billingReceiptNotifications: preferences.billingReceiptNotifications,
      });
      setHasUnsavedChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#FFCC00] rounded-lg flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Subscription Notifications</h3>
          <p className="text-sm text-gray-400">Manage notifications for your subscription and billing</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-900/20 border border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      <div className="space-y-4">
        {/* Payment Reminders */}
        <div className="flex items-start justify-between py-4 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-[#FFCC00]" />
              <h4 className="text-base font-semibold text-white">Payment Reminders</h4>
            </div>
            <p className="text-sm text-gray-400">
              Receive reminder notifications before your subscription payment is due
            </p>
          </div>
          <button
            onClick={() => handleToggle("paymentReminders")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.paymentReminders ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.paymentReminders ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Payment Failure Alerts */}
        <div className="flex items-start justify-between py-4 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h4 className="text-base font-semibold text-white">Payment Failure Alerts</h4>
            </div>
            <p className="text-sm text-gray-400">
              Get immediately notified if a subscription payment fails
            </p>
          </div>
          <button
            onClick={() => handleToggle("paymentFailureAlerts")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.paymentFailureAlerts ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.paymentFailureAlerts ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Subscription Renewal Notices */}
        <div className="flex items-start justify-between py-4 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-[#FFCC00]" />
              <h4 className="text-base font-semibold text-white">Subscription Renewal Notices</h4>
            </div>
            <p className="text-sm text-gray-400">
              Be notified before your subscription automatically renews
            </p>
          </div>
          <button
            onClick={() => handleToggle("subscriptionRenewalNotices")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.subscriptionRenewalNotices ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.subscriptionRenewalNotices ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Subscription Expiration Warnings */}
        <div className="flex items-start justify-between py-4 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <h4 className="text-base font-semibold text-white">Subscription Expiration Warnings</h4>
            </div>
            <p className="text-sm text-gray-400">
              Get warned before your subscription is about to expire
            </p>
          </div>
          <button
            onClick={() => handleToggle("subscriptionExpirationWarnings")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.subscriptionExpirationWarnings ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.subscriptionExpirationWarnings ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Payment Method Expiring */}
        <div className="flex items-start justify-between py-4 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-orange-400" />
              <h4 className="text-base font-semibold text-white">Payment Method Expiring</h4>
            </div>
            <p className="text-sm text-gray-400">
              Receive alerts when your payment method is about to expire
            </p>
          </div>
          <button
            onClick={() => handleToggle("paymentMethodExpiring")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.paymentMethodExpiring ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.paymentMethodExpiring ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Billing Receipt Notifications */}
        <div className="flex items-start justify-between py-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-blue-400" />
              <h4 className="text-base font-semibold text-white">Billing Receipt Notifications</h4>
            </div>
            <p className="text-sm text-gray-400">
              Receive receipts for successful subscription payments
            </p>
          </div>
          <button
            onClick={() => handleToggle("billingReceiptNotifications")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localPreferences.billingReceiptNotifications ? "bg-[#FFCC00]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localPreferences.billingReceiptNotifications ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      {hasUnsavedChanges && (
        <div className="mt-6 flex items-center justify-between gap-3 pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-400">You have unsaved changes</p>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
