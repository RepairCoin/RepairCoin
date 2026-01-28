import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MyAppointment } from "@/shared/interfaces/appointment.interface";
import { getStatusConfig } from "../constants";
import { canCancelAppointment } from "../hooks";

interface AppointmentCardProps {
  appointment: MyAppointment;
  onPress: () => void;
  onCancel: () => void;
  onReview: () => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    date: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }),
    year: date.getFullYear(),
  };
};

const formatTime = (timeString: string | null) => {
  if (!timeString) return "TBD";
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const getIconColor = (textColor: string) => {
  const colorMap: Record<string, string> = {
    "text-yellow-500": "#EAB308",
    "text-blue-500": "#3B82F6",
    "text-emerald-500": "#10B981",
    "text-green-500": "#22C55E",
    "text-red-500": "#EF4444",
    "text-gray-500": "#6B7280",
  };
  return colorMap[textColor] || "#6B7280";
};

export function AppointmentCard({ appointment, onPress, onCancel, onReview }: AppointmentCardProps) {
  const statusConfig = getStatusConfig(appointment.status);
  const dateInfo = formatDate(appointment.bookingDate);
  const isUpcoming = new Date(appointment.bookingDate) >= new Date();
  const showCancelButton = canCancelAppointment(appointment);
  const isCompleted = appointment.status.toLowerCase() === "completed";
  const canReview = isCompleted && !appointment.hasReview;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-zinc-900 rounded-2xl mb-3 overflow-hidden"
    >
      <View className="flex-row">
        {/* Date Column */}
        <View
          className={`w-20 items-center justify-center py-4 ${isUpcoming ? "bg-[#FFCC00]" : "bg-zinc-800"}`}
        >
          <Text
            className={`text-xs font-medium ${isUpcoming ? "text-black/60" : "text-gray-400"}`}
          >
            {dateInfo.day}
          </Text>
          <Text
            className={`text-2xl font-bold ${isUpcoming ? "text-black" : "text-white"}`}
          >
            {dateInfo.date}
          </Text>
          <Text
            className={`text-xs font-medium ${isUpcoming ? "text-black/60" : "text-gray-400"}`}
          >
            {dateInfo.month}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 p-4">
          {/* Status Badge */}
          <View className="flex-row items-center justify-between mb-2">
            <View
              className={`flex-row items-center px-2 py-1 rounded-full ${statusConfig.bgColor}`}
            >
              <Ionicons
                name={statusConfig.icon}
                size={12}
                color={getIconColor(statusConfig.textColor)}
              />
              <Text
                className={`text-xs font-medium ml-1 capitalize ${statusConfig.textColor}`}
              >
                {appointment.status}
              </Text>
            </View>
            <Text className="text-[#FFCC00] font-bold">
              ${appointment.totalAmount}
            </Text>
          </View>

          {/* Service Name */}
          <Text className="text-white text-base font-semibold mb-1" numberOfLines={1}>
            {appointment.serviceName}
          </Text>

          {/* Time */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#FFCC00" />
            <Text className="text-white text-sm ml-1">
              {formatTime(appointment.bookingTimeSlot)}
              {appointment.bookingEndTime &&
                ` - ${formatTime(appointment.bookingEndTime)}`}
            </Text>
          </View>

          {/* Cancel Button */}
          {showCancelButton && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="mt-3 flex-row items-center justify-center py-2 rounded-lg bg-red-500/20"
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text className="text-red-500 text-sm font-medium ml-1">
                Cancel Appointment
              </Text>
            </TouchableOpacity>
          )}

          {/* Review Button for completed bookings */}
          {canReview && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onReview();
              }}
              className="mt-3 flex-row items-center justify-center py-2 rounded-lg bg-[#FFCC00]/20"
            >
              <Ionicons name="star" size={16} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-sm font-medium ml-1">
                Write Review
              </Text>
            </TouchableOpacity>
          )}

          {/* Already reviewed indicator */}
          {isCompleted && appointment.hasReview && (
            <View className="mt-3 flex-row items-center justify-center py-2 rounded-lg bg-green-500/20">
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text className="text-green-500 text-sm font-medium ml-1">
                Reviewed
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Export date formatting utilities
export { formatDate, formatTime };
