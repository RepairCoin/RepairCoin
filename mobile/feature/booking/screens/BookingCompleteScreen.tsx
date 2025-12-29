import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams } from "expo-router";
import { DateData } from "react-native-calendars";
import { useService } from "@/hooks/service/useService";
import { useBalance } from "@/hooks/balance/useBalance";
import { useBooking, useAppointment } from "../hooks";
import { useAuthStore } from "@/store/auth.store";
import { StepIndicator } from "../components";
import BookingScheduleScreen from "./BookingScheduleScreen";
import BookingDiscountScreen from "./BookingDiscountScreen";
import { BookingStep } from "../types";

export default function BookingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();
  const { useGetService } = useService();
  const { useCreateStripeCheckoutMutation } = useBooking();
  const { useAvailableTimeSlotsQuery, useShopAvailabilityQuery } = useAppointment();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const { data: balanceData } = useBalance(userProfile?.address || "");
  const stripeCheckoutMutation = useCreateStripeCheckoutMutation();

  const [currentStep, setCurrentStep] = useState<BookingStep>("schedule");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [rcnToRedeem, setRcnToRedeem] = useState<string>("");
  const [notes] = useState("");

  const { data: shopAvailability } = useShopAvailabilityQuery(
    serviceData?.shopId || ""
  );

  const {
    data: timeSlots,
    isLoading: isLoadingSlots,
    error: slotsError,
  } = useAvailableTimeSlotsQuery(
    serviceData?.shopId || "",
    id!,
    selectedDate
  );

  const MAX_RCN_DISCOUNT = 20;
  const RCN_TO_USD = 0.10;
  const availableRcn = balanceData?.totalBalance || 0;
  const rcnValue = parseFloat(rcnToRedeem) || 0;
  const rcnDiscount = rcnValue * RCN_TO_USD;
  const servicePrice = serviceData?.priceUsd || 0;

  const maxRcnRedeemable = Math.min(
    availableRcn,
    MAX_RCN_DISCOUNT,
    servicePrice / RCN_TO_USD
  );
  const finalPrice = Math.max(0, servicePrice - rcnDiscount);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleContinueToDiscount = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert(
        "Select Appointment",
        "Please select a date and time for your appointment."
      );
      return;
    }
    setCurrentStep("discount");
  };

  const handleContinueToPayment = async () => {
    try {
      await stripeCheckoutMutation.mutateAsync({
        serviceId: id!,
        bookingDate: selectedDate,
        bookingTime: selectedTime!,
        rcnToRedeem: rcnValue > 0 ? rcnValue : undefined,
        notes: notes || undefined,
      });
    } catch (err: any) {
      console.error("Booking initiation failed:", err);
    }
  };

  const handleBack = () => {
    if (currentStep === "discount") {
      setCurrentStep("schedule");
    } else {
      goBack();
    }
  };

  const handleRcnChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    if (numValue > maxRcnRedeemable) {
      setRcnToRedeem(maxRcnRedeemable.toString());
    } else {
      setRcnToRedeem(value);
    }
  };

  const handleMaxRcn = () => {
    setRcnToRedeem(maxRcnRedeemable.toFixed(2));
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "schedule":
        return "Select Schedule";
      case "discount":
        return "Apply Discount & Pay";
      default:
        return "Complete Booking";
    }
  };

  const getCurrentStepNumber = () => {
    return currentStep === "schedule" ? 1 : 2;
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="pt-16 px-4 pb-4">
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={handleBack}>
              <AntDesign name="left" color="white" size={18} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-extrabold">
              {getStepTitle()}
            </Text>
            <View className="w-[25px]" />
          </View>

          <StepIndicator currentStep={getCurrentStepNumber()} totalSteps={2} />
        </View>

        {currentStep === "schedule" && (
          <BookingScheduleScreen
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={timeSlots}
            isLoadingSlots={isLoadingSlots}
            slotsError={slotsError}
            shopAvailability={shopAvailability}
            onDateSelect={handleDayPress}
            onTimeSelect={handleTimeSelect}
          />
        )}

        {currentStep === "discount" && (
          <BookingDiscountScreen
            selectedDate={selectedDate}
            selectedTime={selectedTime!}
            availableRcn={availableRcn}
            rcnToRedeem={rcnToRedeem}
            rcnValue={rcnValue}
            rcnDiscount={rcnDiscount}
            maxRcnRedeemable={maxRcnRedeemable}
            maxRcnLimit={MAX_RCN_DISCOUNT}
            servicePrice={servicePrice}
            finalPrice={finalPrice}
            onRcnChange={handleRcnChange}
            onMaxRcn={handleMaxRcn}
          />
        )}

        <View className="h-28" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-6 pt-4 pb-8 border-t border-zinc-800">
        {currentStep === "schedule" && (
          <TouchableOpacity
            onPress={handleContinueToDiscount}
            disabled={!selectedDate || !selectedTime}
            className={`rounded-xl py-4 items-center flex-row justify-center ${
              selectedDate && selectedTime ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
            activeOpacity={0.8}
          >
            <Text
              className={`text-lg font-bold ${
                selectedDate && selectedTime ? "text-black" : "text-gray-600"
              }`}
            >
              Continue
            </Text>
            <AntDesign
              name="right"
              size={18}
              color={selectedDate && selectedTime ? "#000" : "#666"}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}

        {currentStep === "discount" && (
          <>
            <TouchableOpacity
              onPress={handleContinueToPayment}
              disabled={stripeCheckoutMutation.isPending}
              className={`rounded-xl py-4 items-center flex-row justify-center ${
                !stripeCheckoutMutation.isPending ? "bg-[#FFCC00]" : "bg-zinc-800"
              }`}
              activeOpacity={0.8}
            >
              {stripeCheckoutMutation.isPending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#000" />
                  <Text className="text-lg font-bold text-black ml-2">
                    Pay ${finalPrice.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text className="text-gray-500 text-center text-xs mt-2">
              Opens secure checkout in your browser
            </Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
