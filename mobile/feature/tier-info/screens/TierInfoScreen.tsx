import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useTierInfo } from "../hooks";
import { CurrentTierCard, TierBenefits, AllTiersOverview } from "../components";

export default function TierInfoScreen() {
  const {
    tierProgress,
    isLoading,
    error,
    refetch,
    getCurrentTierConfig,
    isTierUnlocked,
    TIER_CONFIG,
    TIER_ORDER,
  } = useTierInfo();

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Tier Benefits" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">Loading tier info...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Tier Benefits" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-400 text-lg mt-4">Failed to load tier info</Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const currentTierConfig = getCurrentTierConfig();

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Tier Benefits" />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <CurrentTierCard
          tierProgress={tierProgress}
          currentTierConfig={currentTierConfig}
        />

        <TierBenefits tierConfig={currentTierConfig} />

        <AllTiersOverview
          tierOrder={TIER_ORDER}
          tierConfig={TIER_CONFIG}
          currentTier={tierProgress.currentTier}
          isTierUnlocked={isTierUnlocked}
        />
      </ScrollView>
    </View>
  );
}
