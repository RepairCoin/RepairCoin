import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, Pressable } from "react-native";
import Screen from "@/components/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/PrimaryButton";
import { router } from "expo-router";
import { EmailConnectWalletService, SendCodeViaEmailService } from "@/services/RegisterServices";
import { useAuthStore } from "@/store/authStore";

export default function VerifyEmailPage() {
  const [code, setCode] = useState<string>("");
  const { email, setAddress } = useAuthStore(state => state);

  const handleConnectWallet = async () => {
    const account = await EmailConnectWalletService(email, code);
    if (account.address) {
      setAddress(account.address);
      router.push("/auth/register");
    }
  }

  const handleResendCode = () => {
    SendCodeViaEmailService(email);
  }

  return (
    <Screen>
      <View className="w-full h-full px-4">
        <View className="h-20" />
        <View className="mx-6 flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-[22px] font-extrabold">
            Verify Email
          </Text>
          <View className="w-[25px]" />
        </View>

        <Text className="text-white text-[14px] text-center mt-8 mb-4">
          Verify your email to secure your account and access all{"\n"}
          features.
        </Text>

        <View className="mt-4 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">Code</Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter the Code here"
            placeholderTextColor="#999"
            value={code}
            onChangeText={setCode}
          />
          <View className="flex-row items-center justify-center mt-6">
            <Text className="text-gray-300 mb-1">Don't get it? </Text>
            <Pressable onPress={handleResendCode}>
              <Text className="font-bold text-gray-300 mb-1">
                Tap to resend
              </Text>
            </Pressable>
          </View>
        </View>
        <View className="mx-2 mt-auto mb-20">
          <PrimaryButton title="Next" onPress={handleConnectWallet} />
        </View>
      </View>
    </Screen>
  );
}
