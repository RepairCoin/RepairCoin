import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useShopPromoCodes, useUpdatePromoCodeStatus } from "@/hooks/useShopRewards";
import { ThemedView } from "@/components/ui/ThemedView";
import { PromoCodeCard } from "@/components/shop/PromoCodeCard";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export default function PromoCodeTab() {
  const { data: promoCodesData, isLoading } = useShopPromoCodes();
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

      <View className="h-52 my-4">
        <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
          <View
            className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
            style={{
              right: -80,
              top: -20,
            }}
          />
          <Image
            source={require("@/assets/images/customer_approval_card.png")}
            className="w-98 h-98 bottom-0 right-0 absolute"
            resizeMode="contain"
          />
          <View className="pl-4 mt-10 w-[60%]">
            <Text className="text-black font-bold text-2xl">Promo Code</Text>
            <Text className="text-black/60 text-base">
              Code to redeem an offer
            </Text>
            <Pressable
              onPress={() => router.push("/shop/promo-code")}
              className="bg-black w-40 rounded-xl py-2 mt-4 justify-center items-center"
            >
              <Text className="text-[#FFCC00] font-bold text-sm">
                Create Promo Code
              </Text>
            </Pressable>
          </View>
        </View>
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
