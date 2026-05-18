import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { LoadingOverlay } from "@/shared/components/ui/LoadingOverlay";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import ActionCard from "@/shared/components/shared/ActionCard";
import { usePromoCodeUI } from "../hooks";
import { PromoCodeCard } from "./PromoCodeCard";

export default function PromoCodeTab() {
  const { promoCodes, isLoading, isUpdating, togglePromoCodeStatus, refetch } = usePromoCodeUI();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
          <SkeletonList count={4} variant="list" />
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFCC00"
                colors={["#FFCC00"]}
              />
            }
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
