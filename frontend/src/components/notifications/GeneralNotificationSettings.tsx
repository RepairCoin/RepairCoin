"use client";

import { useState } from "react";
import { Bell, MessageSquare, Gift, Wallet, Store, AlertCircle, Mail, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

interface ToggleSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  comingSoon?: boolean;
  icon?: React.ReactNode;
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  comingSoon = false,
  icon,
}: ToggleSwitchProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3 flex-1">
        {icon && <div className="text-[#FFCC00] mt-1">{icon}</div>}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium text-sm sm:text-base">{label}</p>
            {comingSoon && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled || comingSoon}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 focus:ring-offset-[#212121]
          ${checked ? "bg-[#FFCC00]" : "bg-gray-600"}
          ${disabled || comingSoon ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </label>
  );
}

interface GeneralNotificationSettingsProps {
  userType?: 'customer' | 'shop' | 'admin';
}

export function GeneralNotificationSettings({ userType = 'customer' }: GeneralNotificationSettingsProps) {
  const [saving, setSaving] = useState(false);

  // Placeholder state - these will be connected to API later
  const [preferences, setPreferences] = useState({
    // Platform Updates
    platformUpdates: true,
    maintenanceAlerts: true,
    newFeatures: false,

    // Account & Security
    securityAlerts: true,
    loginNotifications: false,
    passwordChanges: true,

    // Transactions (Customer)
    tokenReceived: true,
    tokenRedeemed: true,
    rewardsEarned: true,

    // Orders & Services (Customer)
    orderUpdates: true,
    serviceApproved: true,
    reviewRequests: false,

    // Shop Notifications (Shop)
    newOrders: true,
    customerMessages: true,
    lowTokenBalance: true,
    subscriptionReminders: true,

    // Marketing
    promotions: false,
    newsletter: false,
    surveys: false,

    // Admin Notifications (Admin)
    systemAlerts: true,
    userReports: true,
    treasuryChanges: true,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      toast.success("Notification preferences saved!");
    }, 1000);
  };

  return (
    <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
            <p className="text-sm text-gray-400">Choose what you want to be notified about</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm px-5 py-2 bg-[#FFCC00] text-black rounded-full font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-300">
              <strong>Feature Preview:</strong> Notification preferences are being configured. Most options will be available soon!
            </p>
          </div>
        </div>

        {/* Platform & System */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Platform Updates
          </h3>
          <div className="space-y-1 divide-y divide-gray-700">
            <ToggleSwitch
              label="Platform Updates"
              description="Important updates about RepairCoin platform"
              checked={preferences.platformUpdates}
              onChange={() => handleToggle("platformUpdates")}
              icon={<Bell className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="Maintenance Alerts"
              description="Scheduled maintenance and downtime notices"
              checked={preferences.maintenanceAlerts}
              onChange={() => handleToggle("maintenanceAlerts")}
              icon={<AlertCircle className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="New Features"
              description="Get notified when we launch new features"
              checked={preferences.newFeatures}
              onChange={() => handleToggle("newFeatures")}
              icon={<Gift className="w-5 h-5" />}
              comingSoon
            />
          </div>
        </div>

        {/* Account & Security */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Account & Security
          </h3>
          <div className="space-y-1 divide-y divide-gray-700">
            <ToggleSwitch
              label="Security Alerts"
              description="Critical security notifications (always on)"
              checked={preferences.securityAlerts}
              onChange={() => handleToggle("securityAlerts")}
              icon={<AlertCircle className="w-5 h-5" />}
              disabled
            />
            <ToggleSwitch
              label="Login Notifications"
              description="Get notified when someone logs into your account"
              checked={preferences.loginNotifications}
              onChange={() => handleToggle("loginNotifications")}
              icon={<Wallet className="w-5 h-5" />}
              comingSoon
            />
            <ToggleSwitch
              label="Password Changes"
              description="Alerts when your password is changed"
              checked={preferences.passwordChanges}
              onChange={() => handleToggle("passwordChanges")}
              icon={<AlertCircle className="w-5 h-5" />}
              comingSoon
            />
          </div>
        </div>

        {/* Customer-specific notifications */}
        {userType === 'customer' && (
          <>
            {/* Transactions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Tokens & Rewards
              </h3>
              <div className="space-y-1 divide-y divide-gray-700">
                <ToggleSwitch
                  label="Tokens Received"
                  description="When you earn RCN tokens"
                  checked={preferences.tokenReceived}
                  onChange={() => handleToggle("tokenReceived")}
                  icon={<Wallet className="w-5 h-5" />}
                  comingSoon
                />
                <ToggleSwitch
                  label="Tokens Redeemed"
                  description="When you redeem tokens at shops"
                  checked={preferences.tokenRedeemed}
                  onChange={() => handleToggle("tokenRedeemed")}
                  icon={<Wallet className="w-5 h-5" />}
                  comingSoon
                />
                <ToggleSwitch
                  label="Rewards & Bonuses"
                  description="Special rewards and bonus opportunities"
                  checked={preferences.rewardsEarned}
                  onChange={() => handleToggle("rewardsEarned")}
                  icon={<Gift className="w-5 h-5" />}
                  comingSoon
                />
              </div>
            </div>

            {/* Orders & Services */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Store className="w-4 h-4" />
                Orders & Services
              </h3>
              <div className="space-y-1 divide-y divide-gray-700">
                <ToggleSwitch
                  label="Order Updates"
                  description="Status changes on your service bookings"
                  checked={preferences.orderUpdates}
                  onChange={() => handleToggle("orderUpdates")}
                  icon={<Bell className="w-5 h-5" />}
                  comingSoon
                />
                <ToggleSwitch
                  label="Service Approved"
                  description="When shops approve your service requests"
                  checked={preferences.serviceApproved}
                  onChange={() => handleToggle("serviceApproved")}
                  icon={<Store className="w-5 h-5" />}
                  comingSoon
                />
                <ToggleSwitch
                  label="Review Requests"
                  description="Reminders to review completed services"
                  checked={preferences.reviewRequests}
                  onChange={() => handleToggle("reviewRequests")}
                  icon={<MessageSquare className="w-5 h-5" />}
                  comingSoon
                />
              </div>
            </div>
          </>
        )}

        {/* Shop-specific notifications */}
        {userType === 'shop' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Shop Operations
            </h3>
            <div className="space-y-1 divide-y divide-gray-700">
              <ToggleSwitch
                label="New Orders"
                description="When customers book your services"
                checked={preferences.newOrders}
                onChange={() => handleToggle("newOrders")}
                icon={<Bell className="w-5 h-5" />}
                comingSoon
              />
              <ToggleSwitch
                label="Customer Messages"
                description="Direct messages from customers"
                checked={preferences.customerMessages}
                onChange={() => handleToggle("customerMessages")}
                icon={<MessageSquare className="w-5 h-5" />}
                comingSoon
              />
              <ToggleSwitch
                label="Low Token Balance"
                description="Alert when RCN balance is running low"
                checked={preferences.lowTokenBalance}
                onChange={() => handleToggle("lowTokenBalance")}
                icon={<Wallet className="w-5 h-5" />}
                comingSoon
              />
              <ToggleSwitch
                label="Subscription Reminders"
                description="Upcoming subscription renewals and payments"
                checked={preferences.subscriptionReminders}
                onChange={() => handleToggle("subscriptionReminders")}
                icon={<AlertCircle className="w-5 h-5" />}
                comingSoon
              />
            </div>
          </div>
        )}

        {/* Admin-specific notifications */}
        {userType === 'admin' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Admin Alerts
            </h3>
            <div className="space-y-1 divide-y divide-gray-700">
              <ToggleSwitch
                label="System Alerts"
                description="Critical system issues and errors"
                checked={preferences.systemAlerts}
                onChange={() => handleToggle("systemAlerts")}
                icon={<AlertCircle className="w-5 h-5" />}
                disabled
              />
              <ToggleSwitch
                label="User Reports"
                description="New user reports and support tickets"
                checked={preferences.userReports}
                onChange={() => handleToggle("userReports")}
                icon={<MessageSquare className="w-5 h-5" />}
                comingSoon
              />
              <ToggleSwitch
                label="Treasury Changes"
                description="Large transactions and treasury updates"
                checked={preferences.treasuryChanges}
                onChange={() => handleToggle("treasuryChanges")}
                icon={<Wallet className="w-5 h-5" />}
                comingSoon
              />
            </div>
          </div>
        )}

        {/* Marketing (all users) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Marketing & Promotions
          </h3>
          <div className="space-y-1 divide-y divide-gray-700">
            <ToggleSwitch
              label="Promotions & Offers"
              description="Special deals and limited-time offers"
              checked={preferences.promotions}
              onChange={() => handleToggle("promotions")}
              icon={<Gift className="w-5 h-5" />}
              comingSoon
            />
            <ToggleSwitch
              label="Newsletter"
              description="Monthly newsletter with platform updates"
              checked={preferences.newsletter}
              onChange={() => handleToggle("newsletter")}
              icon={<Mail className="w-5 h-5" />}
              comingSoon
            />
            <ToggleSwitch
              label="Surveys & Feedback"
              description="Help us improve with your feedback"
              checked={preferences.surveys}
              onChange={() => handleToggle("surveys")}
              icon={<MessageSquare className="w-5 h-5" />}
              comingSoon
            />
          </div>
        </div>

        {/* Delivery Method Info */}
        <div className="pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Notification Channels
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700">
              <Mail className="w-5 h-5 text-[#FFCC00]" />
              <div>
                <p className="text-sm font-medium text-white">Email</p>
                <p className="text-xs text-gray-400">Primary channel</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700">
              <Bell className="w-5 h-5 text-[#FFCC00]" />
              <div>
                <p className="text-sm font-medium text-white">In-App</p>
                <p className="text-xs text-gray-400">Real-time alerts</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700 opacity-50">
              <Smartphone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-400">SMS</p>
                <p className="text-xs text-gray-500">Coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
