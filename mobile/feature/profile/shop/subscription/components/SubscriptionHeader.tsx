import { View, Text } from "react-native";
import { AntDesign } from "@expo/vector-icons";

type SubscriptionHeaderProps = {
  title: string;
  onBack: () => void;
};

export default function SubscriptionHeader({ title, onBack }: SubscriptionHeaderProps) {
  return (
    <View className="flex-row justify-between items-center">
      <AntDesign name="left" color="white" size={18} onPress={onBack} />
      <Text className="text-white text-2xl font-extrabold">{title}</Text>
      <View className="w-[25px]" />
    </View>
  );
}
