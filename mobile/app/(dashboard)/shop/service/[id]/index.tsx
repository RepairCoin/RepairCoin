import { View, Text } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams } from "expo-router";

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Service
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
      <View className="flex-1 items-center justify-center">
        <Feather name="tool" size={48} color="#666" />
        <Text className="text-white text-lg mt-4">Under Development</Text>
        <Text className="text-gray-500 text-sm mt-2">Service ID: {id}</Text>
      </View>
    </View>
  );
}
