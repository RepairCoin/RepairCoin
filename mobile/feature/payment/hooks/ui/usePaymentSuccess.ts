import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/shared/store/auth.store";
import { PaymentSuccessParams } from "../../types";
import { SUBSCRIPTION_PERIOD_DAYS } from "../../constants";

export function usePaymentSuccess() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useAuthStore();

  const {
    type = "subscription",
    amount,
    purchaseId,
  } = useLocalSearchParams<PaymentSuccessParams>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  const isTokenPurchase = type === "token_purchase";
  const tokenAmount = amount ? parseInt(amount) : 0;

  const nextBillingDate = new Date(
    Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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

  return {
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
  };
}
