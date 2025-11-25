import React, { useCallback, useState, useEffect } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useShopByWalletAddress } from "@/hooks";
import { useAuthStore } from "@/store/authStore";
import { ThemedView } from "@/components/ui/ThemedView";
import WalletTab from "./tabs/WalletTab";
import PromoCodeTab from "./tabs/PromoCodeTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import SubscriptionModal from "@/components/shop/SubscriptionModal";

type ShopTabs = "Wallet" | "Analysis" | "Promo Code";

export default function Home() {
  const { account } = useAuthStore();
  const {
    data: shopData,
    isLoading,
    error,
    refetch,
  } = useShopByWalletAddress(account?.address || "");
  const isOperational =
    shopData?.data?.operational_status === "rcg_qualified" ||
    shopData?.data?.operational_status === "subscription_qualified";

  const [activeTab, setActiveTab] = useState<ShopTabs>("Wallet");
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [hasUserDismissedModal, setHasUserDismissedModal] = useState(false);
  const shopTabs: ShopTabs[] = ["Wallet", "Analysis", "Promo Code"];

  // Load dismissed state from AsyncStorage on mount
  useEffect(() => {
    const loadDismissedState = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(
          `subscription_modal_dismissed_${account?.address}`
        );
        if (dismissed === "true") {
          setHasUserDismissedModal(true);
        }
      } catch (error) {
        console.error("Error loading dismissed state:", error);
      }
    };
    if (account?.address) {
      loadDismissedState();
    }
  }, [account?.address]);

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  // Show modal when shop is not operational (only if user hasn't dismissed it)
  useEffect(() => {
    if (shopData?.data && !isOperational && !hasUserDismissedModal) {
      setShowSubscriptionModal(true);
    }
  }, [shopData, isOperational, hasUserDismissedModal]);

  const handleCloseModal = async () => {
    // Only allow closing if shop is operational or user confirms
    if (isOperational) {
      setShowSubscriptionModal(false);
      setHasUserDismissedModal(true);
      // Persist dismissal to AsyncStorage
      try {
        await AsyncStorage.setItem(
          `subscription_modal_dismissed_${account?.address}`,
          "true"
        );
      } catch (error) {
        console.error("Error saving dismissed state:", error);
      }
    } else {
      Alert.alert(
        "Subscription Required",
        "You need an active subscription to access the dashboard. Would you like to subscribe now?",
        [
          {
            text: "Later",
            onPress: async () => {
              setShowSubscriptionModal(false);
              setHasUserDismissedModal(true);
              // Persist dismissal to AsyncStorage
              try {
                await AsyncStorage.setItem(
                  `subscription_modal_dismissed_${account?.address}`,
                  "true"
                );
              } catch (error) {
                console.error("Error saving dismissed state:", error);
              }
            },
            style: "cancel",
          },
          {
            text: "Subscribe",
            onPress: () => {
              // Keep modal open
            },
          },
        ]
      );
    }
  };

  return (
    <ThemedView className="h-full w-full">
      <View className="h-full w-full pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <Pressable
            onPress={() => router.push("/shop/notification")}
            className="w-10 h-10 bg-[#121212] rounded-full items-center justify-center"
          >
            <Feather name="bell" size={20} color="white" />
          </Pressable>
        </View>
        <View className="flex-row my-4 justify-between items-center">
          <View className="flex-row">
            <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
              Hello!
            </Text>
            <Text className="text-lg font-semibold text-white">
              {shopData?.data.name}
            </Text>
          </View>
        </View>
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl justify-between">
          {shopTabs.map((tab, i) => (
            <React.Fragment key={i}>
              <Pressable
                onPress={() => {
                  activeTab !== tab && setActiveTab(tab);
                }}
                className={`bg-${activeTab === tab ? "[#FFCC00]" : "[#121212]"} w-[33%] flex-row ${i === 0 && "rounded-l-xl"} ${i === 2 && "rounded-r-xl"} items-center justify-center`}
              >
                <Text
                  className={`text-base font-bold text-${activeTab === tab ? "black" : "gray-400"}`}
                >
                  {tab}
                </Text>
              </Pressable>
              {i !== 2 && activeTab === shopTabs[2 - 2 * i] && (
                <View className="w-[0.1%] bg-gray-400 my-2" />
              )}
            </React.Fragment>
          ))}
        </View>
        {activeTab === "Wallet" && shopData?.data && (
          <WalletTab shopData={shopData.data} />
        )}
        {activeTab === "Promo Code" && shopData?.data && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData?.data && <AnalyticsTab />}
      </View>
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={handleCloseModal}
        onSubscribe={async () => {
          setShowSubscriptionModal(false);
          setHasUserDismissedModal(true);
          // Persist dismissal to AsyncStorage
          try {
            await AsyncStorage.setItem(
              `subscription_modal_dismissed_${account?.address}`,
              "true"
            );
          } catch (error) {
            console.error("Error saving dismissed state:", error);
          }
          router.push("/shop/subscription-form");
        }}
        loading={subscriptionLoading}
      />
    </ThemedView>
  );
}
