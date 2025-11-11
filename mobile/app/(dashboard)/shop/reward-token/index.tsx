import { View, Text } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { ThemedView } from "@/components/ui/ThemedView";

export default function RewardToken() {
  return (
    <ThemedView className="w-full h-full ">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Reward Token
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
      <View className="flex-1 items-center justify-center">
        <Feather name="tool" size={48} color="#666" />
        <Text className="text-white text-lg mt-4">Under Development</Text>
      </View>
    </ThemedView>
  );
}
