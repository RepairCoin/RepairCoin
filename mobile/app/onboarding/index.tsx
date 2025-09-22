import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  SafeAreaView,
  ImageBackground,
  Pressable
} from "react-native";

const girl = require("@/assets/images/shop_girl.png");
const guy = require("@/assets/images/shop_boy.png");
const globe = require("@/assets/images/global_spin.png");

export default function Onboarding() {
  const [index, setIndex] = useState(2);

  const Slides = [
    {
      title: "Join the Revolution in\nDevice Repair Loyalty",
      paragraph:
        "Reward your clients, grow your business, and\nstand out from competitors.",
      img: guy,
    },
    {
      title: "Smart Loyalty for\nEveryday Repairs",
      paragraph:
        "From cracked screens to car service, every repair\nnow comes with real value back to you.",
      img: girl,
    },
    {
      title: "One Community,\nEndless Rewards",
      paragraph:
        "From phones to cars to salons — RepairCoin is\nchanging how the world sees loyalty.",
      img: globe,
    },
  ];

  return (
    <SafeAreaView>
      <ImageBackground
        source={Slides[index].img}
        resizeMode="cover"
        className="h-full w-full px-8"
      >
        <View className="mt-auto mb-20 h-[26%] w-full bg-black rounded-3xl px-6 py-8">
          <Text className="text-white text-3xl font-bold">
            {Slides[index].title}
          </Text>
          <Text className="text-gray-400 mt-4">{Slides[index].paragraph}</Text>
          <View className="flex-row justify-between mt-auto items-end">
            <View className="flex-row gap-2 items-center">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className={`h-2 w-${i === index ? "10" : "2"} rounded-full bg-[#FFCC00] ${i === index ? "" : "opacity-50"}`}
                />
              ))}
            </View>
            {index === 2  ? (
              <Pressable className="bg-[#FFCC00] border-gray-400 rounded-xl" onPress={() => router.push("/auth/wallet")}>
                <Text className="mx-8 my-4 font-bold">Connect Wallet</Text>
              </Pressable>
            ) : (
              <Pressable className="border-2 border-gray-400 rounded-xl" onPress={() => setIndex(index + 1)}>
                <Text className="text-gray-400 mx-8 my-4 font-bold">Next</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}
