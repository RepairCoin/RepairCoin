import PrimaryButton from "@/components/PrimaryButton";
import Screen from "@/components/Screen";
import { router } from "expo-router";
import { View, Image, Text } from "react-native";

export default function ChoosePage() {
  return (
    <Screen>
      <Image source={require("@/assets/images/image_register.png")} resizeMode="cover" />

      <Text className="font-extrabold text-white text-[30px] text-center mt-8">
        Start Your RepairCoin{'\n'}Journey
      </Text>
      <Text className="leading-5 text-neutral-300 text-center text-[12.5px] mt-4">
        Choose your role to get started - register as a customer to earn{'\n'}
        rewards, or as a shop owner to grow your bussiness
      </Text>

      <View className="flex-col gap-4 mx-8 mt-8">
        <PrimaryButton title="Register as Customer" onPress={() => router.push("/auth/register/customer")} />
        <PrimaryButton title="Register as Shop" onPress={() => router.push("/auth/register/shop")} />
      </View>
    </Screen>
  );
}
