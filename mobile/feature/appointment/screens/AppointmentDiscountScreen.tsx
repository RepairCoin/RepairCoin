import { View } from "react-native";
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
