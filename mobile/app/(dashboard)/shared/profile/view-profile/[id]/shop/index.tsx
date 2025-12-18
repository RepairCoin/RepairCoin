import { useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useShop } from "@/hooks/shop/useShop";
import ReviewsTab from "./tabs/ReviewsTab";
import DetailsTab from "./tabs/DetailsTab";
import ServicesTab from "./tabs/ServicesTab";
import { handleLink } from "@/utilities/linking";
import { formatDate } from "@/utilities/format";
import { AppHeader } from "@/components/ui/AppHeader";
import { TabButtons } from "@/components/ui/TabButtons";

const SHOP_TABS = [
  { key: "services", label: "Services" },
  { key: "details", label: "Details" },
  { key: "reviews", label: "Reviews" },
];

export default function ViewShopProfile({ id }: { id: string }) {
  const { useGetShopById } = useShop();
  const { data: shopData } = useGetShopById(id);
  const [activeTab, setActiveTab] = useState("services");

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
        {activeTab === "services" && (<ServicesTab shopId={id} />)}

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
