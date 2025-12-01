import { useAuthStore } from "@/store/auth.store";
import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  SafeAreaView,
  ImageBackground,
  Pressable,
} from "react-native";

export default function ShowShopOnboarding() {
  return (
    <SafeAreaView>
      <ImageBackground
        source={require("@/assets/images/find_shop.png")}
        resizeMode="stretch"
        className="h-full w-full px-8"
      >
        <View className="mt-auto mb-20 w-full bg-black rounded-3xl px-6 py-8">
          <Text className="text-white text-3xl font-bold">
            Search for Partners
          </Text>
          <Text className="text-gray-400 mt-4">
            Discover participating shops where you can earn and redeem
            RepairCoin rewards
          </Text>
          <View className="flex-row justify-between items-end mt-8">
            <View className="h-2 w-10 rounded-full bg-[#FFCC00]" />
            <Pressable className="bg-[#FFCC00] rounded-xl" onPress={() => router.push("/showShop")}>
              <Text className="mx-8 my-4 font-bold">Proceed</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}
