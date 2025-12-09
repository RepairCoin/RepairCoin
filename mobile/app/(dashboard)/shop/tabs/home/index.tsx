import React, { useCallback, useState, useEffect } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/common.store";
import { ThemedView } from "@/components/ui/ThemedView";
import WalletTab from "./tabs/WalletTab";
import PromoCodeTab from "./tabs/PromoCodeTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import SubscriptionModal from "@/components/shop/SubscriptionModal";

type ShopTabs = "Wallet" | "Analysis" | "Promo Code";

export default function Home() {
  const { useGetShopByWalletAddress } = useShop();
  const { account } = useAuthStore();
  const {
    showSubscriptionModal,
    subscriptionModalLoading,
    setShowSubscriptionModal,
  } = useModalStore();
  const { data: shopData, refetch } = useGetShopByWalletAddress(
    account?.address || ""
  );

  const [activeTab, setActiveTab] = useState<ShopTabs>("Wallet");
  const shopTabs: ShopTabs[] = ["Wallet", "Analysis", "Promo Code"];

  const isOperational =
    shopData?.operational_status === "rcg_qualified" ||
    shopData?.operational_status === "subscription_qualified";

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  // Show/hide modal based on operational status
  useEffect(() => {
    if (shopData) {
      if (isOperational) {
        // Hide modal when shop is operational (subscription_qualified or rcg_qualified)
        setShowSubscriptionModal(false);
      } else {
        // Show modal only when not operational and user hasn't dismissed it
        setShowSubscriptionModal(true);
      }
    }
  }, [shopData, isOperational]);

  const handleCloseModal = async () => {
    // Only allow closing if shop is operational or user confirms
    if (isOperational) {
      setShowSubscriptionModal(false);
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
              {shopData?.name}
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
        {activeTab === "Wallet" && shopData && (
          <WalletTab shopData={shopData} />
        )}
        {activeTab === "Promo Code" && shopData && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData && <AnalyticsTab />}
      </View>
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={handleCloseModal}
        onSubscribe={() => {
          setShowSubscriptionModal(false);
          router.push("/shop/subscription-form");
        }}
        loading={subscriptionModalLoading}
      />
    </ThemedView>
  );
}
