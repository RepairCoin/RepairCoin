import { View, Text } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { SUBSCRIPTION_FEATURES } from "../constants";

type FeatureListProps = {
  isSubscribed: boolean;
};

export default function FeatureList({ isSubscribed }: FeatureListProps) {
  const iconColor = isSubscribed ? "#4CAF50" : "#FFCC00";

  return (
    <View className="gap-3 mb-6">
      {SUBSCRIPTION_FEATURES.map((feature) => (
        <View key={feature.id} className="flex-row items-center gap-3">
          <AntDesign name="checkcircle" color={iconColor} size={20} />
          <Text className="text-white text-base">{feature.label}</Text>
        </View>
      ))}
    </View>
  );
}
