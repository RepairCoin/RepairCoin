import { useState } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { TouchableOpacity } from "react-native";
import { useShop } from "@/hooks/shop/useShop";
import ReviewsTab from "./tabs/ReviewsTab";
import DetailsTab from "./tabs/DetailsTab";
import ServicesTab from "./tabs/ServicesTab";
import { handleLink } from "@/utilities/linking";
import { formatDate } from "@/utilities/format";
import { AppHeader } from "@/components/ui/AppHeader";
import { TabButtons } from "@/components/ui/TabButtons";
import { messageApi } from "@/services/message.services";

const SHOP_TABS = [
  { key: "services", label: "Services" },
  { key: "details", label: "Details" },
  { key: "reviews", label: "Reviews" },
];

export default function ViewShopProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetShopById } = useShop();
  const { data: shopData, isLoading, error } = useGetShopById(id || "");
  const [activeTab, setActiveTab] = useState("services");
  const [isStartingChat, setIsStartingChat] = useState(false);

  const handleStartChat = async () => {
    if (!id || isStartingChat) return;

    setIsStartingChat(true);
    try {
      const response = await messageApi.getConversations();
      const existingConversation = response.data?.find(
        (conv) => conv.shopId === id
      );

      if (existingConversation) {
        router.push(`/customer/messages/${existingConversation.conversationId}` as any);
      } else {
        const newMessage = await messageApi.sendMessage({
          shopId: id,
          messageText: "Hi, I'm interested in your services.",
          messageType: "text",
        });
        if (newMessage.data?.conversationId) {
          router.push(`/customer/messages/${newMessage.data.conversationId}` as any);
        }
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setIsStartingChat(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading profile...</Text>
      </View>
    );
  }

  if (error || !shopData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Shop not found</Text>
          <Text className="text-gray-400 text-sm mt-2">
            The shop you're looking for doesn't exist
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Shop Profile" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="h-4" />

        {/* Shop Avatar & Name */}
        <View className="flex-row items-center px-4 pb-4">
          <View className="bg-[#FFCC00] w-20 h-20 rounded-full items-center justify-center mr-4">
            <Ionicons name="storefront" size={40} color="#000" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">
              {shopData?.name || "Unknown Shop"}
            </Text>
            {shopData?.verified && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text className="text-green-500 text-sm ml-1">
                  Verified Shop
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab Buttons */}
        <TabButtons
          tabs={SHOP_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Services Tab Content */}
        {activeTab === "services" && id && <ServicesTab shopId={id} />}

        {/* Details Tab Content */}
        {activeTab === "details" && (
          <DetailsTab
            shopData={shopData}
            handleLink={handleLink}
            formatDate={formatDate}
          />
        )}

        {/* Reviews Tab Content */}
        {activeTab === "reviews" && <ReviewsTab />}

        {/* Bottom Spacer */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
