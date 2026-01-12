import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { BookingData } from "@/interfaces/booking.interfaces";
import { router } from "expo-router";

// Hooks
import {
  useBookingsData,
  useBookingsFilter,
  useCalendarUI,
  getStatusColor,
  formatBookingTime,
  isToday,
  isDateSelected,
  getDaysInMonth,
  getScrollableDays,
} from "../hooks";
import { BOOKING_STATUS_FILTERS, DAYS, MONTHS, YEARS } from "../constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;

interface BookingCalendarProps {
  getBookingsForDate: (date: Date) => BookingData[];
}

function BookingCalendar({ getBookingsForDate }: BookingCalendarProps) {
  const {
    selectedDate,
    setSelectedDate,
    showFullCalendar,
    openFullCalendar,
    closeFullCalendar,
    showYearMonthPicker,
    setShowYearMonthPicker,
    calendarMonth,
    goToPreviousMonth,
    goToNextMonth,
    selectYear,
    selectMonth,
    selectDateFromCalendar,
    goToToday,
  } = useCalendarUI();

  const scrollableDays = getScrollableDays();
  const selectedBookings = getBookingsForDate(selectedDate);

  return (
    <View className="flex-1">
      {/* Header with month and calendar button */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-lg font-semibold">
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={openFullCalendar}
            className="bg-[#1a1a1a] p-2 rounded-lg flex-row items-center"
          >
            <Ionicons name="calendar" size={18} color="#FFCC00" />
            <Text className="text-[#FFCC00] text-xs font-medium ml-1">
              Full Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Week Strip */}
      <View className="mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          contentOffset={{ x: 42 * DAY_WIDTH - SCREEN_WIDTH / 2 + DAY_WIDTH / 2, y: 0 }}
        >
          {scrollableDays.map((date, idx) => {
            const dayBookings = getBookingsForDate(date);
            const hasBookings = dayBookings.length > 0;
            const selected = isDateSelected(date, selectedDate);
            const today = isToday(date);

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDate(new Date(date))}
                className="items-center"
                style={{ width: DAY_WIDTH }}
              >
                <Text
                  className={`text-xs mb-1 ${
                    today ? "text-[#FFCC00]" : "text-gray-500"
                  }`}
                >
                  {DAYS[date.getDay()]}
                </Text>
                <View
                  className={`items-center justify-center ${
                    selected
                      ? "bg-[#FFCC00]"
                      : today
                      ? "bg-[#FFCC00]/20 border border-[#FFCC00]"
                      : "bg-[#1a1a1a]"
                  }`}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                  }}
                >
                  <Text
                    className={`text-base font-semibold ${
                      selected
                        ? "text-black"
                        : today
                        ? "text-[#FFCC00]"
                        : "text-white"
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {hasBookings && (
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    {dayBookings.slice(0, 3).map((b, i) => (
                      <View
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: getStatusColor(b.status),
                          marginHorizontal: 1,
                        }}
                      />
                    ))}
                  </View>
                )}
                {!hasBookings && <View className="h-2.5 mt-1" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Date Header */}
      <View className="px-4 mb-3">
        <Text className="text-white font-semibold">
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
        <Text className="text-gray-500 text-sm">
          {selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Bookings for Selected Date */}
      <ScrollView className="flex-1 px-4">
        {selectedBookings.length === 0 ? (
          <View className="items-center justify-center py-12 bg-[#1a1a1a] rounded-xl">
            <Ionicons name="calendar-outline" size={48} color="#333" />
            <Text className="text-gray-500 mt-3">No bookings for this day</Text>
          </View>
        ) : (
          selectedBookings.map((booking, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => router.push(`/shop/service/${booking.serviceId}`)}
              className="bg-[#1a1a1a] rounded-xl p-4 mb-3 border-l-4"
              style={{ borderLeftColor: getStatusColor(booking.status) }}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base" numberOfLines={1}>
                    {booking.serviceName}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Feather name="user" size={12} color="#666" />
                    <Text className="text-gray-400 text-sm ml-1">
                      {booking.customerName || `${booking.customerAddress.slice(0, 6)}...${booking.customerAddress.slice(-4)}`}
                    </Text>
                  </View>
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="time-outline" size={14} color="#FFCC00" />
                    <Text className="text-[#FFCC00] text-sm ml-1 font-medium">
                      {formatBookingTime(booking.bookingDate || booking.createdAt)}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <View
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: getStatusColor(booking.status) + "20" }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: getStatusColor(booking.status) }}
                    >
                      {booking.status}
                    </Text>
                  </View>
                  <Text className="text-[#FFCC00] font-semibold mt-2">
                    ${booking.totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Legend */}
        <View className="flex-row justify-center mt-4 mb-6">
          <View className="flex-row items-center mr-4">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#eab308', marginRight: 4 }} />
            <Text className="text-gray-500 text-xs">Pending</Text>
          </View>
          <View className="flex-row items-center mr-4">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 4 }} />
            <Text className="text-gray-500 text-xs">Paid</Text>
          </View>
          <View className="flex-row items-center">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 4 }} />
            <Text className="text-gray-500 text-xs">Completed</Text>
          </View>
        </View>
      </ScrollView>

      {/* Full Calendar Modal */}
      <Modal
        visible={showFullCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={closeFullCalendar}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#121212] rounded-t-3xl pt-4 pb-8 px-4">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity onPress={closeFullCalendar} className="p-2">
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">
                Select Date
              </Text>
              <TouchableOpacity onPress={goToToday} className="p-2">
                <Text className="text-[#FFCC00] font-medium">Today</Text>
              </TouchableOpacity>
            </View>

            {/* Month/Year Selector */}
            {showYearMonthPicker ? (
              <View className="mb-4">
                {/* Year Selector */}
                <Text className="text-gray-400 text-xs mb-2 text-center">Select Year</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 8 }}
                  className="mb-4"
                >
                  <View className="flex-row gap-2">
                    {YEARS.map((year) => (
                      <TouchableOpacity
                        key={year}
                        onPress={() => selectYear(year)}
                        className={`px-4 py-2 rounded-full ${
                          calendarMonth.getFullYear() === year
                            ? "bg-[#FFCC00]"
                            : "bg-[#1a1a1a]"
                        }`}
                      >
                        <Text
                          className={`font-medium ${
                            calendarMonth.getFullYear() === year
                              ? "text-black"
                              : "text-white"
                          }`}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Month Selector */}
                <Text className="text-gray-400 text-xs mb-2 text-center">Select Month</Text>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {MONTHS.map((month, idx) => (
                    <TouchableOpacity
                      key={month}
                      onPress={() => selectMonth(idx)}
                      className={`px-3 py-2 rounded-lg ${
                        calendarMonth.getMonth() === idx
                          ? "bg-[#FFCC00]"
                          : "bg-[#1a1a1a]"
                      }`}
                      style={{ width: "30%" }}
                    >
                      <Text
                        className={`text-center text-sm font-medium ${
                          calendarMonth.getMonth() === idx
                            ? "text-black"
                            : "text-white"
                        }`}
                      >
                        {month.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  onPress={goToPreviousMonth}
                  className="p-2"
                  disabled={calendarMonth.getFullYear() === 2024 && calendarMonth.getMonth() === 0}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={calendarMonth.getFullYear() === 2024 && calendarMonth.getMonth() === 0 ? "#333" : "#FFCC00"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowYearMonthPicker(true)}
                  className="flex-row items-center bg-[#1a1a1a] px-4 py-2 rounded-lg"
                >
                  <Text className="text-white text-lg font-semibold">
                    {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#FFCC00" className="ml-1" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goToNextMonth}
                  className="p-2"
                  disabled={calendarMonth.getFullYear() === 2030 && calendarMonth.getMonth() === 11}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={24}
                    color={calendarMonth.getFullYear() === 2030 && calendarMonth.getMonth() === 11 ? "#333" : "#FFCC00"}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Day Headers & Calendar Grid - only show when not in picker mode */}
            {!showYearMonthPicker && (
              <>
                {/* Day Headers */}
                <View className="flex-row mb-2">
                  {DAYS.map((day) => (
                    <View key={day} className="flex-1">
                      <Text className="text-gray-500 text-xs text-center font-medium">
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View className="flex-row flex-wrap">
                  {(() => {
                    const { firstDay, daysInMonth } = getDaysInMonth(calendarMonth);
                    const cells = [];

                    // Empty cells
                    for (let i = 0; i < firstDay; i++) {
                      cells.push(
                        <View key={`empty-${i}`} className="w-[14.28%] h-12" />
                      );
                    }

                    // Day cells
                    for (let day = 1; day <= daysInMonth; day++) {
                      const cellDate = new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth(),
                        day
                      );
                      const dayBookings = getBookingsForDate(cellDate);
                      const hasBookings = dayBookings.length > 0;
                      const today = isToday(cellDate);
                      const selected = isDateSelected(cellDate, selectedDate);

                      cells.push(
                        <TouchableOpacity
                          key={day}
                          onPress={() => selectDateFromCalendar(day)}
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
                              className={`text-base ${
                                selected
                                  ? "text-black font-bold"
                                  : today
                                  ? "text-[#FFCC00] font-semibold"
                                  : "text-white"
                              }`}
                            >
                              {day}
                            </Text>
                            {hasBookings && !selected && (
                              <View style={{ position: 'absolute', bottom: 2, flexDirection: 'row' }}>
                                {dayBookings.slice(0, 2).map((b, i) => (
                                  <View
                                    key={i}
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: getStatusColor(b.status),
                                      marginHorizontal: 1,
                                    }}
                                  />
                                ))}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    }

                    return cells;
                  })()}
                </View>

                {/* Legend */}
                <View className="flex-row justify-center mt-4">
                  <View className="flex-row items-center mr-4">
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#eab308', marginRight: 4 }} />
                    <Text className="text-gray-500 text-xs">Pending</Text>
                  </View>
                  <View className="flex-row items-center mr-4">
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 4 }} />
                    <Text className="text-gray-500 text-xs">Paid</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 4 }} />
                    <Text className="text-gray-500 text-xs">Completed</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function BookingsTab() {
  // UI state
  const { statusFilter, setStatusFilter } = useBookingsFilter();

  // Data fetching
  const { isLoading, getBookingsForDate } = useBookingsData(statusFilter);

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Status Filters */}
      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {BOOKING_STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full ${
                  statusFilter === filter.value
                    ? "bg-[#FFCC00]"
                    : "bg-[#1a1a1a] border border-[#333]"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    statusFilter === filter.value
                      ? "text-black"
                      : "text-gray-400"
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ffcc00" />
        </View>
      ) : (
        <BookingCalendar getBookingsForDate={getBookingsForDate} />
      )}
    </View>
  );
}
