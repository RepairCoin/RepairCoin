import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CalendarBooking } from "@/shared/interfaces/appointment.interface";
import { getStatusColor } from "../utils/statusUtils";
import { getDaysInMonth } from "../utils/calendarUtils";
import { isToday, isDateSelected } from "../utils/dateUtils";
import { DAYS } from "../constants";

interface MonthlyCalendarViewProps {
  currentMonth: Date;
  selectedDate: Date;
  bookings: CalendarBooking[];
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

function getBookingsForDate(
  bookings: CalendarBooking[],
  date: Date
): CalendarBooking[] {
  return bookings.filter((b) => {
    const d = new Date(b.bookingDate + "T00:00:00");
    return (
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  });
}

export default function MonthlyCalendarView({
  currentMonth,
  selectedDate,
  bookings,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: MonthlyCalendarViewProps) {
  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Build calendar cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View className="bg-[#1a1a1a] rounded-2xl p-4 mb-4">
      {/* Month Navigation */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={onPrevMonth}
          className="w-9 h-9 rounded-full bg-[#121212] items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#FFCC00" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onToday} className="flex-row items-center">
          <Text className="text-white text-lg font-bold">{monthName}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNextMonth}
          className="w-9 h-9 rounded-full bg-[#121212] items-center justify-center"
        >
          <Ionicons name="chevron-forward" size={20} color="#FFCC00" />
        </TouchableOpacity>
      </View>

      {/* Today button */}
      <TouchableOpacity
        onPress={onToday}
        className="self-center mb-3 px-3 py-1 rounded-full bg-[#FFCC00]/10"
      >
        <Text className="text-[#FFCC00] text-xs font-medium">Today</Text>
      </TouchableOpacity>

      {/* Day Headers */}
      <View className="flex-row mb-2">
        {DAYS.map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className="text-gray-500 text-xs font-medium">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} className="w-[14.28%] h-12" />;
          }

          const cellDate = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            day
          );
          const dayBookings = getBookingsForDate(bookings, cellDate);
          const today = isToday(cellDate);
          const selected = isDateSelected(cellDate, selectedDate);

          return (
            <TouchableOpacity
              key={`day-${day}`}
              onPress={() => onSelectDate(cellDate)}
              className="w-[14.28%] h-12 items-center justify-center"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  selected
                    ? "bg-[#FFCC00]"
                    : today
                    ? "bg-[#FFCC00]/20 border border-[#FFCC00]"
                    : ""
                }`}
              >
                <Text
                  className={`text-sm ${
                    selected
                      ? "text-black font-bold"
                      : today
                      ? "text-[#FFCC00] font-semibold"
                      : "text-white"
                  }`}
                >
                  {day}
                </Text>

                {/* Booking indicator dots */}
                {dayBookings.length > 0 && !selected && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 2,
                      flexDirection: "row",
                    }}
                  >
                    {dayBookings.slice(0, 3).map((b, i) => (
                      <View
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: getStatusColor(b.status as any),
                          marginHorizontal: 0.5,
                        }}
                      />
                    ))}
                  </View>
                )}

                {/* Booking count badge for selected date */}
                {dayBookings.length > 0 && selected && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      backgroundColor: "#ef4444",
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: "700",
                      }}
                    >
                      {dayBookings.length}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row flex-wrap justify-center mt-3 gap-3">
        {[
          { label: "Pending", color: "#eab308" },
          { label: "Paid", color: "#3b82f6" },
          { label: "Completed", color: "#22c55e" },
          { label: "Cancelled", color: "#ef4444" },
        ].map((item) => (
          <View key={item.label} className="flex-row items-center">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.color,
                marginRight: 4,
              }}
            />
            <Text className="text-gray-500 text-xs">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
