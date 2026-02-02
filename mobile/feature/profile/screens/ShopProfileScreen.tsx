import { View, ScrollView } from "react-native";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { TabButtons } from "@/shared/components/ui/TabButtons";
import { handleLink } from "@/shared/utilities/linking";
import { formatDate } from "@/shared/utilities/format";
import {
  ProfileLoadingState,
  ProfileErrorState,
  ShopProfileHeader,
  ShopDetailsTab,
  ShopServicesTab,
  ShopReviewsTab
} from "../components";
import { useShopProfileScreen } from "../hooks/ui";
import { SHOP_PROFILE_TABS } from "../constants";
import { useLocalSearchParams } from "expo-router";

interface ShopProfileScreenProps {
  shopId: string;
}

export default function ShopProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    shopData,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    handleServicePress,
    goBack
  } = useShopProfileScreen(id);

  if (isLoading) {
    return <ProfileLoadingState message="Loading shop profile..." />;
  }

  if (error || !shopData) {
    return (
      <ProfileErrorState
        title="Shop not found"
        message="The shop you're looking for doesn't exist"
        onBack={goBack}
      />
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Shop Profile" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <ShopProfileHeader
          name={shopData.name}
          verified={shopData.verified}
          logoUrl={shopData.logoUrl}
          bannerUrl={shopData.bannerUrl}
        />

        <TabButtons
          tabs={SHOP_PROFILE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === "services" && (
          <ShopServicesTab
            shopId={id}
            onServicePress={handleServicePress}
          />
        )}

        {activeTab === "details" && (
          <ShopDetailsTab
            shopData={shopData}
            onLinkPress={handleLink}
            formatDate={formatDate}
          />
        )}

        {activeTab === "reviews" && <ShopReviewsTab />}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
