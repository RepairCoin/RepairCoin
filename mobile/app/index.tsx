import { Image, Text, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { useEffect } from "react";
import { useAuth } from "@/shared/hooks/auth/useAuth";

const logo = require("@/assets/images/logo.png");

export default function Splash() {
  const { useSplashNavigation } = useAuth();
  const { navigate, hasHydrated } = useSplashNavigation();

  useEffect(() => {
    if (hasHydrated) {
      navigate();
    }
  }, [hasHydrated]);

  return (
    <Screen>
      <View className="items-center h-full">
        <View className="h-[36%]" />
        <Image
          source={logo}
          className="w-[70%] h-[110px]"
          resizeMode="contain"
        />
        <Text className="text-center text-[15px] text-neutral-300 top-[-20]">
          The Repair Industry’s Loyalty Token
        </Text>
      </View>
    </Screen>
  );
}
