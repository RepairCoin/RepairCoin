import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterStart() {
  return (
    <SafeAreaView className="flex-1 items-center bg-zinc-100">
      {/* page container */}
      <View className="w-[92%] md:w-[80%] lg:w-[60%] flex-1">
        {/* top bar */}
        <View className="mt-2 mb-2 h-10 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
          >
            <AntDesign name="left" size={18} color="#18181b" />
          </Pressable>
        </View>

        {/* title & subtitle */}
        <View className="mt-1 mb-6 items-center">
          <Text className="text-xl font-extrabold text-zinc-900">
            Create new account
          </Text>
          <Text className="mt-3 text-center text-zinc-500">
            Begin with creating an account. Get more from{"\n"}
            every repair — register now to begin.
          </Text>
        </View>

        {/* primary action */}
        <Pressable
          onPress={() => router.push("/auth/register/Wizard")}
          className="w-full rounded-2xl bg-[#FFCC00] py-4 items-center justify-center shadow-xl active:opacity-90"
        >
          <Text className="font-semibold text-zinc-900">
            Continue with email
          </Text>
        </Pressable>

        {/* OR divider */}
        <View className="my-5 flex-row items-center">
          <View className="h-[1px] flex-1 bg-zinc-300/70" />
          <Text className="mx-3 text-zinc-400">or</Text>
          <View className="h-[1px] flex-1 bg-zinc-300/70" />
        </View>

        {/* social buttons */}
        <SocialButton
          onPress={() => {}}
          left={<AntDesign name="apple1" size={18} color="#1f2937" />}
          label="Continue with Apple"
        />
        <View className="h-3" />
        <SocialButton
          onPress={() => {}}
          left={<FontAwesome name="facebook-f" size={18} color="#1877F2" />}
          label="Continue with Facebook"
        />
        <View className="h-3" />
        <SocialButton
          onPress={() => {}}
          left={
            <Image
              source={{
                uri: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
              }}
              contentFit="contain"
              style={{ width: 18, height: 18 }}
            />
          }
          label="Continue with Google"
        />

        {/* footer terms */}
        <View className="mt-auto mb-4 items-center px-6">
          <Text className="text-center text-xs text-zinc-400">
            By using RepairCoin, you agree to the{" "}
            <Text className="text-zinc-600 underline">Terms</Text> and{" "}
            <Text className="text-zinc-600 underline">Privacy Policy</Text>.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SocialButton({
  label,
  left,
  onPress,
}: {
  label: string;
  left: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-white py-4 active:opacity-90"
    >
      <View className="w-5 items-center">{left}</View>
      <Text className="text-zinc-700">{label}</Text>
      {/* spacer to balance left icon width */}
      <View className="w-5" />
    </Pressable>
  );
}
