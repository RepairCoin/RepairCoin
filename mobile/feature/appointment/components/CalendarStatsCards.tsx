import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CalendarBooking } from "@/shared/interfaces/appointment.interface";

interface CalendarStatsCardsProps {
  bookings: CalendarBooking[];
}

interface StatItem {
  label: string;
  count: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function CalendarStatsCards({ bookings }: CalendarStatsCardsProps) {
  const pending = bookings.filter((b) => b.status === "pending").length;
  const paid = bookings.filter(
    (b) => b.status === "paid" || b.status === "confirmed"
  ).length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const cancelled = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "refunded"
  ).length;

  const stats: StatItem[] = [
    { label: "Pending", count: pending, color: "#eab308", icon: "time-outline" },
    { label: "Confirmed", count: paid, color: "#3b82f6", icon: "checkmark-circle-outline" },
    { label: "Completed", count: completed, color: "#22c55e", icon: "checkmark-done-outline" },
    { label: "Cancelled", count: cancelled, color: "#ef4444", icon: "close-circle-outline" },
  ];

  return (
    <View className="flex-row flex-wrap mb-4">
      {stats.map((stat) => (
        <View key={stat.label} className="w-1/2 p-1">
          <View className="bg-[#1a1a1a] rounded-xl p-3 flex-row items-center">
            <View
              className="w-9 h-9 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: stat.color + "20" }}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color} />
            </View>
            <View>
              <Text className="text-white text-lg font-bold">{stat.count}</Text>
              <Text className="text-gray-500 text-xs">{stat.label}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
