import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppointmentSummaryCard,
  RcnBalanceCard,
  RcnRedeemInput,
  PriceSummaryCard,
} from "../components";
import { AppointmentDiscountScreenProps } from "../types";

export default function AppointmentDiscountScreen({
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
  redemptionMessage,
}: AppointmentDiscountScreenProps) {
  return (
    <View className="px-4 mb-6">
      <View className="mb-6">
        <AppointmentSummaryCard
          selectedDate={selectedDate}
          selectedTime={selectedTime}
        />
      </View>

      <View className="mb-6">
        <RcnBalanceCard availableRcn={availableRcn} />
      </View>

      {/* Redemption limit info */}
      {redemptionMessage && (
        <View className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex-row items-start">
          <Ionicons name="information-circle" size={16} color="#3b82f6" />
          <Text className="text-blue-300 text-xs ml-2 flex-1">{redemptionMessage}</Text>
        </View>
      )}

      <RcnRedeemInput
        rcnToRedeem={rcnToRedeem}
        maxRcnRedeemable={maxRcnRedeemable}
        maxRcnLimit={maxRcnLimit}
        onRcnChange={onRcnChange}
        onMaxRcn={onMaxRcn}
      />

      <PriceSummaryCard
        servicePrice={servicePrice}
        rcnValue={rcnValue}
        rcnDiscount={rcnDiscount}
        finalPrice={finalPrice}
      />
    </View>
  );
}
