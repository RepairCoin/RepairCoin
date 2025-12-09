import { useState } from "react";
import {
  View,
  Text,
  Alert,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe, CardField } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { queryKeys } from "@/config/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/common.store";

export default function PaymentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useAuthStore();
  const { setShowSubscriptionModal } = useModalStore();
  const { clientSecret, subscriptionId } = useLocalSearchParams<{
    clientSecret: string;
    subscriptionId: string;
  }>();

  const { confirmPayment } = useStripe();
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!clientSecret) {
      Alert.alert("Error", "Payment session not found. Please try again.");
      return;
    }

    if (!cardComplete) {
      Alert.alert("Error", "Please complete your card details.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        Alert.alert("Payment Failed", stripeError.message);
        return;
      }

      if (paymentIntent) {
        // Invalidate shop queries to refetch updated subscription status
        if (account?.address) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.shopByWalletAddress(account.address),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.shops(),
          });
        }

        // Close subscription modal
        setShowSubscriptionModal(false);

        // Navigate to success screen
        router.replace("/shop/payment/payment-success");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Payment failed. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500 text-lg">
            Payment session not found.
          </Text>
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
              Enter your card details to activate your subscription
            </Text>

            {error && (
              <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            )}

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
                  onCardChange={(cardDetails) => {
                    setCardComplete(cardDetails.complete);
                    if (error) setError(null);
                  }}
                />
              </View>
            </View>

            <View className="mt-6 bg-gray-800/50 rounded-xl p-4">
              <Text className="text-gray-400 text-sm">Subscription Details</Text>
              <View className="flex-row justify-between mt-2">
                <Text className="text-white">Monthly Subscription</Text>
                <Text className="text-[#FFCC00] font-bold">$500.00/month</Text>
              </View>
            </View>

            <PrimaryButton
              title={isLoading ? "Processing..." : "Pay $500.00"}
              onPress={handlePay}
              disabled={!cardComplete || isLoading}
              loading={isLoading}
              className="mt-8"
            />

            <Pressable
              onPress={() => router.back()}
              className="mt-4 py-3 items-center"
              disabled={isLoading}
            >
              <Text className="text-gray-300 text-base">Cancel</Text>
            </Pressable>

            <Text className="text-gray-500 text-xs text-center mt-6">
              Your payment is secured by Stripe. We do not store your card
              details.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
