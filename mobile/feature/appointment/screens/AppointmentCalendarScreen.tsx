import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { CalendarBooking } from "@/shared/interfaces/appointment.interface";
import { useShopCalendarQuery } from "../hooks/queries/useAppointmentQueries";
import CalendarStatsCards from "../components/CalendarStatsCards";
import MonthlyCalendarView from "../components/MonthlyCalendarView";
import BookingDetailModal from "../components/BookingDetailModal";
import { formatTimeSlot } from "../utils/timeFormat";
import { getStatusColor } from "../utils/statusUtils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Confirmed",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default function AppointmentCalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Calculate date range for the current month view
  const { startDate, endDate } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
    };
  }, [currentMonth]);

  const {
    data: bookings = [],
    isLoading,
    refetch,
  } = useShopCalendarQuery(startDate, endDate);

  // Bookings for selected date
  const selectedDateBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = new Date(b.bookingDate + "T00:00:00");
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [bookings, selectedDate]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleBookingPress = useCallback((booking: CalendarBooking) => {
    setSelectedBooking(booking);
    setModalVisible(true);
  }, []);

  const handleViewOrder = useCallback((orderId: string) => {
    setModalVisible(false);
    router.push(`/shop/booking/${orderId}`);
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const selectedDateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 px-4 pb-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Appointments</Text>
        <TouchableOpacity
          onPress={() => router.push("/shop/availability" as any)}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] items-center justify-center"
        >
          <Ionicons name="settings-outline" size={20} color="#FFCC00" />
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {/* Stats Cards */}
          <CalendarStatsCards bookings={bookings} />

          {/* Monthly Calendar */}
          <MonthlyCalendarView
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            bookings={bookings}
            onSelectDate={handleSelectDate}
            onPrevMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            onToday={goToToday}
          />

          {/* Selected Date Header */}
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-white font-bold text-base">
                {selectedDateLabel}
              </Text>
              <Text className="text-gray-500 text-sm">
                {selectedDateBookings.length} appointment
                {selectedDateBookings.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Bookings List for Selected Date */}
          {selectedDateBookings.length === 0 ? (
            <View className="items-center justify-center py-12 bg-[#1a1a1a] rounded-xl">
              <Ionicons name="calendar-outline" size={48} color="#333" />
              <Text className="text-gray-500 mt-3 text-sm">
                No appointments for this day
              </Text>
            </View>
          ) : (
            selectedDateBookings.map((booking) => (
              <TouchableOpacity
                key={booking.orderId}
                onPress={() => handleBookingPress(booking)}
                className="bg-[#1a1a1a] rounded-xl p-4 mb-3 border-l-4"
                style={{
                  borderLeftColor: getStatusColor(booking.status as any),
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <Text
                      className="text-white font-semibold text-base"
                      numberOfLines={1}
                    >
                      {booking.serviceName}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Feather name="user" size={12} color="#666" />
                      <Text className="text-gray-400 text-sm ml-1">
                        {booking.customerName ||
                          `${booking.customerAddress.slice(0, 6)}...${booking.customerAddress.slice(-4)}`}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-2">
                      <Ionicons name="time-outline" size={14} color="#FFCC00" />
                      <Text className="text-[#FFCC00] text-sm ml-1 font-medium">
                        {formatTimeSlot(booking.bookingTimeSlot) || "No time set"}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <View
                      className="px-2 py-1 rounded-full"
                      style={{
                        backgroundColor:
                          getStatusColor(booking.status as any) + "20",
                      }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{
                          color: getStatusColor(booking.status as any),
                        }}
                      >
                        {STATUS_LABELS[booking.status] || booking.status}
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
        </ScrollView>
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onViewOrder={handleViewOrder}
      />
    </View>
  );
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
