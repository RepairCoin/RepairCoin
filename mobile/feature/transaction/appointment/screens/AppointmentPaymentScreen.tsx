import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardField } from "@stripe/stripe-react-native";
import { AppointmentPaymentScreenProps } from "../types";

export default function AppointmentPaymentScreen({
  selectedDate,
  selectedTime,
  serviceName,
  servicePrice,
  rcnValue,
  rcnDiscount,
  finalPrice,
  paymentError,
  onCardChange,
}: AppointmentPaymentScreenProps) {
  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <>
      {/* Payment Section */}
      <View className="px-4 mb-6">
        {/* Order Summary */}
        <View className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <Text className="text-gray-400 text-xs uppercase mb-3">
            Order Summary
          </Text>

          <View className="flex-row items-center mb-3">
            <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
              <Ionicons name="calendar" size={16} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">
                {formatDateFull(selectedDate)}
              </Text>
              <Text className="text-[#FFCC00] font-bold">
                {formatTime12Hour(selectedTime)}
              </Text>
            </View>
          </View>

          <View className="h-px bg-zinc-800 my-3" />

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Service</Text>
            <Text className="text-white font-medium">{serviceName}</Text>
          </View>

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Price</Text>
            <Text className="text-white font-medium">
              ${servicePrice.toFixed(2)}
            </Text>
          </View>

          {rcnValue > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-green-500">RCN Discount</Text>
              <Text className="text-green-500 font-medium">
                -${rcnDiscount.toFixed(2)}
              </Text>
            </View>
          )}

          <View className="h-px bg-zinc-800 my-3" />

          <View className="flex-row justify-between">
            <Text className="text-white text-lg font-semibold">Total</Text>
            <Text className="text-[#FFCC00] text-2xl font-bold">
              ${finalPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Payment Error */}
        {paymentError && (
          <View className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-xl">
            <Text className="text-red-500 text-center">{paymentError}</Text>
          </View>
        )}

        {/* Card Details */}
        <Text className="text-white text-lg font-semibold mb-1">
          Card Details
        </Text>
        <Text className="text-gray-400 text-sm mb-4">
          Enter your card information to complete payment
        </Text>

        <View className="bg-white rounded-xl p-2 mb-4">
          <CardField
            postalCodeEnabled={false}
            placeholders={{
              number: "4242 4242 4242 4242",
            }}
            cardStyle={{
              backgroundColor: "#FFFFFF",
              textColor: "#000000",
              borderWidth: 0,
              borderRadius: 8,
              fontSize: 16,
              placeholderColor: "#999999",
            }}
            style={{
              width: "100%",
              height: 50,
            }}
            onCardChange={(cardDetails) => {
              onCardChange(cardDetails.complete);
            }}
          />
        </View>

        <Text className="text-gray-500 text-xs text-center">
          Your payment is secured by Stripe. We do not store your card details.
        </Text>
      </View>
    </>
  );
}
