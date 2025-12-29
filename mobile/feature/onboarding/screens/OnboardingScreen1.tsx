import React from "react";
import {
  Text,
  View,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const guy = require("@/assets/images/shop_boy.png");

interface OnboardingStep1Props {
  slideIndex?: number;
}

export default function OnboardingScreen1({ slideIndex = 0 }: OnboardingStep1Props) {
  return (
    <ImageBackground
      source={guy}
      resizeMode="cover"
      className="h-full w-full px-8"
    >
      <View className="mt-auto mb-20 h-[27%] w-full bg-black rounded-3xl px-6 py-8">
        <Text className="text-white text-3xl font-bold">
          Join the Revolution in{"\n"}Device Repair Loyalty
        </Text>
        <Text className="text-gray-400 mt-4">
          Reward your clients, grow your business, and{"\n"}stand out from competitors.
        </Text>
        
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
    </ImageBackground>
  );
}