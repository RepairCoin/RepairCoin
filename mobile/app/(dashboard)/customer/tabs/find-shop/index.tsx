import { View, Text, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useShops } from "@/hooks";

export default function FindShop() {
  const { data: shops, isLoading } = useShops();

  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">Find Shop</Text>
          <View className="w-[25px]" />
        </View>
        <View className="flex-row justify-between">
          <View className="flex-row px-4 border-2 border-[#666] rounded-full items-center w-full">
            <Feather name="search" color="#666" size={20} />
            <TextInput
              placeholder="Search Here"
              placeholderTextColor="#666"
              value={""}
              onChangeText={() => {}}
              keyboardType="email-address"
              className="color-[#666] ml-2 w-full"
            />
          </View>
        </View>
      </View>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white">Loading...</Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Feather name="tool" size={48} color="#666" />
          <Text className="text-white text-lg mt-4">Under Development</Text>
        </View>
      )}
    </View>
  );
}
