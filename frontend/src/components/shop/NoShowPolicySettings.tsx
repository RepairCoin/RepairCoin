"use client";

import React, { useState, useEffect } from "react";
import { Save, X, AlertCircle, CheckCircle, Shield, Bell, Scale, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { getShopNoShowPolicy, updateShopNoShowPolicy, NoShowPolicy } from "@/services/api/noShow";

export const NoShowPolicySettings: React.FC = () => {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [policy, setPolicy] = useState<NoShowPolicy | null>(null);
  const [originalPolicy, setOriginalPolicy] = useState<NoShowPolicy | null>(null);

  // Load policy on mount
  useEffect(() => {
    const loadPolicy = async () => {
      if (!shopId) return;

      try {
        setLoading(true);
        const data = await getShopNoShowPolicy(shopId);
        setPolicy(data);
        setOriginalPolicy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load policy");
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, [shopId]);

  // Track changes
  useEffect(() => {
    if (!policy || !originalPolicy) {
      setHasChanges(false);
      return;
    }

    const changed = JSON.stringify(policy) !== JSON.stringify(originalPolicy);
    setHasChanges(changed);
  }, [policy, originalPolicy]);

  const handleUpdate = <K extends keyof NoShowPolicy>(
    field: K,
    value: NoShowPolicy[K]
  ) => {
    if (!policy) return;
    setPolicy({ ...policy, [field]: value });
    setError("");
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!policy || !shopId) return;

    try {
      setSaving(true);
      setError("");
      const updatedPolicy = await updateShopNoShowPolicy(shopId, policy);
      setPolicy(updatedPolicy);
      setOriginalPolicy(updatedPolicy);
      setSuccess(true);
      setHasChanges(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalPolicy) return;
    setPolicy({ ...originalPolicy });
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

  if (!policy) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400">Failed to load policy settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">No-Show Policy Settings</h2>
          <p className="text-sm text-gray-400">
            Configure how no-shows are handled for your shop
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
          <p className="text-green-400">Policy updated successfully!</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#FFCC00]" />
            <div>
              <h3 className="text-lg font-semibold text-white">Enable No-Show Tracking</h3>
              <p className="text-sm text-gray-400">
                Turn on/off the entire no-show penalty system for your shop
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) => handleUpdate("enabled", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FFCC00]"></div>
          </label>
        </div>
      </div>

      {/* Penalty Tiers Section */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Scale className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Penalty Tiers</h3>
            <p className="text-sm text-gray-400">
              Configure thresholds for each penalty tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tier 2: Caution */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tier 2 - Caution Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={policy.cautionThreshold}
                onChange={(e) => handleUpdate("cautionThreshold", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">no-shows</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of no-shows before customer reaches Tier 2 (Caution)
            </p>
          </div>

          {/* Tier 2: Advance Booking Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tier 2 - Advance Booking Required
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="168"
                value={policy.cautionAdvanceBookingHours}
                onChange={(e) => handleUpdate("cautionAdvanceBookingHours", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">hours</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers must book this many hours in advance at Tier 2
            </p>
          </div>

          {/* Tier 3: Deposit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tier 3 - Deposit Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="20"
                value={policy.depositThreshold}
                onChange={(e) => handleUpdate("depositThreshold", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">no-shows</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of no-shows before deposit is required
            </p>
          </div>

          {/* Deposit Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deposit Amount
            </label>
            <div className="flex items-center gap-3">
              <span className="text-white">$</span>
              <input
                type="number"
                min="0"
                max="500"
                step="5"
                value={policy.depositAmount}
                onChange={(e) => handleUpdate("depositAmount", parseFloat(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">USD</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Refundable deposit amount for Tier 3 customers
            </p>
          </div>

          {/* Tier 3: Advance Booking Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tier 3 - Advance Booking Required
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="168"
                value={policy.depositAdvanceBookingHours}
                onChange={(e) => handleUpdate("depositAdvanceBookingHours", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">hours</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers must book this many hours in advance at Tier 3
            </p>
          </div>

          {/* Recovery: Successful Appointments */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recovery - Successful Appointments
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="20"
                value={policy.depositResetAfterSuccessful}
                onChange={(e) => handleUpdate("depositResetAfterSuccessful", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">appointments</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of successful appointments needed to downgrade from Tier 3
            </p>
          </div>

          {/* Max RCN Redemption */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max RCN Redemption (Tiers 2-3)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                value={policy.maxRcnRedemptionPercent}
                onChange={(e) => handleUpdate("maxRcnRedemptionPercent", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum % of service price redeemable with RCN at Tiers 2-3
            </p>
          </div>

          {/* Tier 4: Suspension */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tier 4 - Suspension Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="50"
                value={policy.suspensionThreshold}
                onChange={(e) => handleUpdate("suspensionThreshold", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">no-shows</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of no-shows before customer is suspended
            </p>
          </div>

          {/* Suspension Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Suspension Duration
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                value={policy.suspensionDurationDays}
                onChange={(e) => handleUpdate("suspensionDurationDays", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">days</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How long customers are suspended at Tier 4
            </p>
          </div>
        </div>
      </div>

      {/* Timing & Detection Section */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Timing & Detection</h3>
            <p className="text-sm text-gray-400">
              Configure grace periods and auto-detection settings
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grace Period */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Grace Period
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="120"
                value={policy.gracePeriodMinutes}
                onChange={(e) => handleUpdate("gracePeriodMinutes", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">minutes</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers can be this many minutes late before it's a no-show
            </p>
          </div>

          {/* Auto-Detection Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Auto-Detection
            </label>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.autoDetectionEnabled}
                  onChange={(e) => handleUpdate("autoDetectionEnabled", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </label>
              <span className="text-sm text-gray-400">
                {policy.autoDetectionEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Automatically mark no-shows after appointment time + delay
            </p>
          </div>

          {/* Auto-Detection Delay */}
          {policy.autoDetectionEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Auto-Detection Delay
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={policy.autoDetectionDelayHours}
                  onChange={(e) => handleUpdate("autoDetectionDelayHours", parseInt(e.target.value))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                />
                <span className="text-sm text-gray-400">hours</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Wait this long after appointment before auto-marking no-show
              </p>
            </div>
          )}

          {/* Minimum Cancellation Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Cancellation Notice
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="168"
                value={policy.minimumCancellationHours}
                onChange={(e) => handleUpdate("minimumCancellationHours", parseInt(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">hours</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers must cancel this many hours before appointment
            </p>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <p className="text-sm text-gray-400">
              Configure which notifications to send for each tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Email Notifications */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">Email Notifications</p>
            {[
              { label: "Tier 1 (Warning)", key: "sendEmailTier1" as const },
              { label: "Tier 2 (Caution)", key: "sendEmailTier2" as const },
              { label: "Tier 3 (Deposit)", key: "sendEmailTier3" as const },
              { label: "Tier 4 (Suspended)", key: "sendEmailTier4" as const },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#FFCC00] focus:ring-2"
                />
                <span className="text-sm text-gray-400">{item.label}</span>
              </label>
            ))}
          </div>

          {/* SMS Notifications */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">SMS Notifications</p>
            {[
              { label: "Tier 2 (Caution)", key: "sendSmsTier2" as const },
              { label: "Tier 3 (Deposit)", key: "sendSmsTier3" as const },
              { label: "Tier 4 (Suspended)", key: "sendSmsTier4" as const },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy[item.key]}
                  onChange={(e) => handleUpdate(item.key, e.target.checked)}
                  className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#FFCC00] focus:ring-2"
                />
                <span className="text-sm text-gray-400">{item.label}</span>
              </label>
            ))}
            <p className="text-xs text-gray-500">SMS feature coming soon</p>
          </div>

          {/* Push Notifications */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">Push Notifications</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.sendPushNotifications}
                onChange={(e) => handleUpdate("sendPushNotifications", e.target.checked)}
                className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#FFCC00] focus:ring-2"
              />
              <span className="text-sm text-gray-400">Enable in-app notifications</span>
            </label>
            <p className="text-xs text-gray-500">Real-time notifications in the app</p>
          </div>
        </div>
      </div>

      {/* Disputes Section */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Dispute Settings</h3>
            <p className="text-sm text-gray-400">
              Configure how customers can dispute no-show marks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allow Disputes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Allow Disputes
            </label>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.allowDisputes}
                  onChange={(e) => handleUpdate("allowDisputes", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </label>
              <span className="text-sm text-gray-400">
                {policy.allowDisputes ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Allow customers to dispute wrongly marked no-shows
            </p>
          </div>

          {/* Dispute Window */}
          {policy.allowDisputes && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dispute Window
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={policy.disputeWindowDays}
                    onChange={(e) => handleUpdate("disputeWindowDays", parseInt(e.target.value))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                  />
                  <span className="text-sm text-gray-400">days</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Customers can dispute within this many days after no-show
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.autoApproveFirstOffense}
                    onChange={(e) => handleUpdate("autoApproveFirstOffense", e.target.checked)}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#FFCC00] focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Auto-approve first offense disputes</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically approve disputes for customers with 1 no-show
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.requireShopReview}
                    onChange={(e) => handleUpdate("requireShopReview", e.target.checked)}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#FFCC00] focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Require shop review for disputes</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  All disputes require manual shop owner approval
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Start with default settings and adjust based on your shop's needs.
          More lenient policies may attract customers, while stricter policies protect your revenue.
        </p>
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
