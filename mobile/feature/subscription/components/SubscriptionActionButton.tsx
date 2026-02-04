import { Pressable, Text, ActivityIndicator, View } from "react-native";

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
  // Show resubscribe button when pending cancellation
  if (isSubscribed && isPendingCancellation) {
    return (
      <Pressable
        onPress={onResubscribe}
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
        onPress={onCancel}
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
      onPress={onSubscribe}
      className="bg-[#FFCC00] rounded-xl py-4 items-center active:opacity-80"
    >
      <Text className="text-black text-lg font-bold">Subscribe Now</Text>
    </Pressable>
  );
}
