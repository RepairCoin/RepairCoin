import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { useHaptics } from "@/shared/hooks/useHaptics";

type SubscriptionActionButtonProps = {
  isSubscribed: boolean;
  isPendingCancellation?: boolean;
  isLoading?: boolean;
  onSubscribe: () => void;
  onCancel: () => void;
  onResubscribe?: () => void;
};

export default function SubscriptionActionButton({
  isSubscribed,
  isPendingCancellation,
  isLoading,
  onSubscribe,
  onCancel,
  onResubscribe,
}: SubscriptionActionButtonProps) {
  const haptics = useHaptics();

  // Show resubscribe button when pending cancellation
  if (isSubscribed && isPendingCancellation) {
    return (
      <Pressable
        onPress={() => { haptics.medium(); onResubscribe?.(); }}
        disabled={isLoading}
        className={`bg-[#FFCC00] rounded-xl py-4 items-center ${isLoading ? "opacity-60" : "active:opacity-80"}`}
      >
        {isLoading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="text-black text-lg font-bold">Reactivate Subscription</Text>
        )}
      </Pressable>
    );
  }

  // Show cancel button when subscribed
  if (isSubscribed) {
    return (
      <Pressable
        onPress={() => { haptics.error(); onCancel(); }}
        disabled={isLoading}
        className={`bg-[#E74C4C] rounded-xl py-4 items-center ${isLoading ? "opacity-60" : "active:opacity-80"}`}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-lg font-bold">Cancel Subscription</Text>
        )}
      </Pressable>
    );
  }

  // Show subscribe button when not subscribed
  return (
    <Pressable
      onPress={() => { haptics.medium(); onSubscribe(); }}
      className="bg-[#FFCC00] rounded-xl py-4 items-center active:opacity-80"
    >
      <Text className="text-black text-lg font-bold">Subscribe Now</Text>
    </Pressable>
  );
}
