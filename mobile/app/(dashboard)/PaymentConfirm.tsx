import { AntDesign, Entypo, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { router } from "expo-router";

export default function PaymentConfirm() {
  return (
    <View className="w-full h-full px-4 bg-white">
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={goBack} />
        <Text className="text-black text-[22px] font-extrabold">Payment</Text>
        <View className="w-[25px]" />
      </View>

      <View className="flex-row w-full justify-center mt-8">
        <Text className="text-black font-semibold text-3xl">1,500</Text>
        <Text className="font-semibold mt-4">RCN</Text>
      </View>

      <Text className="text-black/25 text-center mt-8">No fees</Text>

      <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2 mx-2 mt-8">
        <TextInput
          placeholder="Add Note"
          placeholderTextColor="#9CA3AF"
          className="flex-1 text-base text-gray-800"
        />
        <Entypo name="emoji-happy" size={20} color="#9CA3AF" />
      </View>

      <View className="mx-2 mt-auto mb-20">
        <PrimaryButton title="Next" onPress={() => router.push("/PaymentSuccess")} />
      </View>
    </View>
  );
}
