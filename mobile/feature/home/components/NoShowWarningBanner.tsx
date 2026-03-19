import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  appointmentApi,
  CustomerNoShowStatus,
} from "@/shared/services/appointment.services";

interface BannerConfig {
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  message: string;
  showRestrictions: boolean;
  showTips: boolean;
}

function getBannerConfig(status: CustomerNoShowStatus): BannerConfig | null {
  switch (status.tier) {
    case "warning":
      return {
        bgColor: "bg-yellow-900/20",
        borderColor: "border-yellow-700/50",
        iconBgColor: "bg-yellow-900/30",
        icon: "warning-outline",
        iconColor: "#eab308",
        title: "Missed Appointment Notice",
        message: `You have ${status.noShowCount} missed appointment${status.noShowCount > 1 ? "s" : ""}. Please arrive on time for future bookings to avoid restrictions.`,
        showRestrictions: false,
        showTips: true,
      };

    case "caution":
      return {
        bgColor: "bg-orange-900/20",
        borderColor: "border-orange-700/50",
        iconBgColor: "bg-orange-900/30",
        icon: "alert-circle-outline",
        iconColor: "#f97316",
        title: "Account Restrictions Applied",
        message: `You have ${status.noShowCount} missed appointments. Additional restrictions now apply:`,
        showRestrictions: true,
        showTips: true,
      };

    case "deposit_required":
      return {
        bgColor: "bg-red-900/20",
        borderColor: "border-red-700/50",
        iconBgColor: "bg-red-900/30",
        icon: "alert-circle",
        iconColor: "#ef4444",
        title: "Refundable Deposit Required",
        message: `Due to ${status.noShowCount} missed appointments, you must now pay a refundable deposit for all bookings:`,
        showRestrictions: true,
        showTips: false,
      };

    case "suspended":
      const suspensionDate = status.bookingSuspendedUntil
        ? new Date(status.bookingSuspendedUntil).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "unknown date";

      return {
        bgColor: "bg-zinc-800",
        borderColor: "border-zinc-600",
        iconBgColor: "bg-zinc-700",
        icon: "ban-outline",
        iconColor: "#9ca3af",
        title: "Account Temporarily Suspended",
        message: `Your booking privileges have been suspended until ${suspensionDate} due to ${status.noShowCount} missed appointments.`,
        showRestrictions: true,
        showTips: false,
      };

    default:
      return null;
  }
}

export default function NoShowWarningBanner() {
  const { account } = useAuthStore();
  const [status, setStatus] = useState<CustomerNoShowStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!account?.address) return;
      try {
        const result = await appointmentApi.getCustomerNoShowStatus(
          account.address
        );
        setStatus(result);
      } catch (error) {
        // Silently fail - don't block home screen
      }
    };

    fetchStatus();
  }, [account?.address]);

  if (!status || status.tier === "normal" || dismissed) return null;

  const config = getBannerConfig(status);
  if (!config) return null;

  return (
    <View
      className={`${config.bgColor} border ${config.borderColor} rounded-2xl p-4 mb-3`}
    >
      <View className="flex-row items-start">
        {/* Icon */}
        <View
          className={`${config.iconBgColor} w-10 h-10 rounded-full items-center justify-center mr-3`}
        >
          <Ionicons name={config.icon} size={22} color={config.iconColor} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-semibold text-sm">
              {config.title}
            </Text>
            {status.tier === "warning" && (
              <TouchableOpacity
                onPress={() => setDismissed(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-gray-400 text-xs mt-1">{config.message}</Text>

          {/* Restrictions List */}
          {config.showRestrictions && status.restrictions.length > 0 && (
            <View className="mt-2">
              {status.restrictions.map((restriction, index) => (
                <View key={index} className="flex-row items-start mt-1">
                  <Text className="text-gray-500 text-xs mr-1.5">•</Text>
                  <Text className="text-gray-400 text-xs flex-1">
                    {restriction}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Deposit Required Progress */}
          {status.tier === "deposit_required" && (
            <View className="bg-white/5 rounded-lg p-2.5 mt-2.5">
              <Text className="text-green-400 text-xs font-medium">
                Complete 3 successful appointments to remove restrictions
              </Text>
              <Text className="text-gray-500 text-[10px] mt-0.5">
                Progress: {status.successfulAppointmentsSinceTier3} / 3
              </Text>
            </View>
          )}

          {/* Suspended Info */}
          {status.tier === "suspended" && (
            <View className="bg-white/5 rounded-lg p-2.5 mt-2.5">
              <Text className="text-gray-300 text-xs">
                After the suspension period, you'll be able to book again with a
                refundable deposit.
              </Text>
            </View>
          )}

          {/* Tips */}
          {config.showTips && (
            <View className="mt-2.5 pt-2.5 border-t border-white/10">
              <Text className="text-gray-500 text-[10px] font-medium mb-1">
                Tips to avoid further restrictions:
              </Text>
              <Text className="text-gray-500 text-[10px]">
                • Cancel at least 4 hours in advance
              </Text>
              <Text className="text-gray-500 text-[10px]">
                • Set reminders for your appointments
              </Text>
              <Text className="text-gray-500 text-[10px]">
                • Contact the shop if you're running late
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
