import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
} from "react-native";
import { AntDesign, Feather, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { router } from "expo-router";
import { ThemedView } from "@/components/ui/ThemedView";
import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";
import SubscriptionModal from "@/components/shop/SubscriptionModal";
import { usePurchase } from "@/hooks/purchase/usePurchase";

export default function BuyToken() {
  const { account, userProfile } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { useCreateStripeCheckout, usePurchaseAmount } = usePurchase();

  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");
  const {
    mutateAsync: createStripeCheckoutAsync,
    isPending: isCreatingCheckout,
  } = useCreateStripeCheckout(userProfile?.shopId);
  const {
    amount: purchaseAmount,
    setAmount: setPurchaseAmount,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount,
  } = usePurchaseAmount();

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [inputValue, setInputValue] = useState(purchaseAmount.toString());
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Check if shop is qualified to buy RCN
  const isQualified =
    shopData?.operational_status === "subscription_qualified" ||
    shopData?.operational_status === "rcg_qualified";

  // Quick purchase amounts
  const quickAmounts = [10, 50, 100, 500, 1000, 5000];

  useEffect(() => {
    setInputValue(purchaseAmount > 0 ? purchaseAmount.toString() : "");
  }, [purchaseAmount]);

  const handlePurchase = async () => {
    // Show subscription modal if not qualified
    if (!isQualified) {
      setShowSubscriptionModal(true);
      return;
    }

    if (!isValidAmount) {
      Alert.alert("Invalid Amount", "Minimum purchase amount is 5 RCN");
      return;
    }

    try {
      // Create Stripe Checkout session and open in browser
      // This avoids Apple's 30% IAP fee
      await createStripeCheckoutAsync(purchaseAmount);
      // The hook will automatically open the checkout URL in browser
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Purchase initiation failed:", error);
    }
  };

  return (
    <ThemedView className="flex-1">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={goBack} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Buy RCN Tokens</Text>
          <TouchableOpacity
            onPress={() => setShowHowItWorks(true)}
            className="p-2 -mr-2"
          >
            <Feather name="info" color="#FFCC00" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Token Input Section */}
        <View className="px-5 mb-6">
          <View className="bg-[#1A1A1A] rounded-2xl p-5">
            <View className="flex-row items-center justify-center mb-6">
              <Text className="text-[#FFCC00] text-5xl font-bold mr-2">
                {purchaseAmount.toLocaleString()}
              </Text>
              <Text className="text-gray-400 text-2xl">RCN</Text>
            </View>
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-4">
              ENTER AMOUNT
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={(text) => {
                setInputValue(text);
                const value = parseInt(text) || 0;
                setPurchaseAmount(Math.max(0, value));
              }}
              placeholder="0"
              placeholderTextColor="#4B5563"
              keyboardType="number-pad"
              className="bg-[#0A0A0A] rounded-xl px-4 py-4 text-white text-center text-2xl font-semibold"
              style={{ fontSize: 24 }}
            />

            <View className="flex-row justify-between mt-3">
              <Text className="text-gray-500 text-xs">
                Min: 5 RCN • Max: 100,000 RCN
              </Text>
              {purchaseAmount < 5 && purchaseAmount > 0 && (
                <Text className="text-red-400 text-xs">Below minimum</Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Amount Grid */}
        <View className="px-5 mb-6">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            QUICK SELECT
          </Text>
          <View className="flex-row flex-wrap -mx-1">
            {quickAmounts.map((amount) => (
              <View key={amount} className="w-1/3 px-1 mb-2">
                <TouchableOpacity
                  onPress={() => setPurchaseAmount(amount)}
                  className={`py-4 rounded-xl ${
                    purchaseAmount === amount ? "bg-[#FFCC00]" : "bg-[#1A1A1A]"
                  }`}
                >
                  <Text
                    className={`text-center font-bold ${
                      purchaseAmount === amount
                        ? "text-black text-base"
                        : "text-white text-base"
                    }`}
                  >
                    {amount >= 1000 ? `${amount / 1000}k` : amount}
                  </Text>
                  <Text
                    className={`text-center text-xs mt-1 ${
                      purchaseAmount === amount
                        ? "text-black/70"
                        : "text-gray-500"
                    }`}
                  >
                    ${(amount * 0.1).toFixed(0)}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Price Summary Card */}
        {purchaseAmount > 0 && (
          <View className="px-5 mb-6">
            <View className="bg-gradient-to-b from-[#1A1A1A] to-[#0F0F0F] rounded-2xl p-5 border border-gray-800">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-gray-400 text-xs">YOU PAY</Text>
                  <Text className="text-white text-2xl font-bold">
                    ${totalCost.toFixed(2)}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color="#4B5563" />
                <View className="items-end">
                  <Text className="text-gray-400 text-xs">YOU GET</Text>
                  <Text className="text-[#FFCC00] text-2xl font-bold">
                    {totalTokens.toLocaleString()}
                  </Text>
                  <Text className="text-[#FFCC00] text-xs">RCN</Text>
                </View>
              </View>

              {bonusAmount > 0 && (
                <View className="bg-green-500/10 rounded-lg px-3 py-2 mb-3">
                  <Text className="text-green-400 text-center text-sm font-semibold">
                    🎁 +{bonusAmount} Bonus Tokens Included!
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between pt-3 border-t border-gray-800">
                <Text className="text-gray-500 text-xs">Effective Rate</Text>
                <Text className="text-gray-300 text-xs font-semibold">
                  ${effectiveRate} per RCN
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Method */}
        <View className="px-5 mb-6">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            PAYMENT METHOD
          </Text>
          <View className="bg-[#1A1A1A] rounded-2xl p-4 flex-row items-center">
            <View className="bg-blue-500/20 rounded-full p-3 mr-4">
              <FontAwesome5 name="stripe" size={20} color="#60A5FA" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">
                Web Checkout
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                Opens browser for secure Stripe payment
              </Text>
            </View>
            <View className="bg-[#FFCC00]/20 rounded-full px-2 py-1">
              <Text className="text-[#FFCC00] text-xs font-bold">SECURE</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Purchase Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800">
        <View className="px-5 py-4">
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isCreatingCheckout || !isValidAmount}
            className={`py-4 rounded-2xl flex-row items-center justify-center ${
              isCreatingCheckout || !isValidAmount
                ? "bg-gray-800"
                : "bg-[#FFCC00]"
            }`}
          >
            {isCreatingCheckout ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather
                  name="shopping-cart"
                  size={20}
                  color={!isValidAmount ? "#4B5563" : "#000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`font-bold text-lg ${
                    !isValidAmount ? "text-gray-500" : "text-black"
                  }`}
                >
                  {!isValidAmount
                    ? "Enter Amount"
                    : `Buy ${totalTokens.toLocaleString()} RCN for $${totalCost.toFixed(2)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text className="text-gray-500 text-center text-xs mt-2">
            Opens secure checkout in your browser
          </Text>
        </View>
      </View>

      {/* How It Works Modal */}
      <Modal
        visible={showHowItWorks}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <View className="flex-1 bg-black/80">
          <Pressable
            className="flex-1"
            onPress={() => setShowHowItWorks(false)}
          />
          <View className="bg-[#1A1A1A] rounded-t-3xl pt-6 pb-8 px-5">
            <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

            <Text className="text-white text-xl font-bold mb-6">
              How Token Purchase Works
            </Text>

            <View className="space-y-4">
              {[
                {
                  icon: "dollar-sign",
                  title: "Fixed Rate",
                  desc: "Purchase RCN at $0.10 per token",
                },
                {
                  icon: "gift",
                  title: "Volume Bonus",
                  desc: "Get up to 5% bonus on large purchases",
                },
                {
                  icon: "zap",
                  title: "Instant Credit",
                  desc: "Tokens added to your balance immediately",
                },
                {
                  icon: "users",
                  title: "Reward Customers",
                  desc: "Issue tokens for repairs and services",
                },
                {
                  icon: "repeat",
                  title: "Drive Loyalty",
                  desc: "Customers redeem at $1 value per RCN",
                },
              ].map((item, index) => (
                <View key={index} className="flex-row items-start">
                  <View className="w-10 h-10 bg-[#FFCC00]/20 rounded-xl items-center justify-center mr-4">
                    <Feather
                      name={item.icon as any}
                      size={20}
                      color="#FFCC00"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold mb-1">
                      {item.title}
                    </Text>
                    <Text className="text-gray-400 text-sm">{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowHowItWorks(false)}
              className="bg-[#FFCC00] rounded-xl py-4 mt-6"
            >
              <Text className="text-black text-center font-bold">Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={() => {
          setShowSubscriptionModal(false);
          router.push("/shop/subscription-form");
        }}
      />
    </ThemedView>
  );
}
