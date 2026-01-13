import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { TimeSlotPickerProps } from "../types";

export default function TimeSlotPicker({
  timeSlots,
  selectedTime,
  isLoading,
  error,
  onTimeSelect,
}: TimeSlotPickerProps) {
  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="small" color="#FFCC00" />
        <Text className="text-gray-400 text-sm mt-2">
          Loading available times...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="py-8 items-center">
        <Feather name="alert-circle" size={24} color="#ef4444" />
        <Text className="text-gray-400 text-sm mt-2">
          Failed to load time slots
        </Text>
      </View>
    );
  }

  if (!timeSlots || timeSlots.length === 0) {
    return (
      <View className="py-8 items-center">
        <Ionicons name="calendar-outline" size={24} color="#666" />
        <Text className="text-gray-400 text-sm mt-2">
          No available times for this date
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {timeSlots.map((slot, index) => {
        const isSelected = selectedTime === slot.time;
        const isAvailable = slot.available;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => isAvailable && onTimeSelect(slot.time)}
            disabled={!isAvailable}
            className={`mr-3 px-5 py-3 rounded-xl ${
              isSelected
                ? "bg-[#FFCC00]"
                : isAvailable
                ? "bg-zinc-900 border border-zinc-800"
                : "bg-zinc-900/50 border border-zinc-800/50"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isSelected
                  ? "text-black"
                  : isAvailable
                  ? "text-white"
                  : "text-gray-600"
              }`}
            >
              {formatTime12Hour(slot.time)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
