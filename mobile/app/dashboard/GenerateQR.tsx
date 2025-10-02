import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput } from "react-native";
import Screen from "@/components/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/PrimaryButton";
import { router } from "expo-router";

export default function GenerateQR() {
  const [shopID, setShopId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  return (
    <Screen>
      <View className="w-full h-full px-4">
        <View className="h-20" />
        <View className="mx-2 flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-[22px] font-extrabold">
            Generate QR Code
          </Text>
          <View className="w-[25px]" />
        </View>

        <Text className="text-white text-[14px] text-center mt-8 mb-4">
          Friends can scan it to access your referral instantly,{"\n"}
          helping you earn rewards with ease
        </Text>

        <View className="mt-4 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">Shop ID</Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Shop ID here"
            placeholderTextColor="#999"
            value={shopID}
            onChangeText={setShopId}
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">
            RCN Amount
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter RCN Amount here"
            placeholderTextColor="#999"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <View className="mx-2 mt-auto mb-20">
          <PrimaryButton title="Continue" onPress={() => router.push("/dashboard/QRCode")} />
        </View>
      </View>
    </Screen>
  );
}
