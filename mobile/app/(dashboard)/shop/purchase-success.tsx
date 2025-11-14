import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { ThemedView } from "@/components/ui/ThemedView";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PurchaseSuccess() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const { purchase_id, amount } = params as { purchase_id?: string; amount?: string };
  const account = useAuthStore(state => state.account);
  const walletAddress = account?.address;
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const processPurchaseSuccess = async () => {
      // Check if we've already processed this purchase
      const lastProcessedPurchase = await AsyncStorage.getItem('lastProcessedPurchase');
      
      if (lastProcessedPurchase === purchase_id || hasProcessed) {
        // Already processed this purchase, redirect to home without showing alert
        router.replace("/(dashboard)/shop/tabs/home");
        return;
      }

      // Mark as processed
      setHasProcessed(true);
      if (purchase_id) {
        await AsyncStorage.setItem('lastProcessedPurchase', purchase_id);
      }

      // Invalidate all shop-related queries to force refetch
      await queryClient.invalidateQueries({ queryKey: ['shopByWalletAddress'] });
      await queryClient.invalidateQueries({ queryKey: ['shopTokens'] });
      await queryClient.invalidateQueries({ queryKey: ['shopPurchases'] });
      await queryClient.invalidateQueries({ queryKey: ['shop'] });
      await queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      
      // Refetch shop data
      await queryClient.refetchQueries({ queryKey: ['shopByWalletAddress', walletAddress] });
      
      // Show success alert only once
      if (amount) {
        Alert.alert(
          "Purchase Complete! 🎉",
          `Successfully purchased ${parseInt(amount).toLocaleString()} RCN tokens. They have been added to your balance.`,
          [
            {
              text: "View Balance",
              onPress: () => router.replace("/(dashboard)/shop/tabs/home"),
              style: "default",
            },
          ]
        );
      } else {
        // If no amount, just redirect
        setTimeout(() => {
          router.replace("/(dashboard)/shop/tabs/home");
        }, 2000);
      }
    };

    processPurchaseSuccess();
  }, [purchase_id]);

  const handleGoHome = async () => {
    // Clear the deep link and navigate
    router.replace("/(dashboard)/shop/tabs/home");
  };

  const handleBuyMore = async () => {
    // Clear the deep link and navigate
    router.replace("/(dashboard)/shop/buy-token");
  };

  return (
    <ThemedView className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        {/* Success Icon */}
        <View className="bg-green-500/20 rounded-full p-6 mb-6">
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        </View>

        {/* Success Message */}
        <Text className="text-white text-3xl font-bold text-center mb-2">
          Purchase Successful!
        </Text>
        
        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          {amount 
            ? `Your ${parseInt(amount).toLocaleString()} RCN tokens have been added to your wallet`
            : "Your RCN tokens have been added to your wallet"}
        </Text>

        {/* Purchase Details */}
        {purchase_id && (
          <View className="bg-[#1A1A1A] rounded-2xl p-4 mb-8 w-full">
            <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2">
              Transaction ID
            </Text>
            <Text className="text-white text-sm font-mono">
              {purchase_id.slice(0, 8)}...{purchase_id.slice(-8)}
            </Text>
          </View>
        )}

        {/* Token Balance Card */}
        <View className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFCC00]/10 rounded-2xl p-6 mb-8 w-full border border-[#FFCC00]/30">
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

        {/* Action Buttons */}
        <View className="w-full space-y-3">
          <TouchableOpacity
            onPress={handleGoHome}
            className="bg-[#FFCC00] rounded-2xl py-4"
          >
            <Text className="text-black text-center font-bold text-lg">
              Go to Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBuyMore}
            className="bg-[#1A1A1A] rounded-2xl py-4 border border-gray-700"
          >
            <Text className="text-white text-center font-semibold text-lg">
              Buy More Tokens
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}