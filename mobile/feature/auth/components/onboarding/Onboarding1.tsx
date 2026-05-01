import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoBackground from "@/shared/components/ui/VideoBackground";

const video = require("@/assets/clips/onboarding1.mp4");

interface OnboardingStep1Props {
  slideIndex?: number;
}

export default function OnboardingScreen1({ slideIndex = 0 }: OnboardingStep1Props) {
  return (
    <VideoBackground source={video}>
      <View className="h-full w-full px-8">
        <View className="mt-auto mb-20 h-[28%] w-full bg-black rounded-3xl p-6 flex flex-col justify-between">
          <View>
            <Text className="text-white text-2xl font-bold">
              Earn Rewards on{"\n"}Everyday Services
            </Text>
            <Text className="text-gray-400 mt-4">
              From repairs to wellness and home services —
              get rewarded every time you book.
            </Text>
          </View>

          <View className="flex-row justify-between mt-auto items-center pt-6">
            <View className="flex-row gap-2 items-center">
              <View className={`h-2 ${slideIndex === 0 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 0 ? "" : "opacity-50"}`} />
              <View className={`h-2 ${slideIndex === 1 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 1 ? "" : "opacity-50"}`} />
              <View className={`h-2 ${slideIndex === 2 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 2 ? "" : "opacity-50"}`} />
            </View>

            <View className="flex-row items-center justify-end gap-2">
              <Text className="text-gray-400 text-sm">Swipe to navigate</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFCC00" />
            </View>
          </View>
        </View>
      </View>
    </VideoBackground>
  );
}
