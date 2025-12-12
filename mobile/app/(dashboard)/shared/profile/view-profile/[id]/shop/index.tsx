import { Linking, View, ScrollView, Text } from "react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { TabButtons } from "@/components/ui/TabButtons";
import { Ionicons } from "@expo/vector-icons";
import { useShop } from "@/hooks/shop/useShop";
import { useState } from "react";
import ReviewsTab from "./tabs/ReviewsTab";
import DetailsTab from "./tabs/DetailsTab";
import ServicesTab from "./tabs/ServicesTab";

const SHOP_TABS = [
  { key: "services", label: "Services" },
  { key: "details", label: "Details" },
  { key: "reviews", label: "Reviews" },
];

export default function ViewShopProfile({ id }: { id: string }) {
  const { useGetShopById } = useShop();
  const { data: shopData } = useGetShopById(id);
  const [activeTab, setActiveTab] = useState("services");

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = (email?: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const handleWebsite = (website?: string) => {
    if (website) {
      const url = website.startsWith("http") ? website : `https://${website}`;
      Linking.openURL(url);
    }
  };

  const handleSocial = (url?: string, platform?: string) => {
    if (url) {
      const fullUrl = url.startsWith("http")
        ? url
        : `https://${platform}.com/${url}`;
      Linking.openURL(fullUrl);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Shop Profile" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Spacer for absolute header */}
        <View className="h-4" />

        {/* Shop Avatar & Name */}
        <View className="flex-row items-center px-4 pb-6">
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
        {activeTab === "services" && (<ServicesTab/>)}

        {/* Details Tab Content */}
        {activeTab === "details" && (
          <DetailsTab
            shopData={shopData}
            handleCall={handleCall}
            handleEmail={handleEmail}
            handleWebsite={handleWebsite}
            handleSocial={handleSocial}
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
