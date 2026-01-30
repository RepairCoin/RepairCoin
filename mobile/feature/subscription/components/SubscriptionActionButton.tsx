import { Pressable, Text } from "react-native";

type SubscriptionActionButtonProps = {
  isSubscribed: boolean;
  onSubscribe: () => void;
  onCancel: () => void;
};

export default function SubscriptionActionButton({
  isSubscribed,
  onSubscribe,
  onCancel,
}: SubscriptionActionButtonProps) {
  if (isSubscribed) {
    return (
      <Pressable
        onPress={onCancel}
        className="bg-[#E74C4C] rounded-xl py-4 items-center active:opacity-80"
      >
        <Text className="text-white text-lg font-bold">Cancel Subscription</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onSubscribe}
      className="bg-[#FFCC00] rounded-xl py-4 items-center active:opacity-80"
    >
      <Text className="text-black text-lg font-bold">Subscribe Now</Text>
    </Pressable>
  );
}
