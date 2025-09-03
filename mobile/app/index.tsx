import { router } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
// import "../global.css";

export default function Landing() {
  return (
    <View className="w-full">
      <View>
        <Image
          source={require("../assets/images/landing/landing-hero.png")}
          resizeMode="cover"
          className="scale-x-50 scale-y-50 top-[-25%] left-[-110%]"
        />
      </View>
      <View className="absolute">
        <Image
          source={require("../assets/images/landing/logo.png")}
          className="w-[50vw] top-[-40] left-4"
          resizeMode="contain"
        />
      </View>
      <View className="top-[-42vh] h-80 bg-[#FFCC00] w-full">
        <View className="top-[1.8vh] h-[100vh] rounded-[8vw] bg-white w-full">
          <View className="flex-row gap-2 mt-3 mx-auto mb-10">
            <View className="h-2 w-10 rounded-full bg-[#FFCC00]" />
            <View className="h-2 w-2 rounded-full bg-[#FFCC00] opacity-40" />
            <View className="h-2 w-2 rounded-full bg-[#FFCC00] opacity-40" />
          </View>
          <Text className="text-[37px] text-center mt-20 font-[poppins-extrabold] font-extrabold">
            Welcome to{"\n"}RepairCoin
          </Text>
          <Text className="font-medium text-[14px] text-[#8D8D8D] text-center my-10 font-[poppins]">
            Earn rewards every time you repair.{"\n"}
            Track redemptions, shop nearby, and{"\n"}
            grow your loyalty wallet.
          </Text>
          <Pressable
            className="h-16 w-[60vw] rounded-[10] bg-[#FFCC00] mx-auto px-4"
            onPress={() => router.push("/auth/register")}
          >
            <View className="flex-row m-auto">
              <Image
                source={require("../assets/images/landing/wallet.png")}
                className="w-[28px] h-[28px]"
              />
              <Text className="font-bold text-[16px] my-auto ml-2 font-[poppins]">
                Connect Wallet
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
