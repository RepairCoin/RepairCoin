import { View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type SubscriptionIconProps = {
  isSubscribed: boolean;
};

export default function SubscriptionIcon({ isSubscribed }: SubscriptionIconProps) {
  return (
    <View
      className={`rounded-full w-20 h-20 items-center justify-center mb-4 ${
        isSubscribed ? "bg-[#2B4D2B]" : "bg-[#2B2B2B]"
      }`}
    >
      <MaterialIcons
        name={isSubscribed ? "check-circle" : "card-membership"}
        color={isSubscribed ? "#4CAF50" : "#FFCC00"}
        size={40}
      />
    </View>
  );
}
