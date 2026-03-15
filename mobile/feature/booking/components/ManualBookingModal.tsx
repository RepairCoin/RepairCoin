import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { appointmentApi, CustomerSearchResult, ManualBookingData } from "@/shared/services/appointment.services";
import { serviceApi } from "@/shared/services/service.services";
import { TimeSlot, ShopAvailability } from "@/shared/interfaces/appointment.interface";
import { ServiceData } from "@/shared/interfaces/service.interface";
import CustomerSearchInput from "./CustomerSearchInput";
import { useManualBookingMutation } from "../hooks/mutations";

interface ManualBookingModalProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
}

type PaymentStatus = "paid" | "pending" | "unpaid";
type Step = "customer" | "service" | "datetime" | "confirm";

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string; description: string }[] = [
  { value: "paid", label: "Paid", description: "Customer has already paid" },
  { value: "pending", label: "Pending", description: "Payment will be collected later" },
  { value: "unpaid", label: "Unpaid", description: "No payment required" },
];

export default function ManualBookingModal({
  visible,
  onClose,
  shopId,
}: ManualBookingModalProps) {
  // State
  const [currentStep, setCurrentStep] = useState<Step>("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [manualCustomerAddress, setManualCustomerAddress] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerEmail, setManualCustomerEmail] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [notes, setNotes] = useState("");

  // Mutation
  const createBookingMutation = useManualBookingMutation();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep("customer");
      setSelectedCustomer(null);
      setManualCustomerAddress("");
      setManualCustomerName("");
      setManualCustomerEmail("");
      setManualCustomerPhone("");
      setSelectedService(null);
      setSelectedDate("");
      setSelectedTime("");
      setPaymentStatus("pending");
      setNotes("");
    }
  }, [visible]);

  // Fetch shop services
  const { data: servicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["shop-services", shopId],
    queryFn: () => serviceApi.getShopServices(shopId),
    enabled: visible && !!shopId,
  });

  const services = servicesData?.data || [];

  // Fetch shop availability
  const { data: shopAvailability } = useQuery<ShopAvailability[]>({
    queryKey: ["shop-availability", shopId],
    queryFn: () => appointmentApi.getShopAvailability(shopId),
    enabled: visible && !!shopId,
  });

  // Fetch time slots
  const { data: timeSlots, isLoading: isLoadingSlots } = useQuery<TimeSlot[]>({
    queryKey: ["time-slots", shopId, selectedService?.serviceId, selectedDate],
    queryFn: () =>
      appointmentApi.getAvailableTimeSlots(shopId, selectedService!.serviceId, selectedDate),
    enabled: visible && !!shopId && !!selectedService && !!selectedDate,
  });

  // Calendar dates
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split("T")[0];
  }, []);

  const isDateAvailable = (date: Date): boolean => {
    if (!shopAvailability) return true;
    const dayOfWeek = date.getDay();
    const dayAvailability = shopAvailability.find((a) => a.dayOfWeek === dayOfWeek);
    return dayAvailability?.isOpen || false;
  };

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
          marks[dateString] = { ...marks[dateString], disabled: true, disableTouchEvent: true };
        }
      }
    }
    return marks;
  }, [selectedDate, shopAvailability]);

  // Helpers
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

  // Validation
  const canProceed = () => {
    switch (currentStep) {
      case "customer":
        return selectedCustomer || manualCustomerAddress.length >= 10;
      case "service":
        return !!selectedService;
      case "datetime":
        return !!selectedDate && !!selectedTime;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  // Navigation
  const handleNext = () => {
    if (currentStep === "customer") setCurrentStep("service");
    else if (currentStep === "service") setCurrentStep("datetime");
    else if (currentStep === "datetime") setCurrentStep("confirm");
  };

  const handleBack = () => {
    if (currentStep === "service") setCurrentStep("customer");
    else if (currentStep === "datetime") setCurrentStep("service");
    else if (currentStep === "confirm") setCurrentStep("datetime");
  };

  const handleSubmit = async () => {
    if (!selectedService) return;

    const customerAddress = selectedCustomer?.customerAddress || manualCustomerAddress;
    const endTime = calculateEndTime(selectedTime, selectedService.durationMinutes || 60);

    const bookingData: ManualBookingData = {
      customerAddress,
      customerName: selectedCustomer?.customerName || manualCustomerName || undefined,
      customerEmail: selectedCustomer?.customerEmail || manualCustomerEmail || undefined,
      customerPhone: selectedCustomer?.customerPhone || manualCustomerPhone || undefined,
      serviceId: selectedService.serviceId,
      bookingDate: selectedDate,
      bookingTimeSlot: selectedTime + ":00",
      bookingEndTime: endTime + ":00",
      paymentStatus,
      notes: notes.trim() || undefined,
      createNewCustomer: !selectedCustomer && manualCustomerAddress.length >= 10,
    };

    try {
      await createBookingMutation.mutateAsync({ shopId, bookingData });
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
  };

  // Step indicators
  const STEPS: Step[] = ["customer", "service", "datetime", "confirm"];
  const currentStepIndex = STEPS.indexOf(currentStep);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/80">
          <View className="flex-1 bg-[#121212] mt-12 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-[#333]">
              <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-bold">Create Booking</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Step Indicator */}
            <View className="flex-row items-center justify-center px-4 py-3 border-b border-[#252525]">
              {STEPS.map((step, index) => (
                <View key={step} className="flex-row items-center">
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: index <= currentStepIndex ? "#FFCC00" : "#333",
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: index <= currentStepIndex ? "#000" : "#666" }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  {index < STEPS.length - 1 && (
                    <View
                      className="w-10 h-0.5 mx-1"
                      style={{
                        backgroundColor: index < currentStepIndex ? "#FFCC00" : "#333",
                      }}
                    />
                  )}
                </View>
              ))}
            </View>

            <ScrollView
              className="flex-1 px-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Step 1: Customer */}
              {currentStep === "customer" && (
                <View className="py-4">
                  <Text className="text-white text-lg font-semibold mb-1">
                    Customer Information
                  </Text>
                  <Text className="text-gray-400 text-sm mb-4">
                    Search for existing customer or enter details manually
                  </Text>

                  <CustomerSearchInput
                    shopId={shopId}
                    selectedCustomer={selectedCustomer}
                    onSelectCustomer={setSelectedCustomer}
                  />

                  {/* Manual Entry Fields (if no customer selected) */}
                  {!selectedCustomer && (
                    <View className="mt-4 space-y-3 gap-3">
                      <View>
                        <Text className="text-gray-400 text-sm mb-2">
                          Wallet Address <Text className="text-red-400">*</Text>
                        </Text>
                        <TextInput
                          value={manualCustomerAddress}
                          onChangeText={setManualCustomerAddress}
                          placeholder="0x..."
                          placeholderTextColor="#666"
                          className="bg-[#252525] text-white rounded-xl px-4 py-3 border border-[#333]"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                      <View>
                        <Text className="text-gray-400 text-sm mb-2">Name</Text>
                        <TextInput
                          value={manualCustomerName}
                          onChangeText={setManualCustomerName}
                          placeholder="Customer name"
                          placeholderTextColor="#666"
                          className="bg-[#252525] text-white rounded-xl px-4 py-3 border border-[#333]"
                        />
                      </View>
                      <View>
                        <Text className="text-gray-400 text-sm mb-2">Email</Text>
                        <TextInput
                          value={manualCustomerEmail}
                          onChangeText={setManualCustomerEmail}
                          placeholder="customer@example.com"
                          placeholderTextColor="#666"
                          className="bg-[#252525] text-white rounded-xl px-4 py-3 border border-[#333]"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                      <View>
                        <Text className="text-gray-400 text-sm mb-2">Phone</Text>
                        <TextInput
                          value={manualCustomerPhone}
                          onChangeText={setManualCustomerPhone}
                          placeholder="+1 (555) 000-0000"
                          placeholderTextColor="#666"
                          className="bg-[#252525] text-white rounded-xl px-4 py-3 border border-[#333]"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Step 2: Service */}
              {currentStep === "service" && (
                <View className="py-4">
                  <Text className="text-white text-lg font-semibold mb-1">
                    Select Service
                  </Text>
                  <Text className="text-gray-400 text-sm mb-4">
                    Choose a service for this booking
                  </Text>

                  {isLoadingServices ? (
                    <View className="py-8 items-center">
                      <ActivityIndicator size="large" color="#FFCC00" />
                    </View>
                  ) : services.length === 0 ? (
                    <View className="py-8 items-center">
                      <Ionicons name="briefcase-outline" size={48} color="#666" />
                      <Text className="text-gray-500 mt-4">No services available</Text>
                    </View>
                  ) : (
                    <View className="space-y-2 gap-2">
                      {services.map((service) => {
                        const isSelected = selectedService?.serviceId === service.serviceId;
                        return (
                          <TouchableOpacity
                            key={service.serviceId}
                            onPress={() => setSelectedService(service)}
                            className={`p-4 rounded-xl border ${
                              isSelected
                                ? "bg-[#FFCC00]/10 border-[#FFCC00]"
                                : "bg-[#1a1a1a] border-[#333]"
                            }`}
                          >
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1">
                                <Text className="text-white font-medium">
                                  {service.serviceName}
                                </Text>
                                <Text className="text-gray-500 text-sm mt-1">
                                  {service.durationMinutes || 60} min
                                </Text>
                              </View>
                              <Text className="text-[#FFCC00] font-semibold">
                                ${service.priceUsd}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Step 3: Date & Time */}
              {currentStep === "datetime" && (
                <View className="py-4">
                  <Text className="text-white text-lg font-semibold mb-1">
                    Select Date & Time
                  </Text>
                  <Text className="text-gray-400 text-sm mb-4">
                    Choose the appointment date and time
                  </Text>

                  <View className="bg-[#1a1a1a] rounded-2xl overflow-hidden mb-4">
                    <Calendar
                      onDayPress={(day: DateData) => {
                        setSelectedDate(day.dateString);
                        setSelectedTime("");
                      }}
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

                  {selectedDate && (
                    <>
                      <Text className="text-gray-400 text-sm mb-3">
                        {formatDateDisplay(selectedDate)}
                      </Text>
                      {isLoadingSlots ? (
                        <View className="py-4 items-center">
                          <ActivityIndicator size="small" color="#FFCC00" />
                        </View>
                      ) : !timeSlots || timeSlots.length === 0 ? (
                        <View className="py-4 items-center">
                          <Text className="text-gray-500">No available times</Text>
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
                    </>
                  )}
                </View>
              )}

              {/* Step 4: Confirm */}
              {currentStep === "confirm" && (
                <View className="py-4">
                  <Text className="text-white text-lg font-semibold mb-4">
                    Confirm Booking
                  </Text>

                  {/* Summary */}
                  <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4 border border-[#333]">
                    <View className="mb-3 pb-3 border-b border-[#252525]">
                      <Text className="text-gray-500 text-xs uppercase mb-1">Customer</Text>
                      <Text className="text-white">
                        {selectedCustomer?.customerName || manualCustomerName || "Customer"}
                      </Text>
                    </View>
                    <View className="mb-3 pb-3 border-b border-[#252525]">
                      <Text className="text-gray-500 text-xs uppercase mb-1">Service</Text>
                      <Text className="text-white">{selectedService?.serviceName}</Text>
                      <Text className="text-[#FFCC00] text-sm">${selectedService?.priceUsd}</Text>
                    </View>
                    <View>
                      <Text className="text-gray-500 text-xs uppercase mb-1">Date & Time</Text>
                      <Text className="text-white">
                        {formatDateDisplay(selectedDate)} at {formatTime12Hour(selectedTime)}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Status */}
                  <Text className="text-gray-400 text-sm mb-2">Payment Status</Text>
                  <View className="space-y-2 gap-2 mb-4">
                    {PAYMENT_OPTIONS.map((option) => {
                      const isSelected = paymentStatus === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => setPaymentStatus(option.value)}
                          className={`p-3 rounded-xl border flex-row items-center ${
                            isSelected
                              ? "bg-[#FFCC00]/10 border-[#FFCC00]"
                              : "bg-[#1a1a1a] border-[#333]"
                          }`}
                        >
                          <View
                            className="w-5 h-5 rounded-full border-2 items-center justify-center mr-3"
                            style={{
                              borderColor: isSelected ? "#FFCC00" : "#666",
                            }}
                          >
                            {isSelected && (
                              <View className="w-2.5 h-2.5 rounded-full bg-[#FFCC00]" />
                            )}
                          </View>
                          <View>
                            <Text className="text-white font-medium">{option.label}</Text>
                            <Text className="text-gray-500 text-xs">{option.description}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Notes */}
                  <Text className="text-gray-400 text-sm mb-2">Notes (optional)</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any special instructions..."
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                    className="bg-[#1a1a1a] text-white rounded-xl p-3 border border-[#333] min-h-[80px]"
                    style={{ textAlignVertical: "top" }}
                  />
                </View>
              )}

              <View className="h-8" />
            </ScrollView>

            {/* Footer Actions */}
            <View className="px-4 py-4 border-t border-[#333] bg-[#121212]">
              <View className="flex-row space-x-3 gap-3">
                {currentStep !== "customer" && (
                  <TouchableOpacity
                    onPress={handleBack}
                    disabled={createBookingMutation.isPending}
                    className="flex-1 py-4 rounded-xl border border-gray-700"
                  >
                    <Text className="text-gray-300 font-semibold text-center">Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={currentStep === "confirm" ? handleSubmit : handleNext}
                  disabled={!canProceed() || createBookingMutation.isPending}
                  className={`flex-1 py-4 rounded-xl ${
                    canProceed() ? "bg-[#FFCC00]" : "bg-gray-700"
                  }`}
                >
                  {createBookingMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text
                      className={`font-semibold text-center ${
                        canProceed() ? "text-black" : "text-gray-500"
                      }`}
                    >
                      {currentStep === "confirm" ? "Create Booking" : "Continue"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
