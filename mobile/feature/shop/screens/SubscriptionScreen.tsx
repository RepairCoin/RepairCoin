import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
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
    isPendingCancellation,
    expirationDate,
    isCancelling,
    isReactivating,
    handleSubscribe,
    handleCancelSubscription,
    handleResubscribe,
    handleGoBack,
  } = useSubscription();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getHeaderText = () => {
    if (isPendingCancellation) {
      return "Subscription Ending";
    }
    return isSubscribed ? "You're Subscribed!" : "Shop Pro Subscription";
  };

  const getSubheaderText = () => {
    if (isPendingCancellation && expirationDate) {
      return `Your subscription will end on ${formatDate(expirationDate)}`;
    }
    return isSubscribed
      ? "Enjoy all premium features for your repair business"
      : "Unlock all features and grow your repair business";
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-16 px-4 gap-4 flex-1">
        <SubscriptionHeader title="Subscription" onBack={handleGoBack} />

        <View className="flex-1 justify-center items-center">
          <View className="bg-[#212121] rounded-2xl p-6 w-full">
            {/* Pending Cancellation Warning Banner */}
            {isPendingCancellation && (
              <View className="bg-orange-500/20 border border-orange-500/50 rounded-xl p-4 mb-4 flex-row items-center">
                <Ionicons name="warning" size={24} color="#f97316" />
                <View className="flex-1 ml-3">
                  <Text className="text-orange-500 font-semibold">
                    Cancellation Scheduled
                  </Text>
                  <Text className="text-orange-400/80 text-sm">
                    You still have full access until {expirationDate && formatDate(expirationDate)}
                  </Text>
                </View>
              </View>
            )}

            <View className="items-center mb-6">
              <SubscriptionIcon isSubscribed={isSubscribed} />
              <Text className="text-white text-xl font-bold mb-2">
                {getHeaderText()}
              </Text>
              <Text className="text-white/50 text-center text-sm">
                {getSubheaderText()}
              </Text>
            </View>

            <SubscriptionStatusBadge
              isSubscribed={isSubscribed}
              isPendingCancellation={isPendingCancellation}
            />
            <PriceCard isSubscribed={isSubscribed} />
            <FeatureList isSubscribed={isSubscribed} />
            <SubscriptionActionButton
              isSubscribed={isSubscribed}
              isPendingCancellation={isPendingCancellation}
              isLoading={isCancelling || isReactivating}
              onSubscribe={handleSubscribe}
              onCancel={handleCancelSubscription}
              onResubscribe={handleResubscribe}
            />
          </View>
        </View>
      </View>
    </ThemedView>
  );
}
