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
import { useBooking } from "@/hooks/booking/useBooking";
import { BookingData, BookingStatus } from "@/interfaces/booking.interfaces";
import { router } from "expo-router";
import { useState, useMemo } from "react";

type FilterStatus = "all" | BookingStatus;

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Completed", value: "completed" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getStatusColor = (status: BookingStatus) => {
  switch (status) {
    case "completed": return "#22c55e";
    case "paid": return "#3b82f6";
    case "pending": return "#eab308";
    case "cancelled": return "#ef4444";
    default: return "#666";
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

function BookingCalendar({ bookings }: { bookings: BookingData[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Generate 12 weeks (6 before, current, 5 after) for scrolling
  const getScrollableDays = () => {
    const days: Date[] = [];
    const today = new Date();
    const currentDay = today.getDay();

    // Start from 6 weeks ago (Sunday of that week)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDay - 42);

    // Generate 84 days (12 weeks)
    for (let i = 0; i < 84; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const scrollableDays = getScrollableDays();

  const getBookingsForDate = (date: Date) => {
    return bookings.filter((booking) => {
      const bookingDate = booking.bookingDate
        ? new Date(booking.bookingDate)
        : new Date(booking.createdAt);
      return (
        bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate()
      );
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const selectedBookings = getBookingsForDate(selectedDate);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Full Calendar Modal helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const handleDateSelectFromCalendar = (day: number) => {
    const newDate = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      day
    );
    setSelectedDate(newDate);
    setShowFullCalendar(false);
  };

  return (
    <View className="flex-1">
      {/* Header with month and calendar button */}
      <View className="px-4 mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-lg font-semibold">
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setCalendarMonth(selectedDate);
              setShowFullCalendar(true);
            }}
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
            const selected = isSelected(date);
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
                  className={`w-11 h-11 rounded-full items-center justify-center ${
                    selected
                      ? "bg-[#FFCC00]"
                      : today
                      ? "bg-[#FFCC00]/20 border border-[#FFCC00]"
                      : "bg-[#1a1a1a]"
                  }`}
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
                  <View className="flex-row mt-1 gap-0.5">
                    {dayBookings.slice(0, 3).map((b, i) => (
                      <View
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getStatusColor(b.status) }}
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
                      {formatTime(booking.bookingDate || booking.createdAt)}
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
        <View className="flex-row justify-center gap-4 mt-4 mb-6">
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-[#eab308] mr-1" />
            <Text className="text-gray-500 text-xs">Pending</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] mr-1" />
            <Text className="text-gray-500 text-xs">Paid</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-[#22c55e] mr-1" />
            <Text className="text-gray-500 text-xs">Completed</Text>
          </View>
        </View>
      </ScrollView>

      {/* Full Calendar Modal */}
      <Modal
        visible={showFullCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowFullCalendar(false);
          setShowYearMonthPicker(false);
        }}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#121212] rounded-t-3xl pt-4 pb-8 px-4">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity
                onPress={() => {
                  setShowFullCalendar(false);
                  setShowYearMonthPicker(false);
                }}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">
                Select Date
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDate(new Date());
                  setShowFullCalendar(false);
                }}
                className="p-2"
              >
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
                        onPress={() => {
                          const newDate = new Date(calendarMonth);
                          newDate.setFullYear(year);
                          setCalendarMonth(newDate);
                        }}
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
                      onPress={() => {
                        const newDate = new Date(calendarMonth);
                        newDate.setMonth(idx);
                        setCalendarMonth(newDate);
                        setShowYearMonthPicker(false);
                      }}
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
                  onPress={() => {
                    const newMonth = new Date(calendarMonth);
                    newMonth.setMonth(calendarMonth.getMonth() - 1);
                    // Limit to 2024
                    if (newMonth.getFullYear() >= 2024) {
                      setCalendarMonth(newMonth);
                    }
                  }}
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
                  onPress={() => {
                    const newMonth = new Date(calendarMonth);
                    newMonth.setMonth(calendarMonth.getMonth() + 1);
                    // Limit to 2030
                    if (newMonth.getFullYear() <= 2030) {
                      setCalendarMonth(newMonth);
                    }
                  }}
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
                      const selected = isSelected(cellDate);

                      cells.push(
                        <TouchableOpacity
                          key={day}
                          onPress={() => handleDateSelectFromCalendar(day)}
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
                              <View className="absolute bottom-1 flex-row gap-0.5">
                                {dayBookings.slice(0, 2).map((b, i) => (
                                  <View
                                    key={i}
                                    className="w-1 h-1 rounded-full"
                                    style={{
                                      backgroundColor: getStatusColor(b.status),
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
                <View className="flex-row justify-center gap-4 mt-4">
                  <View className="flex-row items-center">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#eab308] mr-1" />
                    <Text className="text-gray-500 text-xs">Pending</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] mr-1" />
                    <Text className="text-gray-500 text-xs">Paid</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#22c55e] mr-1" />
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
  const { useShopBookingQuery } = useBooking();
  const { data: bookingsData, isLoading } = useShopBookingQuery();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filteredBookings = useMemo(() => {
    if (!bookingsData) return [];
    if (statusFilter === "all") return bookingsData;
    return bookingsData.filter(
      (booking: BookingData) => booking.status === statusFilter
    );
  }, [bookingsData, statusFilter]);

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Status Filters */}
      <View className="px-4 mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View className="flex-row gap-2">
            {STATUS_FILTERS.map((filter) => (
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
        <BookingCalendar bookings={filteredBookings} />
      )}
    </View>
  );
}
