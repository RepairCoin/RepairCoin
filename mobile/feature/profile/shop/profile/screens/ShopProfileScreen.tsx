import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { TabButtons } from "@/shared/components/ui/TabButtons";
import { handleLink } from "@/shared/utilities/linking";
import { formatDate } from "@/shared/utilities/format";
import { ProfileLoadingState } from "@/shared/components/ui/ProfileLoadingState";
import { ProfileErrorState } from "@/shared/components/ui/ProfileErrorState";
import { useShopProfileScreen } from "../hooks/useShopProfileScreen";
import { SHOP_PROFILE_TABS } from "./../constants";
import {
  ShopProfileHeader,
  ShopDetailsTab,
  ShopServicesTab,
} from "../../components";

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

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
