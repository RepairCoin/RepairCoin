import React from "react";
import { Text, View, ImageBackground, useColorScheme } from "react-native";
import { ConnectButton } from "thirdweb/react";
import { client } from "@/constants/thirdweb";
import { Ionicons } from "@expo/vector-icons";

const globe = require("@/assets/images/global_spin.png");

interface OnboardingStep3Props {
  slideIndex?: number;
}

export default function OnboardingStep3({
  slideIndex = 2,
}: OnboardingStep3Props) {
  const theme = useColorScheme();

  return (
    <ImageBackground
      source={globe}
      resizeMode="cover"
      className="h-full w-full px-8"
    >
      <View className="mt-auto mb-20 h-[26%] w-full bg-black rounded-3xl px-6 py-8">
        <Text className="text-white text-3xl font-bold">
          One Community,{"\n"}Endless Rewards
        </Text>
        <Text className="text-gray-400 mt-4">
          From phones to cars to salons — RepairCoin is{"\n"}changing how the
          world sees loyalty.
        </Text>

        <View className="flex-row justify-between mt-auto items-center pt-6">
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

          <View className="flex-row gap-4 items-center">
            <ConnectButton
              client={client}
              theme={theme || "dark"}
              connectButton={{
                label: "Connect Wallet",
                className:
                  "!bg-[#F7CC00] hover:!bg-[#E5BB00] !text-gray-900 !justify-center !w-full !font-semibold !px-8 !py-3 !rounded-full !inline-flex !items-center !gap-3 !transition-all !duration-200 !shadow-lg hover:!shadow-xl !border-none",
                style: {
                  backgroundColor: "#F7CC00",
                  color: "#111827",
                  borderRadius: "9999px",
                  fontWeight: "600",
                  width: "100%",
                  justifyContent: "center",
                  padding: "0.75rem 2rem",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                },
              }}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}
