import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedView } from "@/components/ui/ThemedView";
import { Feather } from "@expo/vector-icons";

export default function AnalyticsTab() {
  return (
    <ThemedView className="w-full h-full">
      <View className="h-52 my-4">
        <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
          <View
            className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
            style={{
              right: -80,
              top: -20,
            }}
          />
          <Image
            source={require("@/assets/images/customer_approval_card.png")}
            className="w-98 h-98 bottom-0 right-0 absolute"
            resizeMode="contain"
          />
          <View className="pl-4 mt-10 w-[60%]">
            <Text className="text-black font-bold text-2xl">
              Profit Analytics
            </Text>
            <Text className="text-black/60 text-base">Your profit summary</Text>
            <Pressable
              //   onPress={() => router.push("/shop/profit-analytics")}
              className="bg-black w-40 rounded-xl py-2 mt-4 justify-center items-center"
            >
              <Text className="text-[#FFCC00] font-bold text-sm">
                View Analytics
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View className="flex items-center mt-20 justify-center">
        <Feather name="tool" size={48} color="#666" />
        <Text className="text-white text-lg mt-4">Under Development</Text>
      </View>
    </ThemedView>
  );
}
