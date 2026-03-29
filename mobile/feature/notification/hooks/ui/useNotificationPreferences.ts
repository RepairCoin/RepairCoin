import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { notificationApi } from "@/shared/services/notification.services";
import {
  AppointmentNotificationPreferences,
  GeneralNotificationPreferences,
} from "@/shared/interfaces/notification.interface";
import { useAppToast } from "@/shared/hooks";

interface AppointmentFormData {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface GeneralFormData {
  // Platform Updates
  platformUpdates: boolean;
  maintenanceAlerts: boolean;
  newFeatures: boolean;
  // Account & Security
  securityAlerts: boolean;
  loginNotifications: boolean;
  passwordChanges: boolean;
  // Tokens & Rewards (Customer)
  tokenReceived: boolean;
  tokenRedeemed: boolean;
  rewardsEarned: boolean;
  // Orders & Services (Customer)
  orderUpdates: boolean;
  serviceApproved: boolean;
  reviewRequests: boolean;
  // Shop Operations
  newOrders: boolean;
  customerMessages: boolean;
  lowTokenBalance: boolean;
  subscriptionReminders: boolean;
  // Marketing
  promotions: boolean;
  newsletter: boolean;
  surveys: boolean;
}

const DEFAULT_APPOINTMENT: AppointmentFormData = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  reminder24hEnabled: true,
  reminder2hEnabled: true,
  reminder30mEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

const DEFAULT_GENERAL: GeneralFormData = {
  platformUpdates: true,
  maintenanceAlerts: true,
  newFeatures: false,
  securityAlerts: true,
  loginNotifications: false,
  passwordChanges: false,
  tokenReceived: true,
  tokenRedeemed: true,
  rewardsEarned: true,
  orderUpdates: true,
  serviceApproved: true,
  reviewRequests: false,
  newOrders: true,
  customerMessages: true,
  lowTokenBalance: true,
  subscriptionReminders: true,
  promotions: false,
  newsletter: false,
  surveys: false,
};

export function useNotificationPreferences() {
  const { account, userType } = useAuthStore();
  const { showSuccess, showError } = useAppToast();
  const [loading, setLoading] = useState(true);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [appointmentForm, setAppointmentForm] =
    useState<AppointmentFormData>(DEFAULT_APPOINTMENT);
  const [generalForm, setGeneralForm] =
    useState<GeneralFormData>(DEFAULT_GENERAL);

  // Load both preferences on mount
  useEffect(() => {
    const load = async () => {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [appointmentPrefs, generalPrefs] = await Promise.all([
          userType === "customer"
            ? notificationApi.getAppointmentPreferences(account.address)
            : null,
          notificationApi.getGeneralPreferences(),
        ]);

        if (appointmentPrefs) {
          setAppointmentForm({
            emailEnabled: appointmentPrefs.emailEnabled ?? true,
            smsEnabled: appointmentPrefs.smsEnabled ?? false,
            inAppEnabled: appointmentPrefs.inAppEnabled ?? true,
            reminder24hEnabled: appointmentPrefs.reminder24hEnabled ?? true,
            reminder2hEnabled: appointmentPrefs.reminder2hEnabled ?? true,
            reminder30mEnabled: appointmentPrefs.reminder30mEnabled ?? false,
            quietHoursEnabled: appointmentPrefs.quietHoursEnabled ?? false,
            quietHoursStart: appointmentPrefs.quietHoursStart || "22:00",
            quietHoursEnd: appointmentPrefs.quietHoursEnd || "08:00",
          });
        }

        if (generalPrefs) {
          setGeneralForm({
            platformUpdates: generalPrefs.platformUpdates ?? true,
            maintenanceAlerts: generalPrefs.maintenanceAlerts ?? true,
            newFeatures: generalPrefs.newFeatures ?? false,
            securityAlerts: generalPrefs.securityAlerts ?? true,
            loginNotifications: generalPrefs.loginNotifications ?? false,
            passwordChanges: generalPrefs.passwordChanges ?? false,
            tokenReceived: generalPrefs.tokenReceived ?? true,
            tokenRedeemed: generalPrefs.tokenRedeemed ?? true,
            rewardsEarned: generalPrefs.rewardsEarned ?? true,
            orderUpdates: generalPrefs.orderUpdates ?? true,
            serviceApproved: generalPrefs.serviceApproved ?? true,
            reviewRequests: generalPrefs.reviewRequests ?? false,
            newOrders: generalPrefs.newOrders ?? true,
            customerMessages: generalPrefs.customerMessages ?? true,
            lowTokenBalance: generalPrefs.lowTokenBalance ?? true,
            subscriptionReminders: generalPrefs.subscriptionReminders ?? true,
            promotions: generalPrefs.promotions ?? false,
            newsletter: generalPrefs.newsletter ?? false,
            surveys: generalPrefs.surveys ?? false,
          });
        }
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [account?.address, userType]);

  // Appointment toggle with channel validation
  const toggleAppointment = useCallback(
    (key: keyof AppointmentFormData) => {
      if (key === "emailEnabled" || key === "inAppEnabled" || key === "smsEnabled") {
        const channelKeys = ["emailEnabled", "inAppEnabled", "smsEnabled"] as const;
        const enabledCount = channelKeys.filter(
          (k) => k === key ? !appointmentForm[k] : appointmentForm[k]
        ).length;

        if (enabledCount === 0) {
          showError("At least one channel must be enabled");
          return;
        }
      }

      setAppointmentForm((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    [appointmentForm]
  );

  const setQuietHoursTime = useCallback(
    (key: "quietHoursStart" | "quietHoursEnd", value: string) => {
      setAppointmentForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // General toggle
  const toggleGeneral = useCallback((key: keyof GeneralFormData) => {
    setGeneralForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Save appointment preferences
  const saveAppointmentPreferences = useCallback(async () => {
    if (!account?.address) return;

    setSavingAppointment(true);
    try {
      await notificationApi.updateAppointmentPreferences(account.address, {
        emailEnabled: appointmentForm.emailEnabled,
        smsEnabled: appointmentForm.smsEnabled,
        inAppEnabled: appointmentForm.inAppEnabled,
        reminder24hEnabled: appointmentForm.reminder24hEnabled,
        reminder2hEnabled: appointmentForm.reminder2hEnabled,
        reminder30mEnabled: appointmentForm.reminder30mEnabled,
        quietHoursEnabled: appointmentForm.quietHoursEnabled,
        quietHoursStart: appointmentForm.quietHoursEnabled
          ? appointmentForm.quietHoursStart
          : null,
        quietHoursEnd: appointmentForm.quietHoursEnabled
          ? appointmentForm.quietHoursEnd
          : null,
      });
      showSuccess("Appointment preferences saved");
    } catch (error) {
      console.error("Error saving appointment preferences:", error);
      showError("Failed to save preferences");
    } finally {
      setSavingAppointment(false);
    }
  }, [account?.address, appointmentForm]);

  // Save general preferences
  const saveGeneralPreferences = useCallback(async () => {
    setSavingGeneral(true);
    try {
      await notificationApi.updateGeneralPreferences(generalForm);
      showSuccess("Notification preferences saved");
    } catch (error) {
      console.error("Error saving general preferences:", error);
      showError("Failed to save preferences");
    } finally {
      setSavingGeneral(false);
    }
  }, [generalForm]);

  return {
    loading,
    userType,
    // Appointment
    appointmentForm,
    savingAppointment,
    toggleAppointment,
    setQuietHoursTime,
    saveAppointmentPreferences,
    // General
    generalForm,
    savingGeneral,
    toggleGeneral,
    saveGeneralPreferences,
  };
}
