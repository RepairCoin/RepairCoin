import PrimaryButton from "@/components/ui/PrimaryButton";
import Screen from "@/components/ui/Screen";
import { Entypo, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Image, Text, ImageBackground, Pressable } from "react-native";

export default function ChoosePage() {
  return (
    <Screen>
      <ImageBackground
        source={require("@/assets/images/bg_register.png")}
        className="h-full w-full"
        resizeMode="cover"
      >
        <View className="px-6 pt-16 pb-20 h-full">
          <Text className="text-4xl text-white">Welcome to</Text>
          <Text className="text-6xl text-[#FFCC00] font-extrabold mt-4">
            RepairCoin
          </Text>
          <Text className="text-gray-400 mt-4">
            Choose how you'd like to join our blockchain-powered{"\n"}repair
            ecosystem
          </Text>
          <Pressable
            onPress={() => router.push("/auth/register/customer")}
            className="w-full items-center justify-centerl py-4 bg-[#FFCC00] mt-auto rounded-full flex-row justify-center gap-2"
            style={{ minHeight: 50 }}
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
          >
            <MaterialIcons name="person" color="#000" size={24} />
            <Text className="text-xl font-extrabold text-black">
              I'm a Customer
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Screen>
  );
}
