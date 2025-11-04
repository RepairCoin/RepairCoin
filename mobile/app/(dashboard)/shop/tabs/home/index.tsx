import { Image, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

export default function Home() {
  return (
    <View className="h-full w-full bg-zinc-950">
      <View className="h-full w-full pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <Pressable
            onPress={() => router.push("/shop/notification")}
            className="w-10 h-10 bg-[#121212] rounded-full items-center justify-center"
          >
            <Feather name="bell" size={20} color="white" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
