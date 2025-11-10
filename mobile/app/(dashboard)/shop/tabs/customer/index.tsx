import { View, Text } from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";

export default function CustomerList() {
  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">
            Customer List
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
    </ThemedView>
  );
}
