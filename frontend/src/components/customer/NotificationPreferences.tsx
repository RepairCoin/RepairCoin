"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { customerApi } from "@/services/api/customer";
import { AppointmentNotificationPreferences } from "@/constants/types";
import toast from "react-hot-toast";
import { Bell, Mail, Smartphone, Clock, Moon, Info } from "lucide-react";

interface ToggleSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  icon,
}: ToggleSwitchProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        {icon && <div className="text-[#FFCC00] mt-1">{icon}</div>}
        <div>
          <p className="text-white font-medium text-sm sm:text-base">{label}</p>
          <p className="text-xs sm:text-sm text-gray-400">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 focus:ring-offset-[#212121]
          ${checked ? "bg-[#FFCC00]" : "bg-gray-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
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

export function NotificationPreferences() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] =
    useState<AppointmentNotificationPreferences | null>(null);

  // Local state for form
  const [formData, setFormData] = useState({
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    reminder24hEnabled: true,
    reminder2hEnabled: true,
    reminder30mEnabled: false,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!account?.address) return;

      setLoading(true);
      try {
        const prefs = await customerApi.getAppointmentNotificationPreferences(
          account.address
        );
        if (prefs) {
          setPreferences(prefs);
          setFormData({
            emailEnabled: prefs.emailEnabled ?? true,
            smsEnabled: prefs.smsEnabled ?? false,
            inAppEnabled: prefs.inAppEnabled ?? true,
            reminder24hEnabled: prefs.reminder24hEnabled ?? true,
            reminder2hEnabled: prefs.reminder2hEnabled ?? true,
            reminder30mEnabled: prefs.reminder30mEnabled ?? false,
            quietHoursEnabled: prefs.quietHoursEnabled ?? false,
            quietHoursStart: prefs.quietHoursStart || "22:00",
            quietHoursEnd: prefs.quietHoursEnd || "08:00",
          });
        }
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [account?.address]);

  const handleToggle = (key: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTimeChange = (
    key: "quietHoursStart" | "quietHoursEnd",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!account?.address) return;

    setSaving(true);
    try {
      const result = await customerApi.updateAppointmentNotificationPreferences(
        account.address,
        {
          emailEnabled: formData.emailEnabled,
          smsEnabled: formData.smsEnabled,
          inAppEnabled: formData.inAppEnabled,
          reminder24hEnabled: formData.reminder24hEnabled,
          reminder2hEnabled: formData.reminder2hEnabled,
          reminder30mEnabled: formData.reminder30mEnabled,
          quietHoursEnabled: formData.quietHoursEnabled,
          quietHoursStart: formData.quietHoursEnabled
            ? formData.quietHoursStart
            : null,
          quietHoursEnd: formData.quietHoursEnabled
            ? formData.quietHoursEnd
            : null,
        }
      );

      if (result) {
        setPreferences(result);
        toast.success("Notification preferences saved!");
      } else {
        throw new Error("Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Appointment Reminders
          </p>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
      <div
        className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white"
        style={{
          backgroundImage: `url('/img/cust-ref-widget3.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
          Appointment Reminders
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-[#2F2F2F] rounded-xl">
          <Info className="w-5 h-5 text-[#FFCC00] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Customize how you want to be reminded about your upcoming
            appointments. We&apos;ll respect your preferences for all future
            bookings.
          </p>
        </div>

        {/* Notification Channels */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Notification Channels
          </h3>
          <div className="space-y-1 divide-y divide-gray-700">
            <ToggleSwitch
              label="Email Notifications"
              description="Receive appointment reminders via email"
              checked={formData.emailEnabled}
              onChange={() => handleToggle("emailEnabled")}
              icon={<Mail className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="In-App Notifications"
              description="See reminders in the RepairCoin app"
              checked={formData.inAppEnabled}
              onChange={() => handleToggle("inAppEnabled")}
              icon={<Bell className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="SMS Notifications"
              description="Receive text message reminders (coming soon)"
              checked={formData.smsEnabled}
              onChange={() => handleToggle("smsEnabled")}
              icon={<Smartphone className="w-5 h-5" />}
              disabled={true}
            />
          </div>
        </div>

        {/* Reminder Timing */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Reminder Timing
          </h3>
          <div className="space-y-1 divide-y divide-gray-700">
            <ToggleSwitch
              label="24-Hour Reminder"
              description="Get reminded one day before your appointment"
              checked={formData.reminder24hEnabled}
              onChange={() => handleToggle("reminder24hEnabled")}
              icon={<Clock className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="2-Hour Reminder"
              description="Get reminded two hours before your appointment"
              checked={formData.reminder2hEnabled}
              onChange={() => handleToggle("reminder2hEnabled")}
              icon={<Clock className="w-5 h-5" />}
            />
            <ToggleSwitch
              label="30-Minute Reminder"
              description="Final reminder before your appointment (coming soon)"
              checked={formData.reminder30mEnabled}
              onChange={() => handleToggle("reminder30mEnabled")}
              icon={<Clock className="w-5 h-5" />}
              disabled={true}
            />
          </div>
        </div>

        {/* Quiet Hours */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Quiet Hours
          </h3>
          <div className="space-y-4">
            <ToggleSwitch
              label="Enable Quiet Hours"
              description="Pause notifications during specific times"
              checked={formData.quietHoursEnabled}
              onChange={() => handleToggle("quietHoursEnabled")}
              icon={<Moon className="w-5 h-5" />}
            />

            {formData.quietHoursEnabled && (
              <div className="ml-8 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">
                    From
                  </label>
                  <input
                    type="time"
                    value={formData.quietHoursStart}
                    onChange={(e) =>
                      handleTimeChange("quietHoursStart", e.target.value)
                    }
                    className="w-full px-4 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">To</label>
                  <input
                    type="time"
                    value={formData.quietHoursEnd}
                    onChange={(e) =>
                      handleTimeChange("quietHoursEnd", e.target.value)
                    }
                    className="w-full px-4 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
