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
import { useLocalSearchParams, router } from "expo-router";
import { DateData } from "react-native-calendars";
import { useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useService } from "@/hooks/service/useService";
import { useBooking } from "@/hooks/booking/useBooking";
import { useAppointment } from "@/hooks/appointment/useAppointment";
import { useBalance } from "@/hooks/balance/useBalance";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import ScheduleScreen from "./ScheduleScreen";
import DiscountScreen from "./DiscountScreen";
import PaymentScreen from "./PaymentScreen";

type BookingStep = "schedule" | "discount" | "payment";

export default function CompleteBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const { useGetService } = useService();
  const { useCreateBookingMutation } = useBooking();
  const { useAvailableTimeSlotsQuery } = useAppointment();
  const { confirmPayment } = useStripe();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const { data: balanceData } = useBalance(userProfile?.address || "");
  const createBookingMutation = useCreateBookingMutation();

  const [currentStep, setCurrentStep] = useState<BookingStep>("schedule");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [rcnToRedeem, setRcnToRedeem] = useState<string>("");
  const [notes] = useState("");

  // Payment states
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  // Calculate RCN values
  // 1 RCN = $0.10 discount, max 20 RCN can be redeemed
  const MAX_RCN_DISCOUNT = 20;
  const RCN_TO_USD = 0.10;
  const availableRcn = balanceData?.totalBalance || 0;
  const rcnValue = parseFloat(rcnToRedeem) || 0;
  const rcnDiscount = rcnValue * RCN_TO_USD;
  const servicePrice = serviceData?.priceUsd || 0;

  // Max RCN is the minimum of: available balance, 20 RCN limit, or amount that equals service price
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
      const response: any = await createBookingMutation.mutateAsync({
        serviceId: id!,
        bookingDate: selectedDate,
        bookingTime: selectedTime!,
        rcnToRedeem: rcnValue > 0 ? rcnValue : undefined,
        notes: notes || undefined,
      });

      if (response?.clientSecret) {
        setClientSecret(response.clientSecret);
        setCurrentStep("payment");
      } else {
        // If no payment required (free after discount), booking is complete
        if (userProfile?.address) {
          await queryClient.invalidateQueries({ queryKey: ["balance"] });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.customerProfile(userProfile.address),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.bookings(),
          });
        }

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
      }
    } catch (err: any) {
      Alert.alert(
        "Booking Failed",
        err.message || "Failed to create booking. Please try again."
      );
    }
  };

  const handleBack = () => {
    if (currentStep === "payment") {
      setCurrentStep("discount");
      setPaymentError(null);
    } else if (currentStep === "discount") {
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

  const handleCardChange = (complete: boolean) => {
    setCardComplete(complete);
    if (paymentError) setPaymentError(null);
  };

  const handleConfirmPayment = async () => {
    if (!clientSecret) {
      Alert.alert("Error", "Payment session not found. Please try again.");
      return;
    }

    if (!cardComplete) {
      Alert.alert("Error", "Please complete your card details.");
      return;
    }

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
        }
      );

      if (stripeError) {
        setPaymentError(stripeError.message);
        Alert.alert("Payment Failed", stripeError.message);
        return;
      }

      if (paymentIntent) {
        if (userProfile?.address) {
          await queryClient.invalidateQueries({ queryKey: ["balance"] });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.customerProfile(userProfile.address),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.bookings(),
          });
        }

        Alert.alert(
          "Booking Confirmed",
          "Your payment was successful and your booking is confirmed!",
          [
            {
              text: "View Bookings",
              onPress: () => router.replace("/customer/tabs/service/tabs/bookings" as any),
            },
          ]
        );
      }
    } catch (err: any) {
      const errorMessage = err.message || "Payment failed. Please try again.";
      setPaymentError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "schedule":
        return "Select Schedule";
      case "discount":
        return "Apply Discount";
      case "payment":
        return "Payment";
      default:
        return "Complete Booking";
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
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

          {/* Step Indicator */}
          <View className="flex-row items-center justify-center mt-4">
            <View className="flex-row items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  currentStep === "schedule" ? "bg-[#FFCC00]" : "bg-zinc-700"
                }`}
              >
                <Text
                  className={`font-bold ${
                    currentStep === "schedule" ? "text-black" : "text-white"
                  }`}
                >
                  1
                </Text>
              </View>
              <View className="w-8 h-1 bg-zinc-700 mx-1" />
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  currentStep === "discount" ? "bg-[#FFCC00]" : "bg-zinc-700"
                }`}
              >
                <Text
                  className={`font-bold ${
                    currentStep === "discount" ? "text-black" : "text-white"
                  }`}
                >
                  2
                </Text>
              </View>
              <View className="w-8 h-1 bg-zinc-700 mx-1" />
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  currentStep === "payment" ? "bg-[#FFCC00]" : "bg-zinc-700"
                }`}
              >
                <Text
                  className={`font-bold ${
                    currentStep === "payment" ? "text-black" : "text-white"
                  }`}
                >
                  3
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Step Content */}
        {currentStep === "schedule" && (
          <ScheduleScreen
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={timeSlots}
            isLoadingSlots={isLoadingSlots}
            slotsError={slotsError}
            onDateSelect={handleDayPress}
            onTimeSelect={handleTimeSelect}
          />
        )}

        {currentStep === "discount" && (
          <DiscountScreen
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

        {currentStep === "payment" && (
          <PaymentScreen
            selectedDate={selectedDate}
            selectedTime={selectedTime!}
            serviceName={serviceData.serviceName}
            servicePrice={servicePrice}
            rcnValue={rcnValue}
            rcnDiscount={rcnDiscount}
            finalPrice={finalPrice}
            paymentError={paymentError}
            onCardChange={handleCardChange}
          />
        )}

        {/* Spacer for bottom button */}
        <View className="h-28" />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-zinc-800">
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
          <TouchableOpacity
            onPress={handleContinueToPayment}
            disabled={createBookingMutation.isPending}
            className={`rounded-xl py-4 items-center flex-row justify-center ${
              !createBookingMutation.isPending ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
            activeOpacity={0.8}
          >
            {createBookingMutation.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-lg font-bold text-black">Continue</Text>
                <AntDesign
                  name="right"
                  size={18}
                  color="#000"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        )}

        {currentStep === "payment" && (
          <TouchableOpacity
            onPress={handleConfirmPayment}
            disabled={!cardComplete || isProcessingPayment}
            className={`rounded-xl py-4 items-center flex-row justify-center ${
              cardComplete && !isProcessingPayment ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
            activeOpacity={0.8}
          >
            {isProcessingPayment ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons
                  name="lock-closed"
                  size={18}
                  color={cardComplete ? "#000" : "#666"}
                />
                <Text
                  className={`text-lg font-bold ml-2 ${
                    cardComplete ? "text-black" : "text-gray-600"
                  }`}
                >
                  Pay ${finalPrice.toFixed(2)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
