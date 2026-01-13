import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppointmentSummaryCardProps } from "../types";

export default function AppointmentSummaryCard({
  selectedDate,
  selectedTime,
  title = "Your Appointment",
  variant = "default",
}: AppointmentSummaryCardProps) {
  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const containerClass = variant === "highlighted"
    ? "p-4 bg-zinc-900 rounded-xl border border-[#FFCC00]/30"
    : "p-4 bg-zinc-900 rounded-xl border border-zinc-800";

  return (
    <View className={containerClass}>
      {title && (
        <Text className="text-gray-400 text-xs uppercase mb-2">
          {title}
        </Text>
      )}
      <View className="flex-row items-center">
        <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
          <Ionicons name="calendar" size={20} color="#FFCC00" />
        </View>
        <View>
          <Text className="text-white font-medium">
            {formatDateFull(selectedDate)}
          </Text>
          <Text className="text-[#FFCC00] text-lg font-bold">
            {formatTime12Hour(selectedTime)}
          </Text>
        </View>
      </View>
    </View>
  );
}
