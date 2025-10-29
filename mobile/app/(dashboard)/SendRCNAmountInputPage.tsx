import { AntDesign, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { router } from "expo-router";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
];

export default function SendRCNAmountInputPage() {

  return (
    <View className="w-full h-full px-4 bg-white">
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={goBack} />
        <Text className="text-black text-[22px]">
          <Text className="font-extrabold">Send to</Text> @johndoe
        </Text>
        <View className="w-[25px]" />
      </View>

      <Text className="text-black/25 text-center mt-16">Available</Text>
      <View className="flex-row mt-2 w-full justify-center">
        <Text className="text-black font-semibold text-lg">2,000.00</Text>
        <Text className="text-[10px] font-semibold mt-3">RCN</Text>
      </View>

      <View className="flex-row w-full justify-center mt-8">
        <Text className="text-black font-semibold text-3xl">1,500</Text>
        <Text className="font-semibold mt-4">RCN</Text>
      </View>

      <View className="mt-20 w-full px-10">
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-between mb-6">
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => {}}
                className="w-20 h-20 mx-3 rounded-full bg-gray-100 items-center justify-center"
              >
                {key === "back" ? (
                  <Feather name="delete" size={28} color="black" />
                ) : (
                  <Text className="text-3xl font-semibold text-black">
                    {key}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <View className="mx-2 mt-auto mb-20">
        <PrimaryButton title="Next" onPress={() => router.push("/PaymentConfirm")} />
      </View>
    </View>
  );
}
