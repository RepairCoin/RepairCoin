import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/store/auth.store";

type PaymentType = "subscription" | "token_purchase";

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useAuthStore();
  const {
    type = "subscription",
    amount,
    purchaseId,
  } = useLocalSearchParams<{
    type?: PaymentType;
    amount?: string;
    purchaseId?: string;
  }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  const isTokenPurchase = type === "token_purchase";
  const tokenAmount = amount ? parseInt(amount) : 0;

  useEffect(() => {
    // Animate the success icon
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate the checkmark
    Animated.timing(checkmarkAnim, {
      toValue: 1,
      duration: 400,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Slide up content
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Invalidate queries to refetch updated data
    const invalidateQueries = async () => {
      if (isTokenPurchase && purchaseId) {
        // Mark purchase as processed to prevent duplicate processing
        await AsyncStorage.setItem("lastProcessedPurchase", purchaseId);
      }

      // Invalidate all shop-related queries
      await queryClient.invalidateQueries({
        queryKey: ["shopByWalletAddress"],
      });
      await queryClient.invalidateQueries({ queryKey: ["shopTokens"] });
      await queryClient.invalidateQueries({ queryKey: ["shopPurchases"] });
      await queryClient.invalidateQueries({ queryKey: ["shop"] });
      await queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      await queryClient.invalidateQueries({ queryKey: ["shops"] });

      // Refetch shop data
      if (account?.address) {
        await queryClient.refetchQueries({
          queryKey: ["shopByWalletAddress", account.address],
        });
      }
    };

    invalidateQueries();
  }, []);

  const handleGoToDashboard = () => {
    router.replace("/shop/tabs/home");
  };

  const handleBuyMoreTokens = () => {
    router.replace("/shop/buy-token");
  };

  return (
    <Screen>
      <View className="flex-1 px-6 justify-center items-center">
        {/* Success Icon with Animation */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
          className="w-32 h-32 rounded-full bg-green-500/20 items-center justify-center mb-8"
        >
          <View className="w-24 h-24 rounded-full bg-green-500/40 items-center justify-center">
            <Animated.View
              style={{
                opacity: checkmarkAnim,
                transform: [
                  {
                    scale: checkmarkAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              }}
              className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
            >
              <Feather name="check" size={40} color="white" />
            </Animated.View>
          </View>
        </Animated.View>

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
          {isTokenPurchase && (
            <>
              {/* Purchase ID */}
              {purchaseId && (
                <View className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 w-full">
                  <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                    Transaction ID
                  </Text>
                  <Text className="text-white text-sm font-mono">
                    {purchaseId.length > 16
                      ? `${purchaseId.slice(0, 8)}...${purchaseId.slice(-8)}`
                      : purchaseId}
                  </Text>
                </View>
              )}

              {/* Token Balance Card */}
              <View className="bg-[#FFCC00]/10 rounded-2xl p-6 mb-6 w-full border border-[#FFCC00]/30">
                <View className="flex-row items-center justify-center">
                  <FontAwesome5 name="coins" size={24} color="#FFCC00" />
                  <Text className="text-[#FFCC00] text-lg font-semibold ml-3">
                    Tokens Ready to Use!
                  </Text>
                </View>
                <Text className="text-gray-300 text-sm text-center mt-3">
                  Start rewarding your customers immediately
                </Text>
              </View>
            </>
          )}

          {/* Subscription Details */}
          {!isTokenPurchase && (
            <View className="w-full bg-[#1a1a1a] rounded-2xl p-6 mb-6 border border-gray-800">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-gray-400 text-sm">Plan</Text>
                <Text className="text-white font-semibold">
                  Monthly Subscription
                </Text>
              </View>
              <View className="h-px bg-gray-800 mb-4" />
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-gray-400 text-sm">Amount Paid</Text>
                <Text className="text-[#FFCC00] font-bold text-lg">
                  $500.00
                </Text>
              </View>
              <View className="h-px bg-gray-800 mb-4" />
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-gray-400 text-sm">Status</Text>
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  <Text className="text-green-500 font-semibold">Active</Text>
                </View>
              </View>
              <View className="h-px bg-gray-800 mb-4" />
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-400 text-sm">Next Billing</Text>
                <Text className="text-white font-semibold">
                  {new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
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
