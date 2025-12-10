import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DiscountScreenProps {
  selectedDate: string;
  selectedTime: string;
  availableRcn: number;
  rcnToRedeem: string;
  rcnValue: number;
  rcnDiscount: number;
  maxRcnRedeemable: number;
  maxRcnLimit: number;
  servicePrice: number;
  finalPrice: number;
  onRcnChange: (value: string) => void;
  onMaxRcn: () => void;
}

export default function DiscountScreen({
  selectedDate,
  selectedTime,
  availableRcn,
  rcnToRedeem,
  rcnValue,
  rcnDiscount,
  maxRcnRedeemable,
  maxRcnLimit,
  servicePrice,
  finalPrice,
  onRcnChange,
  onMaxRcn,
}: DiscountScreenProps) {
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
      {/* Discount Section */}
      <View className="px-4 mb-6">
        {/* Appointment Summary */}
        <View className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <Text className="text-gray-400 text-xs uppercase mb-2">
            Your Appointment
          </Text>
          <View className="flex-row items-center">
            <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
              <Ionicons name="calendar" size={20} color="#FFCC00" />
            </View>
            <View>
              <Text className="text-white font-medium">
                {formatDateFull(selectedDate)}
              </Text>
              <Text className="text-[#FFCC00] font-bold">
                {formatTime12Hour(selectedTime)}
              </Text>
            </View>
          </View>
        </View>

        {/* RCN Balance Card */}
        <View className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-semibold">
              Your RCN Balance
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="wallet-outline" size={18} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-lg font-bold ml-2">
                {availableRcn.toFixed(2)} RCN
              </Text>
            </View>
          </View>
          <Text className="text-gray-400 text-sm">
            1 RCN = $0.10 USD discount
          </Text>
        </View>

        {/* Redeem RCN Section */}
        <Text className="text-white text-lg font-semibold mb-1">
          Apply RCN Discount
        </Text>
        <Text className="text-gray-400 text-sm mb-4">
          Use your RCN tokens to get a discount on this service
        </Text>

        <View className="mb-4">
          <View className="flex-row items-center bg-zinc-900 rounded-xl border border-zinc-800 px-4">
            <TextInput
              className="flex-1 text-white text-lg py-4"
              placeholder="0.00"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={rcnToRedeem}
              onChangeText={onRcnChange}
            />
            <Text className="text-gray-400 mr-3">RCN</Text>
            <TouchableOpacity
              onPress={onMaxRcn}
              className="bg-[#FFCC00]/20 px-3 py-1 rounded-lg"
            >
              <Text className="text-[#FFCC00] font-semibold">MAX</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-gray-500 text-xs mt-2">
            Max redeemable: {maxRcnRedeemable.toFixed(2)} RCN (limit: {maxRcnLimit} RCN)
          </Text>
        </View>

        {/* Price Summary */}
        <View className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <Text className="text-gray-400 text-xs uppercase mb-3">
            Price Summary
          </Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Service Price</Text>
            <Text className="text-white font-medium">
              ${servicePrice.toFixed(2)}
            </Text>
          </View>

          {rcnValue > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-green-500">
                RCN Discount ({rcnValue.toFixed(2)} RCN)
              </Text>
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
      </View>
    </>
  );
}
