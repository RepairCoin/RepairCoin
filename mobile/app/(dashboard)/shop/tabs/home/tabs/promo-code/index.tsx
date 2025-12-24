import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useUpdatePromoCodeStatus } from "@/hooks/useShopRewards";
import { ThemedView } from "@/components/ui/ThemedView";
import { PromoCodeCard } from "@/components/shop/PromoCodeCard";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";
import ActionCard from "@/components/shared/ActionCard";

export default function PromoCodeTab() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { useShopPromoCodes } = useShop();
  const { data: promoCodesData, isLoading } = useShopPromoCodes(shopId);
  const updatePromoCodeStatusMutation = useUpdatePromoCodeStatus();

  const handleTogglePromoCode = (promoCodeId: string, isActive: boolean) => {
    updatePromoCodeStatusMutation.mutate({ promoCodeId, isActive });
  };

  return (
    <ThemedView className="w-full h-full">
      {/* Loading Overlay */}
      <LoadingOverlay 
        visible={updatePromoCodeStatusMutation.isPending}
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
            data={promoCodesData || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PromoCodeCard 
                promoCode={item} 
                onToggleStatus={handleTogglePromoCode}
                isUpdating={updatePromoCodeStatusMutation.isPending}
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
