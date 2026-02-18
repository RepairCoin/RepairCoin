import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { appointmentApi } from "@/shared/services/appointment.services";
import { TimeSlot, ShopAvailability } from "@/shared/interfaces/appointment.interface";

interface RescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTimeSlot: string, reason?: string) => void;
  isLoading?: boolean;
  shopId: string;
  serviceId: string;
  currentDate?: string;
  currentTime?: string;
}

export default function RescheduleModal({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
  shopId,
  serviceId,
  currentDate,
  currentTime,
}: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDate("");
      setSelectedTime("");
      setReason("");
    }
  }, [visible]);

  // Fetch shop availability
  const { data: shopAvailability } = useQuery<ShopAvailability[]>({
    queryKey: ["shop-availability", shopId],
    queryFn: () => appointmentApi.getShopAvailability(shopId),
    enabled: visible && !!shopId,
  });

  // Fetch available time slots for selected date
  const {
    data: timeSlots,
    isLoading: isLoadingSlots,
    error: slotsError,
  } = useQuery<TimeSlot[]>({
    queryKey: ["time-slots", shopId, serviceId, selectedDate],
    queryFn: () =>
      appointmentApi.getAvailableTimeSlots(shopId, serviceId, selectedDate),
    enabled: visible && !!shopId && !!serviceId && !!selectedDate,
  });

  // Get today's date in YYYY-MM-DD format
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
    const dayAvailability = shopAvailability.find(
      (a) => a.dayOfWeek === dayOfWeek
    );
    return dayAvailability?.isOpen || false;
  };

  // Generate marked dates
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

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
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

  const handleDateSelect = (day: DateData) => {
    setSelectedDate(day.dateString);
    setSelectedTime(""); // Reset time when date changes
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    onConfirm(selectedDate, selectedTime, reason.trim() || undefined);
  };

  const handleClose = () => {
    setSelectedDate("");
    setSelectedTime("");
    setReason("");
    onClose();
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const canConfirm = selectedDate && selectedTime && !isLoading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/80">
        <View className="flex-1 bg-[#121212] mt-16 rounded-t-3xl">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-[#333]">
            <TouchableOpacity onPress={handleClose} className="p-2 -ml-2">
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">
              Reschedule Appointment
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current Appointment Info */}
            {(currentDate || currentTime) && (
              <View className="mx-4 mt-4 p-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Current Appointment
                </Text>
                <View className="flex-row items-center">
                  <Feather name="calendar" size={16} color="#999" />
                  <Text className="text-white ml-2">
                    {currentDate ? formatDateDisplay(currentDate) : "N/A"}
                    {currentTime ? ` at ${formatTime12Hour(currentTime)}` : ""}
                  </Text>
                </View>
              </View>
            )}

            {/* Calendar */}
            <View className="px-4 mt-4">
              <Text className="text-white text-lg font-semibold mb-2">
                Select New Date
              </Text>
              <View className="bg-[#1a1a1a] rounded-2xl overflow-hidden">
                <Calendar
                  onDayPress={handleDateSelect}
                  minDate={today}
                  maxDate={maxDate}
                  markedDates={markedDates}
                  theme={{
                    backgroundColor: "#1a1a1a",
                    calendarBackground: "#1a1a1a",
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
            </View>

            {/* Time Slots */}
            {selectedDate && (
              <View className="px-4 mt-4">
                <Text className="text-white text-lg font-semibold mb-2">
                  Select New Time
                </Text>
                <Text className="text-gray-400 text-sm mb-3">
                  {formatDateDisplay(selectedDate)}
                </Text>

                {isLoadingSlots ? (
                  <View className="py-6 items-center">
                    <ActivityIndicator size="small" color="#FFCC00" />
                    <Text className="text-gray-400 text-sm mt-2">
                      Loading available times...
                    </Text>
                  </View>
                ) : slotsError ? (
                  <View className="py-6 items-center">
                    <Feather name="alert-circle" size={24} color="#ef4444" />
                    <Text className="text-gray-400 text-sm mt-2">
                      Failed to load time slots
                    </Text>
                  </View>
                ) : !timeSlots || timeSlots.length === 0 ? (
                  <View className="py-6 items-center">
                    <Ionicons name="calendar-outline" size={24} color="#666" />
                    <Text className="text-gray-400 text-sm mt-2">
                      No available times for this date
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {timeSlots.map((slot, index) => {
                      const isSelected = selectedTime === slot.time;
                      const isAvailable = slot.available;
                      return (
                        <TouchableOpacity
                          key={index}
                          onPress={() => isAvailable && setSelectedTime(slot.time)}
                          disabled={!isAvailable}
                          className={`px-4 py-2.5 rounded-xl ${
                            isSelected
                              ? "bg-[#FFCC00]"
                              : isAvailable
                              ? "bg-[#252525] border border-[#333]"
                              : "bg-[#1a1a1a] border border-[#222]"
                          }`}
                        >
                          <Text
                            className={`text-sm font-medium ${
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
                  </View>
                )}
              </View>
            )}

            {/* Reason Input */}
            {selectedDate && selectedTime && (
              <View className="px-4 mt-4">
                <Text className="text-gray-400 text-sm mb-2">
                  Reason for rescheduling (optional)
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g., Staff unavailable, Equipment maintenance..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  className="bg-[#1a1a1a] text-white rounded-xl p-3 border border-[#333] min-h-[80px]"
                  style={{ textAlignVertical: "top" }}
                />
              </View>
            )}

            {/* Summary */}
            {selectedDate && selectedTime && (
              <View className="mx-4 mt-4 p-4 bg-[#FFCC00]/10 rounded-xl border border-[#FFCC00]/30">
                <Text className="text-[#FFCC00] text-xs uppercase tracking-wider mb-2">
                  New Appointment
                </Text>
                <View className="flex-row items-center">
                  <Feather name="calendar" size={16} color="#FFCC00" />
                  <Text className="text-white ml-2 font-medium">
                    {formatDateDisplay(selectedDate)} at{" "}
                    {formatTime12Hour(selectedTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Bottom Padding */}
            <View className="h-8" />
          </ScrollView>

          {/* Action Buttons */}
          <View className="px-4 py-4 border-t border-[#333] bg-[#121212]">
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={handleClose}
                disabled={isLoading}
                className="flex-1 py-4 rounded-xl border border-gray-700"
              >
                <Text className="text-gray-300 font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!canConfirm}
                className={`flex-1 py-4 rounded-xl ${
                  canConfirm ? "bg-[#FFCC00]" : "bg-gray-700"
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text
                    className={`font-semibold text-center ${
                      canConfirm ? "text-black" : "text-gray-500"
                    }`}
                  >
                    Reschedule
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
