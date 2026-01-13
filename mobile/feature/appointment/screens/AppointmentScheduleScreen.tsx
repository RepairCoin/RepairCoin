import { useMemo } from "react";
import { View, Text } from "react-native";
import { Calendar } from "react-native-calendars";
import { TimeSlotPicker, AppointmentSummaryCard } from "../components";
import { AppointmentScheduleScreenProps } from "../types";

export default function AppointmentScheduleScreen({
  selectedDate,
  selectedTime,
  timeSlots,
  isLoadingSlots,
  slotsError,
  shopAvailability,
  onDateSelect,
  onTimeSelect,
}: AppointmentScheduleScreenProps) {
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

  // Check if a date is available based on shop operating hours
  const isDateAvailable = (date: Date): boolean => {
    if (!shopAvailability) return true;
    const dayOfWeek = date.getDay();
    const dayAvailability = shopAvailability.find(a => a.dayOfWeek === dayOfWeek);
    return dayAvailability?.isOpen || false;
  };

  // Generate marked dates with unavailable days disabled
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    if (selectedDate) {
      marks[selectedDate] = {
        selected: true,
        selectedColor: "#FFCC00",
        selectedTextColor: "#000000",
      };
    }

    if (shopAvailability) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split("T")[0];
        if (!isDateAvailable(d)) {
          marks[dateString] = {
            ...marks[dateString],
            disabled: true,
            disableTouchEvent: true,
          };
        }
      }
    }

    return marks;
  }, [selectedDate, shopAvailability]);

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <View className="px-4 mb-6">
        <Text className="text-white text-lg font-semibold mb-1">
          Select Date
        </Text>
        <Text className="text-gray-400 text-sm mb-4">
          Choose your preferred date to view available time
        </Text>

        <View className="mb-4 bg-zinc-900 rounded-2xl overflow-hidden">
          <Calendar
            onDayPress={onDateSelect}
            minDate={today}
            maxDate={maxDate}
            markedDates={markedDates}
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

        {selectedDate && (
          <View className="mt-2">
            <Text className="text-white text-lg font-semibold mb-1">
              Select Time
            </Text>
            <Text className="text-gray-400 text-sm mb-4">
              {formatDateFull(selectedDate)}
            </Text>

            <TimeSlotPicker
              timeSlots={timeSlots}
              selectedTime={selectedTime}
              isLoading={isLoadingSlots}
              error={slotsError}
              onTimeSelect={onTimeSelect}
            />
          </View>
        )}
      </View>

      {selectedDate && selectedTime && (
        <View className="mx-4 mb-6">
          <AppointmentSummaryCard
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            title=""
            variant="highlighted"
          />
        </View>
      )}
    </>
  );
}
