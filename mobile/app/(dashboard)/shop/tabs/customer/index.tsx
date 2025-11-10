import { View, Text } from "react-native";

export default function CustomerList() {
  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-20 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">
            Customer List
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
    </View>
  );
}
