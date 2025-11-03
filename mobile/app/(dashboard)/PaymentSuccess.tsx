import { AntDesign, Entypo, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, TouchableOpacity, Image, Pressable } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { router } from "expo-router";

export default function PaymentSuccess() {
  return (
    <View className="w-full h-full px-4 bg-white">
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={goBack} />
        <Text className="text-black text-[22px] font-extrabold">Confirmation</Text>
        <View className="w-[25px]" />
      </View>

      <Image
        source={require("@/assets/images/bg_success.png")}
        className="w-96 h-96 mx-auto mt-8"
      />

      <Text className="text-black text-2xl text-center font-extrabold mt-4">Your payment has been sent!</Text>
      <Text className="text-black/25 text-center mt-2">Congratulations! Your payment has been sent.</Text>

      <View className="bg-white w-80 mx-auto border border-black/25 rounded-2xl p-4 mt-8">
        <View className="flex-row justify-between">
          <View className="gap-1">
            <Text className="text-black/25">Shop Name</Text>
            <Text className="text-black">John Doe</Text>
            <Text className="text-black/25 mt-4">Amount</Text>
            <Text className="text-black">$220.00</Text>
          </View>
          <View className="gap-1">
            <Text className="text-black/25">Recipient Name</Text>
            <Text className="text-black">Elma Holmes</Text>
            <Text className="text-black/25 mt-4">Status</Text>
            <Text className="text-black">Pending</Text>
          </View>
        </View>
      </View>

      <Pressable
        className="bg-black/25 py-2 px-10 rounded-full mx-auto justify-center items-center mt-8"
      >
        <Text className="text-black text-lg">Track your Payment</Text>
      </Pressable>

      <View className="mx-2 mt-auto mb-20">
        <PrimaryButton title="Go Back To Referrals" onPress={() => router.push("/customer/tabs/home")} />
      </View>
    </View>
  );
}
