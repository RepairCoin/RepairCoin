import { View, Text, TouchableOpacity, Animated } from "react-native";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { usePaymentSuccess } from "../hooks";
import {
  SuccessIcon,
  TokenPurchaseDetails,
  SubscriptionDetails,
} from "../components";

export default function PaymentSuccessScreen() {
  const {
    scaleAnim,
    fadeAnim,
    slideAnim,
    checkmarkAnim,
    isTokenPurchase,
    tokenAmount,
    purchaseId,
    nextBillingDate,
    handleGoToDashboard,
    handleBuyMoreTokens,
  } = usePaymentSuccess();

  return (
    <Screen>
      <View className="flex-1 px-6 justify-center items-center">
        {/* Success Icon with Animation */}
        <SuccessIcon scaleAnim={scaleAnim} checkmarkAnim={checkmarkAnim} />

        {/* Success Message */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="items-center w-full"
        >
          <Text className="text-[#FFCC00] text-3xl font-bold text-center mb-2">
            {isTokenPurchase ? "Purchase Successful!" : "Payment Successful!"}
          </Text>
          <Text className="text-gray-300 text-lg text-center mb-8">
            {isTokenPurchase
              ? `${tokenAmount.toLocaleString()} RCN tokens have been added to your wallet`
              : "Your subscription has been activated"}
          </Text>

          {/* Token Purchase Details */}
          {isTokenPurchase && <TokenPurchaseDetails purchaseId={purchaseId} />}

          {/* Subscription Details */}
          {!isTokenPurchase && (
            <SubscriptionDetails nextBillingDate={nextBillingDate} />
          )}

          {/* Action Buttons */}
          <View className="w-full">
            <PrimaryButton
              title="Go to Dashboard"
              onPress={handleGoToDashboard}
              className="w-full"
            />

            {isTokenPurchase && (
              <TouchableOpacity
                onPress={handleBuyMoreTokens}
                className="mt-3 bg-[#1A1A1A] rounded-2xl py-4 border border-gray-700"
              >
                <Text className="text-white text-center font-semibold text-base">
                  Buy More Tokens
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}
