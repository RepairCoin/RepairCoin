import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { HERO_GRADIENT_COLORS } from "../constants";

export default function HeroSection() {
  return (
    <View className="px-5 mb-6">
      <LinearGradient
        colors={[...HERO_GRADIENT_COLORS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl p-6 overflow-hidden"
      >
        <View
          className="absolute w-40 h-40 rounded-full border-[24px] border-black/5"
          style={{ right: -40, top: -40 }}
        />
        <View
          className="absolute w-24 h-24 rounded-full border-[16px] border-black/5"
          style={{ right: 60, bottom: -20 }}
        />

        <View className="items-center">
          <View className="bg-black/10 rounded-full p-4 mb-4">
            <MaterialCommunityIcons name="gift-outline" size={40} color="#000" />
          </View>
          <Text className="text-black text-2xl font-bold text-center">
            Invite Friends, Earn Rewards!
          </Text>
          <Text className="text-black/70 text-center mt-2 text-base">
            Share your code and earn 25 RCN for every{"\n"}friend who completes
            their first repair
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
