import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Calendar, DateData } from "react-native-calendars";
import { TimeSlot } from "@/interfaces/appointment.interface";

interface ScheduleScreenProps {
  selectedDate: string;
  selectedTime: string | null;
  timeSlots: TimeSlot[] | undefined;
  isLoadingSlots: boolean;
  slotsError: Error | null;
  onDateSelect: (day: DateData) => void;
  onTimeSelect: (time: string) => void;
}

export default function ScheduleScreen({
  selectedDate,
  selectedTime,
  timeSlots,
  isLoadingSlots,
  slotsError,
  onDateSelect,
  onTimeSelect,
}: ScheduleScreenProps) {
  // Get today's date in YYYY-MM-DD format for calendar
  const today = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Get max date (30 days from now)
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split("T")[0];
  }, []);

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

  return (
    <>
      {/* Schedule Appointment Section */}
      <View className="px-4 mb-6">
        <Text className="text-white text-lg font-semibold mb-1">
          Select Date
        </Text>
        <Text className="text-gray-400 text-sm mb-4">
          Choose your preferred date to view available time
        </Text>

        {/* Calendar Date Selector */}
        <View className="mb-4 bg-zinc-900 rounded-2xl overflow-hidden">
          <Calendar
            onDayPress={onDateSelect}
            minDate={today}
            maxDate={maxDate}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: "#FFCC00",
                selectedTextColor: "#000000",
              },
            }}
            theme={{
              backgroundColor: "#18181b",
              calendarBackground: "#18181b",
              textSectionTitleColor: "#9CA3AF",
              selectedDayBackgroundColor: "#FFCC00",
              selectedDayTextColor: "#000000",
              todayTextColor: "#FFCC00",
              dayTextColor: "#ffffff",
              textDisabledColor: "#3f3f46",
              arrowColor: "#FFCC00",
              monthTextColor: "#ffffff",
              textDayFontWeight: "500",
              textMonthFontWeight: "bold",
              textDayHeaderFontWeight: "500",
            }}
          />
        </View>

        {/* Time Selector */}
        {selectedDate && (
          <View className="mt-2">
            <Text className="text-white text-lg font-semibold mb-1">
              Select Time
            </Text>
            <Text className="text-gray-400 text-sm mb-4">
              {formatDateFull(selectedDate)}
            </Text>

            {isLoadingSlots ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#FFCC00" />
                <Text className="text-gray-400 text-sm mt-2">
                  Loading available times...
                </Text>
              </View>
            ) : slotsError ? (
              <View className="py-8 items-center">
                <Feather name="alert-circle" size={24} color="#ef4444" />
                <Text className="text-gray-400 text-sm mt-2">
                  Failed to load time slots
                </Text>
              </View>
            ) : timeSlots && timeSlots.length > 0 ? (
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
            ) : (
              <View className="py-8 items-center">
                <Ionicons name="calendar-outline" size={24} color="#666" />
                <Text className="text-gray-400 text-sm mt-2">
                  No available times for this date
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Selected Appointment Summary */}
      {selectedDate && selectedTime && (
        <View className="mx-4 mb-6 p-4 bg-zinc-900 rounded-xl border border-[#FFCC00]/30">
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
      )}
    </>
  );
}
