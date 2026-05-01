import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedButton } from "@/shared/components/ui/ThemedButton";
import { useAppStore } from "@/shared/store/app.store";
import VideoBackground from "@/shared/components/ui/VideoBackground";

const video = require("@/assets/clips/onboarding3.mp4");

interface OnboardingStep3Props {
  slideIndex?: number;
}

export default function OnboardingScreen3({
  slideIndex = 2,
}: OnboardingStep3Props) {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const handleGetStarted = () => {
    completeOnboarding();
    router.replace("/(auth)/connect");
  };

  return (
    <VideoBackground source={video}>
      <View className="h-full w-full px-8">
        <View className="mt-auto mb-20 h-[28%] w-full bg-black rounded-3xl p-6 flex flex-col justify-between">
          <View>
            <Text className="text-white text-2xl font-bold">
              Ready to Earn?{"\n"}Connect and Explore
            </Text>
            <Text className="text-gray-400 mt-4">
              Tap to connect, earn, and use your rewards across all your favorite
              services.
            </Text>
          </View>

          <View className="flex-row justify-between items-center">
            <View className="flex-row gap-2 items-center">
              <View
                className={`h-2 ${slideIndex === 0 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 0 ? "" : "opacity-50"}`}
              />
              <View
                className={`h-2 ${slideIndex === 1 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 1 ? "" : "opacity-50"}`}
              />
              <View
                className={`h-2 ${slideIndex === 2 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 2 ? "" : "opacity-50"}`}
              />
            </View>
            <ThemedButton
              title="Get Started"
              variant="primary"
              onPress={handleGetStarted}
            />
          </View>
        </View>
      </View>
    </VideoBackground>
  );
}
