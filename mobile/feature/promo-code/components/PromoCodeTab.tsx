import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { PromoCodeCard } from "@/feature/promo-code/components/PromoCodeCard";
import { LoadingOverlay } from "@/shared/components/ui/LoadingOverlay";
import ActionCard from "@/shared/components/shared/ActionCard";
import { usePromoCodeUI } from "../hooks";

export default function PromoCodeTab() {
  const { promoCodes, isLoading, isUpdating, togglePromoCodeStatus } = usePromoCodeUI();

  return (
    <ThemedView className="w-full h-full">
      {/* Loading Overlay */}
      <LoadingOverlay
        visible={isUpdating}
        message="Updating promo code..."
      />

      <View className="my-4">
        <ActionCard
          title="Promo Code"
          subtitle="Code to redeem an offer"
          isLoading={isLoading}
          backgroundImage={require("@/assets/images/customer_approval_card.png")}
          inlineAction={{
            label: "Create Promo Code",
            onPress: () => router.push("/shop/promo-code"),
          }}
        />
      </View>
      
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#FFCC00" />
          </View>
        ) : (
          <FlatList
            data={promoCodes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PromoCodeCard
                promoCode={item}
                onToggleStatus={togglePromoCodeStatus}
                isUpdating={isUpdating}
              />
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center py-10">
                <Text className="text-gray-500 text-base">No promo codes created yet</Text>
                <Text className="text-gray-400 text-sm mt-2">Create your first promo code to get started</Text>
              </View>
            }
          />
        )}
      </View>
    </ThemedView>
  );
}
