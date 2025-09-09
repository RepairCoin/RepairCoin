import { Image, Text, View } from "react-native";
import { Link } from "expo-router";
import Screen from "@/components/Screen";
import PrimaryButton from "@/components/PrimaryButton";

const logo = require('@/assets/images/logo.png');

export default function Splash() {
  return (
    <Screen>
      <View className="flex-[0.22] items-center justify-start px-8">
        <Image source={logo} className="h-[250%] w-[80%]" resizeMode="contain" />
        <Text className="mt-10 text-center text-xs text-neutral-300">
          The Repair Industry’s Loyalty Token
        </Text>
      </View>

      <View className="flex-[0.16] items-center justify-end px-6 pb-8">
        <Link href="/onboarding" asChild>
          <PrimaryButton title="Get Started!" />
        </Link>
      </View>
    </Screen>
  );
}