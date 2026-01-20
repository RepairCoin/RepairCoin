import { View, Text } from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { useSubscription } from "../hooks";
import {
  SubscriptionHeader,
  SubscriptionStatusBadge,
  SubscriptionIcon,
  PriceCard,
  FeatureList,
  SubscriptionActionButton,
} from "../components";

export default function SubscriptionScreen() {
  const {
    isSubscribed,
    handleSubscribe,
    handleCancelSubscription,
    handleGoBack,
  } = useSubscription();

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-16 px-4 gap-4 flex-1">
        <SubscriptionHeader title="Subscription" onBack={handleGoBack} />

        <View className="flex-1 justify-center items-center">
          <View className="bg-[#212121] rounded-2xl p-6 w-full">
            <View className="items-center mb-6">
              <SubscriptionIcon isSubscribed={isSubscribed} />
              <Text className="text-white text-xl font-bold mb-2">
                {isSubscribed ? "You're Subscribed!" : "Shop Pro Subscription"}
              </Text>
              <Text className="text-white/50 text-center text-sm">
                {isSubscribed
                  ? "Enjoy all premium features for your repair business"
                  : "Unlock all features and grow your repair business"}
              </Text>
            </View>

            <SubscriptionStatusBadge isSubscribed={isSubscribed} />
            <PriceCard isSubscribed={isSubscribed} />
            <FeatureList isSubscribed={isSubscribed} />
            <SubscriptionActionButton
              isSubscribed={isSubscribed}
              onSubscribe={handleSubscribe}
              onCancel={handleCancelSubscription}
            />
          </View>
        </View>
      </View>
    </ThemedView>
  );
}
