import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, DateData } from "react-native-calendars";
import { useService } from "@/hooks/service/useService";
import { useBooking } from "@/hooks/booking/useBooking";
import { useAppointment } from "@/hooks/appointment/useAppointment";

export default function CompleteBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService } = useService();
  const { useCreateBookingMutation } = useBooking();
  const { useAvailableTimeSlotsQuery } = useAppointment();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const createBookingMutation = useCreateBookingMutation();

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes] = useState("");

  // Fetch available time slots when date is selected
  const {
    data: timeSlots,
    isLoading: isLoadingSlots,
    error: slotsError,
  } = useAvailableTimeSlotsQuery(
    serviceData?.shopId || "",
    id!,
    selectedDate
  );

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

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setSelectedTime(null); // Reset time when date changes
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };


  const handleBookNow = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert(
        "Select Appointment",
        "Please select a date and time for your appointment."
      );
      return;
    }

    try {
      await createBookingMutation.mutateAsync({
        serviceId: id!,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        notes: notes || undefined,
      });

      Alert.alert(
        "Booking Created",
        "Your booking has been created successfully!",
        [
          {
            text: "View Bookings",
            onPress: () => router.replace("/customer/tabs/service/tabs/bookings" as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        "Booking Failed",
        err.message || "Failed to create booking. Please try again."
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (error || !serviceData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Service not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="pt-16 px-4 pb-4">
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={goBack}>
              <AntDesign name="left" color="white" size={18} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-extrabold">
              Complete Booking
            </Text>
            <View className="w-[25px]" />
          </View>
        </View>

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
              onDayPress={handleDayPress}
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
                        onPress={() => isAvailable && setSelectedTime(slot.time)}
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

        {/* Spacer for bottom button */}
        <View className="h-28" />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-zinc-800">
        <TouchableOpacity
          onPress={handleBookNow}
          disabled={!selectedDate || !selectedTime || createBookingMutation.isPending}
          className={`rounded-xl py-4 items-center flex-row justify-center ${
            selectedDate && selectedTime && !createBookingMutation.isPending
              ? "bg-[#FFCC00]"
              : "bg-zinc-800"
          }`}
          activeOpacity={0.8}
        >
          {createBookingMutation.isPending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={selectedDate && selectedTime ? "#000" : "#666"}
              />
              <Text
                className={`text-lg font-bold ml-2 ${
                  selectedDate && selectedTime ? "text-black" : "text-gray-600"
                }`}
              >
                Book Now - ${serviceData.priceUsd}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
