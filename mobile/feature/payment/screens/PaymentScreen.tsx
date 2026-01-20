import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { CardField } from "@stripe/stripe-react-native";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { usePayment } from "../hooks";
import { PaymentError, PaymentDetails } from "../components";

export default function PaymentScreen() {
  const router = useRouter();
  const {
    clientSecret,
    isLoading,
    cardComplete,
    error,
    isTokenPurchase,
    displayAmount,
    tokenAmount,
    handleCardChange,
    handlePay,
    handleCancel,
  } = usePayment();

  if (!clientSecret) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500 text-lg">Payment session not found.</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 py-3 px-6 bg-gray-700 rounded-xl"
          >
            <Text className="text-white">Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView>
          <View className="px-6 py-12">
            <Text className="text-[#FFCC00] text-2xl font-bold text-center">
              Complete Payment
            </Text>
            <Text className="text-gray-300 text-center mt-2 mb-8">
              {isTokenPurchase
                ? "Enter your card details to complete your purchase"
                : "Enter your card details to activate your subscription"}
            </Text>

            <PaymentError message={error} />

            <View className="mt-4">
              <Text className="text-sm text-gray-300 mb-2">Card Details</Text>
              <View className="bg-white rounded-xl p-2">
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
                  onCardChange={handleCardChange}
                />
              </View>
            </View>

            <PaymentDetails
              isTokenPurchase={isTokenPurchase}
              tokenAmount={tokenAmount}
              displayAmount={displayAmount}
            />

            <PrimaryButton
              title={isLoading ? "Processing..." : `Pay $${displayAmount}`}
              onPress={handlePay}
              disabled={!cardComplete || isLoading}
              loading={isLoading}
              className="mt-8"
            />

            <Pressable
              onPress={handleCancel}
              className="mt-4 py-3 items-center"
              disabled={isLoading}
            >
              <Text className="text-gray-300 text-base">Cancel</Text>
            </Pressable>

            <Text className="text-gray-500 text-xs text-center mt-6">
              Your payment is secured by Stripe. We do not store your card details.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
