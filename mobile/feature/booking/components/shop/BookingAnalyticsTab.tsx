import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useBookingAnalyticsUI } from "../../hooks";
import { TrendDays } from "../../types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  paid: "#3B82F6",
  completed: "#22C55E",
  cancelled: "#EF4444",
  no_show: "#F59E0B",
  pending: "#6B7280",
};

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  emergency: "Personal emergency",
  schedule_conflict: "Schedule conflict",
  too_expensive: "Too expensive",
  found_alternative: "Found alternative",
  changed_mind: "Changed mind",
  customer_request: "Customer requested",
  no_show: "Customer no-show",
  "shop:customer_request": "Customer requested (by shop)",
  "shop:schedule_conflict": "Schedule conflict (by shop)",
  "shop:emergency": "Emergency (by shop)",
  "shop:no_show": "No-show (by shop)",
  "shop:service_unavailable": "Service unavailable (by shop)",
  "shop:capacity_issues": "Capacity issues (by shop)",
  "shop:other": "Other (by shop)",
  "Not specified": "Not specified",
};

function formatCancellationReason(reason: string): string {
  if (CANCELLATION_REASON_LABELS[reason]) return CANCELLATION_REASON_LABELS[reason];
  if (reason.startsWith("Auto-cancelled:")) return reason;
  if (reason.startsWith("shop:")) {
    const inner = reason
      .slice(5)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${inner} (by shop)`;
  }
  return reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

const TREND_OPTIONS: TrendDays[] = [7, 30, 90];

export default function BookingAnalyticsTab() {
  const { analytics, isLoading, error, trendDays, setTrendDays, refetch } =
    useBookingAnalyticsUI();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (isLoading && !analytics) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading analytics...</Text>
      </View>
    );
  }

  if (error && !analytics) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-white text-lg font-semibold mt-4">
          Failed to load analytics
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          {error instanceof Error ? error.message : "An error occurred"}
        </Text>
        <Pressable
          onPress={refetch}
          className="mt-6 bg-[#FFCC00] px-6 py-3 rounded-xl"
        >
          <Text className="text-black font-semibold">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!analytics) return null;

  const { summary, statusBreakdown, busiestDays, peakHours, cancellationReasons, bookingTrends } =
    analytics;
  const totalStatusCount = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const maxDayCount = Math.max(...busiestDays.map((d) => d.count), 1);
  const maxHourCount = Math.max(...peakHours.map((h) => h.count), 1);

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FFCC00"
          colors={["#FFCC00"]}
        />
      }
    >
      {/* Time Range Selector */}
      <View className="flex-row gap-2 mb-4">
        {TREND_OPTIONS.map((days) => (
          <Pressable
            key={days}
            onPress={() => setTrendDays(days)}
            className={`flex-1 py-2 rounded-lg items-center ${
              trendDays === days
                ? "bg-[#FFCC00]"
                : "bg-[#1a1a1a] border border-gray-800"
            }`}
          >
            <Text
              className={`font-semibold text-sm ${
                trendDays === days ? "text-black" : "text-gray-400"
              }`}
            >
              {days} Days
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary Cards */}
      <View className="flex-row flex-wrap mb-4">
        <View className="w-1/2 pr-1.5 mb-3">
          <View className="bg-[#1a1a1a] rounded-xl p-4 flex-row items-center">
            <View className="p-2 bg-blue-500/20 rounded-lg mr-3">
              <Ionicons name="calendar-outline" size={20} color="#60A5FA" />
            </View>
            <View>
              <Text className="text-gray-400 text-xs">Total Bookings</Text>
              <Text className="text-white text-xl font-bold">
                {summary.totalBookings}
              </Text>
            </View>
          </View>
        </View>
        <View className="w-1/2 pl-1.5 mb-3">
          <View className="bg-[#1a1a1a] rounded-xl p-4 flex-row items-center">
            <View className="p-2 bg-green-500/20 rounded-lg mr-3">
              <Ionicons name="checkmark-circle-outline" size={20} color="#4ADE80" />
            </View>
            <View>
              <Text className="text-gray-400 text-xs">Completion Rate</Text>
              <Text className="text-white text-xl font-bold">
                {summary.completionRate.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
        <View className="w-1/2 pr-1.5">
          <View className="bg-[#1a1a1a] rounded-xl p-4 flex-row items-center">
            <View className="p-2 bg-yellow-500/20 rounded-lg mr-3">
              <Ionicons name="alert-circle-outline" size={20} color="#FACC15" />
            </View>
            <View>
              <Text className="text-gray-400 text-xs">No-Show Rate</Text>
              <Text className="text-white text-xl font-bold">
                {summary.noShowRate.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
        <View className="w-1/2 pl-1.5">
          <View className="bg-[#1a1a1a] rounded-xl p-4 flex-row items-center">
            <View className="p-2 bg-purple-500/20 rounded-lg mr-3">
              <Ionicons name="time-outline" size={20} color="#A78BFA" />
            </View>
            <View>
              <Text className="text-gray-400 text-xs">Avg Lead Time</Text>
              <Text className="text-white text-xl font-bold">
                {summary.avgLeadTimeDays.toFixed(1)}d
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Status Breakdown */}
      {totalStatusCount > 0 && (
        <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="people-outline" size={18} color="#FFCC00" />
            <Text className="text-white font-bold text-base ml-2">
              Status Breakdown
            </Text>
          </View>
          {/* Bar */}
          <View className="flex-row h-6 rounded-lg overflow-hidden mb-3">
            {statusBreakdown.map((s) => {
              const pct = (s.count / totalStatusCount) * 100;
              if (pct === 0) return null;
              return (
                <View
                  key={s.status}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: STATUS_COLORS[s.status] || "#6B7280",
                  }}
                />
              );
            })}
          </View>
          {/* Legend */}
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            {statusBreakdown.map((s) => (
              <View key={s.status} className="flex-row items-center">
                <View
                  className="w-2.5 h-2.5 rounded-full mr-1.5"
                  style={{
                    backgroundColor: STATUS_COLORS[s.status] || "#6B7280",
                  }}
                />
                <Text className="text-gray-400 text-xs capitalize">
                  {s.status.replace("_", " ")}: {s.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Busiest Days */}
      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <Ionicons name="calendar-outline" size={18} color="#FFCC00" />
          <Text className="text-white font-bold text-base ml-2">
            Busiest Days
          </Text>
        </View>
        {busiestDays.length > 0 ? (
          busiestDays.map((d) => (
            <View key={d.dayOfWeek} className="flex-row items-center mb-2">
              <Text className="text-gray-400 text-xs w-8">
                {DAY_NAMES[d.dayOfWeek]}
              </Text>
              <View className="flex-1 bg-gray-800 rounded-full h-5 mx-2 overflow-hidden">
                <View
                  className="h-full bg-[#FFCC00] rounded-full"
                  style={{
                    width: `${(d.count / maxDayCount) * 100}%`,
                  }}
                />
              </View>
              <Text className="text-white text-xs font-medium w-6 text-right">
                {d.count}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-gray-500 text-sm">No data available</Text>
        )}
      </View>

      {/* Peak Hours */}
      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <Ionicons name="time-outline" size={18} color="#FFCC00" />
          <Text className="text-white font-bold text-base ml-2">
            Peak Hours
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => {
            const entry = peakHours.find((h) => h.hour === hour);
            const count = entry?.count || 0;
            const opacity =
              maxHourCount > 0 ? Math.max(0.1, count / maxHourCount) : 0.1;
            return (
              <View
                key={hour}
                className="items-center justify-center p-1.5 rounded-lg border border-gray-800"
                style={{
                  backgroundColor: `rgba(255, 204, 0, ${opacity})`,
                  width: "23%",
                }}
              >
                <Text className="text-gray-400 text-[10px]">
                  {formatHour(hour)}
                </Text>
                <Text className="text-white text-sm font-bold">{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Cancellation Insights */}
      {cancellationReasons.length > 0 && (
        <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            <Text className="text-white font-bold text-base ml-2">
              Cancellation Insights
            </Text>
          </View>
          {cancellationReasons.map((r, i) => (
            <View
              key={i}
              className={`flex-row items-center justify-between py-2.5 ${
                i < cancellationReasons.length - 1
                  ? "border-b border-gray-800"
                  : ""
              }`}
            >
              <Text className="text-gray-300 text-sm flex-1 mr-2">
                {formatCancellationReason(r.reason)}
              </Text>
              <View className="bg-red-500/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-semibold">
                  {r.count}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Booking Trends */}
      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <Ionicons name="trending-up-outline" size={18} color="#FFCC00" />
          <Text className="text-white font-bold text-base ml-2">
            Booking Trends (Last {trendDays} Days)
          </Text>
        </View>
        {bookingTrends.length > 0 ? (
          <>
            {/* Header */}
            <View className="flex-row pb-2 mb-1 border-b border-gray-800">
              <Text className="flex-1 text-gray-400 text-xs font-medium">
                Date
              </Text>
              <Text className="text-gray-400 text-xs font-medium text-right w-16">
                Bookings
              </Text>
            </View>
            {bookingTrends.slice(0, 10).map((t) => (
              <View
                key={t.date}
                className="flex-row py-2 border-b border-gray-800/50"
              >
                <Text className="flex-1 text-gray-300 text-xs">
                  {new Date(t.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text className="text-white text-xs font-medium text-right w-16">
                  {t.count}
                </Text>
              </View>
            ))}
            {bookingTrends.length > 10 && (
              <Text className="text-gray-500 text-xs mt-2 text-center">
                Showing 10 of {bookingTrends.length} entries
              </Text>
            )}
          </>
        ) : (
          <Text className="text-gray-500 text-sm">No trend data available</Text>
        )}
      </View>

      {/* Reschedule Stats */}
      <View className="bg-[#1a1a1a] rounded-xl p-4">
        <View className="flex-row items-center mb-3">
          <Ionicons name="refresh-outline" size={18} color="#FFCC00" />
          <Text className="text-white font-bold text-base ml-2">
            Reschedule Stats
          </Text>
        </View>
        <View className="flex-row">
          <View className="flex-1 mr-2">
            <Text className="text-gray-400 text-xs mb-1">Total Rescheduled</Text>
            <Text className="text-white text-xl font-bold">
              {summary.rescheduledCount}
            </Text>
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-gray-400 text-xs mb-1">
              Avg per Booking
            </Text>
            <Text className="text-white text-xl font-bold">
              {summary.avgRescheduleCount.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
