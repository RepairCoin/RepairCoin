import { useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { BookingData } from "@/shared/interfaces/booking.interfaces";
import { useAuthStore } from "@/shared/store/auth.store";
import { bookingApi } from "@/shared/services/booking.services";
import { appointmentApi } from "@/shared/services/appointment.services";
import { useRescheduleRequestCountQuery } from "../hooks/queries";
import { useQuery } from "@tanstack/react-query";
import { disputeApi } from "../services/dispute.services";
import EnhancedBookingCard from "./EnhancedBookingCard";

// Hooks
import {
  useBookingsData,
  useBookingsFilter,
  useCalendarUI,
} from "../hooks/ui";

// Utils
import { isToday, isDateSelected, getDaysInMonth, getScrollableDays } from "@/shared/utilities/calendar";
import { BOOKING_STATUS_FILTERS, DAYS, MONTHS, YEARS } from "../constants";
import { getBookingStatusColor, BOOKING_STATUS_LEGEND } from "@/shared/constants/booking-colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;


interface BookingActions {
  onApprove: (orderId: string) => void;
  onComplete: (orderId: string) => void;
  onNoShow: (orderId: string) => void;
  isProcessing: boolean;
}

interface BookingCalendarProps {
  getBookingsForDate: (date: Date) => BookingData[];
  actions: BookingActions;
}

function BookingCalendar({ getBookingsForDate, actions }: BookingCalendarProps) {
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
  const todayIndex = scrollableDays.findIndex((d) => isToday(d));
  const initialScrollOffset = Math.max(
    0,
    todayIndex * DAY_WIDTH - SCREEN_WIDTH / 2 + DAY_WIDTH / 2
  );

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
          contentOffset={{ x: initialScrollOffset, y: 0 }}
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
                          backgroundColor: getBookingStatusColor(b.status),
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
            <EnhancedBookingCard
              key={booking.orderId || idx}
              booking={booking}
              showDate={false}
              onApprove={actions.onApprove}
              onComplete={actions.onComplete}
              onNoShow={actions.onNoShow}
              isProcessing={actions.isProcessing}
            />
          ))
        )}

        {/* Legend */}
        <View className="flex-row flex-wrap justify-center mt-4 mb-6 gap-3">
          {BOOKING_STATUS_LEGEND.map((item) => (
            <View key={item.label} className="flex-row items-center">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 4 }} />
              <Text className="text-gray-500 text-xs">{item.label}</Text>
            </View>
          ))}
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
                                      backgroundColor: getBookingStatusColor(b.status),
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
                <View className="flex-row flex-wrap justify-center mt-4 gap-3">
                  {BOOKING_STATUS_LEGEND.map((item) => (
                    <View key={item.label} className="flex-row items-center">
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 4 }} />
                      <Text className="text-gray-500 text-xs">{item.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

type ViewMode = "calendar" | "list";

interface BookingListProps {
  bookings: BookingData[];
  actions: BookingActions;
}

function BookingList({ bookings, actions }: BookingListProps) {
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(a.bookingDate || a.createdAt).getTime();
    const dateB = new Date(b.bookingDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  if (sortedBookings.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="receipt-outline" size={48} color="#333" />
        <Text className="text-gray-500 mt-3">No bookings found</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {sortedBookings.map((booking, idx) => (
        <EnhancedBookingCard
          key={booking.orderId || idx}
          booking={booking}
          showDate={true}
          onApprove={actions.onApprove}
          onComplete={actions.onComplete}
          onNoShow={actions.onNoShow}
          isProcessing={actions.isProcessing}
        />
      ))}
      <View className="h-24" />
    </ScrollView>
  );
}

export default function BookingsTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { data: pendingRescheduleCount } = useRescheduleRequestCountQuery();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { userProfile } = useAuthStore();
  const { data: disputeData } = useQuery({
    queryKey: ["shopDisputes", userProfile?.shopId, "pending"],
    queryFn: () => disputeApi.getShopDisputes(userProfile?.shopId || "", "pending"),
    enabled: !!userProfile?.shopId,
    staleTime: 60 * 1000,
  });
  const pendingDisputeCount = disputeData?.pendingCount ?? 0;
  const { statusFilter, setStatusFilter } = useBookingsFilter();
  const { isLoading, getBookingsForDate, bookings, refetch } = useBookingsData(statusFilter);

  const handleApprove = useCallback(async (orderId: string) => {
    setProcessingId(orderId);
    try {
      await bookingApi.approveOrder(orderId);
      await refetch();
    } catch {
      Alert.alert("Error", "Failed to approve booking");
    } finally {
      setProcessingId(null);
    }
  }, [refetch]);

  const handleComplete = useCallback(async (orderId: string) => {
    setProcessingId(orderId);
    try {
      await bookingApi.updateOrderStatus(orderId, "completed");
      await refetch();
    } catch {
      Alert.alert("Error", "Failed to complete order");
    } finally {
      setProcessingId(null);
    }
  }, [refetch]);

  const handleNoShow = useCallback(async (orderId: string) => {
    setProcessingId(orderId);
    try {
      await appointmentApi.markOrderAsNoShow(orderId);
      await refetch();
    } catch {
      Alert.alert("Error", "Failed to mark no-show");
    } finally {
      setProcessingId(null);
    }
  }, [refetch]);

  const actions: BookingActions = {
    onApprove: handleApprove,
    onComplete: handleComplete,
    onNoShow: handleNoShow,
    isProcessing: !!processingId,
  };

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header with View Mode Tabs and Reschedule Button */}
      <View className="flex-row items-center mb-4 gap-2">
      <View className="flex-1 flex-row bg-[#1a1a1a] rounded-xl p-1">
        <TouchableOpacity
          onPress={() => setViewMode("calendar")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            viewMode === "calendar" ? "bg-[#FFCC00]" : ""
          }`}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={viewMode === "calendar" ? "#000" : "#9CA3AF"}
          />
          <Text
            className={`ml-2 font-semibold ${
              viewMode === "calendar" ? "text-black" : "text-gray-400"
            }`}
          >
            Calendar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode("list")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
            viewMode === "list" ? "bg-[#FFCC00]" : ""
          }`}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === "list" ? "#000" : "#9CA3AF"}
          />
          <Text
            className={`ml-2 font-semibold ${
              viewMode === "list" ? "text-black" : "text-gray-400"
            }`}
          >
            List
          </Text>
        </TouchableOpacity>
      </View>

      {/* More Menu Button */}
      <View className="relative">
        <TouchableOpacity
          onPress={() => setShowMoreMenu(true)}
          className="bg-[#1a1a1a] rounded-xl p-3 relative"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#FFCC00" />
          {((pendingRescheduleCount ?? 0) + pendingDisputeCount > 0) && (
            <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-2.5 h-2.5" />
          )}
        </TouchableOpacity>
      </View>
      </View>

      {/* More Menu Dropdown */}
      <Modal visible={showMoreMenu} transparent animationType="fade">
        <Pressable
          className="flex-1"
          onPress={() => setShowMoreMenu(false)}
        >
          <Pressable
            className="absolute right-4 top-32 bg-[#1a1a1a] rounded-xl border border-zinc-800 overflow-hidden w-56"
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity
              onPress={() => {
                setShowMoreMenu(false);
                router.push("/shop/reschedule-requests" as any);
              }}
              className="flex-row items-center px-4 py-3.5 border-b border-zinc-800"
              activeOpacity={0.7}
            >
              <Feather name="repeat" size={18} color="#FFCC00" />
              <Text className="text-white text-sm font-medium ml-3 flex-1">Reschedule</Text>
              {(pendingRescheduleCount ?? 0) > 0 && (
                <View className="bg-red-500 rounded-full min-w-[20px] h-[20px] items-center justify-center px-1.5">
                  <Text className="text-white text-xs font-bold">
                    {pendingRescheduleCount! > 99 ? "99+" : pendingRescheduleCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowMoreMenu(false);
                router.push("/shop/disputes" as any);
              }}
              className="flex-row items-center px-4 py-3.5"
              activeOpacity={0.7}
            >
              <Ionicons name="shield-outline" size={18} color="#FFCC00" />
              <Text className="text-white text-sm font-medium ml-3 flex-1">Disputes</Text>
              {pendingDisputeCount > 0 && (
                <View className="bg-red-500 rounded-full min-w-[20px] h-[20px] items-center justify-center px-1.5">
                  <Text className="text-white text-xs font-bold">
                    {pendingDisputeCount > 99 ? "99+" : pendingDisputeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Status Filters - Only show for List view */}
      {viewMode === "list" && (
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
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ffcc00" />
        </View>
      ) : viewMode === "calendar" ? (
        <BookingCalendar getBookingsForDate={getBookingsForDate} actions={actions} />
      ) : (
        <BookingList bookings={bookings} actions={actions} />
      )}
    </View>
  );
}
